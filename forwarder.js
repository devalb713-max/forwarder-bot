import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/index.js";
import { Account, System, Admin } from "./db.js";

// ─── Device Fingerprinting ────────────────────────────────────────────────────
const DEVICE_MODEL = "Samsung Galaxy S21";
const SYSTEM_VERSION = "Android 12";
const APP_VERSION = "9.3.3";

let forwardingTimer = null;

function createSendClient(session) {
  return new TelegramClient(
    new StringSession(session),
    parseInt(process.env.API_ID),
    process.env.API_HASH,
    {
      connectionRetries: 3,
      timeout: 20000,
      autoReconnect: false,
      deviceModel: DEVICE_MODEL,
      systemVersion: SYSTEM_VERSION,
      appVersion: APP_VERSION,
    }
  );
}

async function notifyAllAdmins(text) {
  try {
    if (!global.bot) return;
    const admins = await Admin.find({});
    await Promise.allSettled(
      admins.map((a) => global.bot.telegram.sendMessage(a.userId, text, { parse_mode: "Markdown" }))
    );
  } catch (e) {
    console.error("[Forwarder] notifyAdmins error:", e.message);
  }
}

async function sendViaGramJS(client, groupId, msgConfig) {
  const { type, text, fileId, caption } = msgConfig;

  let peer;
  try {
    peer = await client.getInputEntity(groupId);
  } catch {
    try {
      peer = await client.getInputEntity(`-100${groupId}`);
    } catch (e2) {
      throw new Error(`Cannot resolve group ${groupId}: ${e2.message}`);
    }
  }

  if (type === "text") {
    await client.sendMessage(peer, { message: text });
    return;
  }

  const fileBuffer = await _downloadFileThroughBotAPI(fileId);

  await client.sendFile(peer, {
    file: fileBuffer,
    caption: caption || undefined,
    forceDocument: type === "document",
    voiceNote: type === "audio",
    videoNote: false,
    supportsStreaming: type === "video",
    attributes: _getFileAttributes(type),
  });
}

async function _downloadFileThroughBotAPI(fileId) {
  const botToken = process.env.BOT_TOKEN;
  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const info = await infoRes.json();
  if (!info.ok) throw new Error(`getFile failed: ${info.description}`);

  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${info.result.file_path}`);
  if (!fileRes.ok) throw new Error(`File download failed: ${fileRes.status}`);

  return Buffer.from(await fileRes.arrayBuffer());
}

function _getFileAttributes(type) {
  switch (type) {
    case "video":
      return [new Api.DocumentAttributeVideo({ duration: 0, w: 0, h: 0, supportsStreaming: true })];
    case "animation":
      return [new Api.DocumentAttributeAnimated()];
    case "audio":
      return [new Api.DocumentAttributeAudio({ duration: 0, voice: true })];
    default:
      return [];
  }
}

async function runForwardCycle() {
  try {
    const sys = await System.findOne({});
    if (!sys || !sys.forwardingActive) return;

    const msgConfig = sys.message;
    if (!msgConfig || (!msgConfig.text && !msgConfig.fileId)) {
      console.log("[Forwarder] No message set — skipping cycle");
      return;
    }

    const accounts = await Account.find({ banned: false, frozen: false });
    if (!accounts.length) {
      console.log("[Forwarder] No active accounts");
      return;
    }

    let totalSent = 0;
    let totalFailed = 0;
    let accountsUsed = 0;

    for (const account of accounts) {
      if (!account.groups || account.groups.length === 0) continue;

      accountsUsed++;

      // ── Pick the next group in rotation for this account ─────────────────
      const idx = account.currentGroupIndex % account.groups.length;
      const group = account.groups[idx];
      const nextIdx = (idx + 1) % account.groups.length;

      const client = createSendClient(account.session);
      try {
        await client.connect();
      } catch (connErr) {
        console.error(`[Forwarder] Could not connect ${account.number}: ${connErr.message}`);
        totalFailed++;
        continue;
      }

      try {
        await sendViaGramJS(client, group.id, msgConfig);
        totalSent++;
        console.log(`[Forwarder] ${account.number} → "${group.name}" (slot ${idx + 1}/${account.groups.length})`);

        // Advance rotation index
        await Account.updateOne({ _id: account._id }, { $set: { currentGroupIndex: nextIdx } });
      } catch (err) {
        const errMsg = err?.message || "";
        console.error(`[Forwarder] Failed for ${account.number} -> ${group.name}: ${errMsg}`);
        totalFailed++;

        if (
          errMsg.includes("ACCOUNT_BANNED") ||
          errMsg.includes("USER_BANNED") ||
          errMsg.includes("AUTH_KEY_UNREGISTERED") ||
          errMsg.includes("deactivated")
        ) {
          await Account.updateOne({ _id: account._id }, { $set: { banned: true } });
          await notifyAllAdmins(`🚫 Account *${account.number}* has been *banned* by Telegram and has been disabled.`);
        } else if (
          errMsg.includes("PEER_FLOOD") ||
          errMsg.includes("FLOOD") ||
          errMsg.includes("Forbidden") ||
          errMsg.includes("restricted")
        ) {
          await Account.updateOne({ _id: account._id }, { $set: { frozen: true } });
          await notifyAllAdmins(`❄️ Account *${account.number}* appears frozen/restricted and has been disabled.`);
        } else {
          // Non-fatal: still advance so we don't retry the same group forever
          await Account.updateOne({ _id: account._id }, { $set: { currentGroupIndex: nextIdx } });
        }
      }

      try { await client.disconnect(); } catch {}
    }

    if (accountsUsed === 0) {
      await notifyAllAdmins(
        `⚠️ Forward cycle ran but *none of your accounts belong to any groups*.\nPlease join groups from the userbot accounts first.`
      );
    } else {
      console.log(`[Forwarder] Cycle done — sent: ${totalSent}, failed: ${totalFailed}, accounts: ${accountsUsed}`);
    }
  } catch (error) {
    console.error("[Forwarder] Cycle error:", error);
    await notifyAllAdmins(`🆘 A serious error occurred in the forwarder engine. Please contact the bot developer.\n\n\`${error.message}\``);
  }
}

export async function startForwarding() {
  if (forwardingTimer) return false;

  const sys = await System.findOne({});
  const intervalMs = sys?.intervalMs || 5 * 60 * 1000;

  runForwardCycle(); // run once immediately

  forwardingTimer = setInterval(runForwardCycle, intervalMs);
  console.log(`[Forwarder] Started — interval: ${intervalMs / 1000}s`);
  return true;
}

export function stopForwarding() {
  if (!forwardingTimer) return false;
  clearInterval(forwardingTimer);
  forwardingTimer = null;
  console.log("[Forwarder] Stopped");
  return true;
}

export function isForwardingActive() {
  return forwardingTimer !== null;
}

export async function restartForwardingWithNewInterval() {
  if (forwardingTimer) {
    stopForwarding();
    await startForwarding();
  }
}