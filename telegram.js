import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram/tl/index.js";

// ─── Device Fingerprinting ────────────────────────────────────────────────────
// These values mimic a real Android device to avoid Telegram flagging the
// session as suspicious. Keep them consistent across all client creations
// so the session doesn't look like it's jumping devices.
const DEVICE_MODEL = "Samsung Galaxy S21";
const SYSTEM_VERSION = "Android 12";
const APP_VERSION = "9.3.3";
const LANG_CODE = "en";
const SYSTEM_LANG_CODE = "en-US";

function getDCAddress(dcId) {
  const dcMap = {
    1: "149.154.175.53",
    2: "149.154.167.51",
    3: "149.154.175.100",
    4: "149.154.167.91",
    5: "91.108.56.133",
  };
  return dcMap[dcId] || null;
}

export function createClient(sessionString = "") {
  const apiId = parseInt(process.env.API_ID);
  const apiHash = process.env.API_HASH;
  const stringSession = new StringSession(sessionString);

  return new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    timeout: 30000,
    requestRetries: 3,
    autoReconnect: true,
    deviceModel: DEVICE_MODEL,
    systemVersion: SYSTEM_VERSION,
    appVersion: APP_VERSION,
    langCode: LANG_CODE,
    systemLangCode: SYSTEM_LANG_CODE,
  });
}

/**
 * Send OTP with retry and DC migration handling.
 * Returns { success, phoneCodeHash, client? }
 * The client in the return value may be a NEW client (post DC migration) —
 * always use the returned client for subsequent calls.
 */
export async function sendCodeWithRetry(client, phone, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Auth] Attempt ${attempt}: sending code to ${phone}`);

      const result = await client.invoke(
        new Api.auth.SendCode({
          phoneNumber: phone,
          apiId: parseInt(process.env.API_ID),
          apiHash: process.env.API_HASH,
          settings: new Api.CodeSettings({
            allowFlashcall: true,
            currentNumber: true,
            allowAppHash: true,
            allowMissedCall: true,
            logoutTokens: [Buffer.from("thwaha-forwarder")],
          }),
        })
      );

      console.log(`[Auth] Code sent successfully to ${phone}`);
      return { success: true, phoneCodeHash: result.phoneCodeHash };
    } catch (error) {
      console.log(`[Auth] Attempt ${attempt} failed: ${error.message}`);

      // ── DC Migration ─────────────────────────────────────────────────────
      if (error.message && error.message.startsWith("PHONE_MIGRATE_")) {
        const dcId = parseInt(error.message.split("_").pop(), 10);
        console.log(`[Auth] Phone requires DC ${dcId}, migrating...`);

        try {
          await client.disconnect();
          await new Promise((r) => setTimeout(r, 2000));

          const newClient = new TelegramClient(
            new StringSession(""),
            parseInt(process.env.API_ID),
            process.env.API_HASH,
            {
              useWSS: false,
              autoReconnect: true,
              timeout: 30000,
              requestRetries: 3,
              connectionRetries: 5,
              retryDelay: 1000,
              initialServerAddress: getDCAddress(dcId),
              deviceModel: DEVICE_MODEL,
              systemVersion: SYSTEM_VERSION,
              appVersion: APP_VERSION,
              langCode: LANG_CODE,
              systemLangCode: SYSTEM_LANG_CODE,
            }
          );

          await newClient.connect();

          const result = await newClient.invoke(
            new Api.auth.SendCode({
              phoneNumber: phone,
              apiId: parseInt(process.env.API_ID),
              apiHash: process.env.API_HASH,
              settings: new Api.CodeSettings({
                allowFlashcall: true,
                currentNumber: true,
                allowAppHash: true,
                allowMissedCall: true,
                logoutTokens: [Buffer.from("thwaha-forwarder")],
              }),
            })
          );

          console.log(`[Auth] Code sent after DC migration to ${phone}`);
          // Return the NEW client so caller can persist it
          return { success: true, phoneCodeHash: result.phoneCodeHash, client: newClient };
        } catch (migErr) {
          console.error(`[Auth] DC migration to ${dcId} failed:`, migErr.message);
          if (attempt === maxRetries) {
            return { success: false, error: `DC migration failed: ${migErr.message}` };
          }
        }
      } else if (attempt === maxRetries) {
        return { success: false, error: error.message };
      }

      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

/**
 * Complete login with OTP code (and optionally 2FA password in one shot).
 * phoneCodeHash must be the exact value returned from sendCodeWithRetry.
 * Returns { success, needsPassword?, wrongPassword?, username?, groupCount?, session? }
 */
export async function loginWithCode(client, phoneNumber, phoneCodeHash, code, password = null) {
  try {
    // If caller already has the password, try 2FA path directly
    if (password) {
      console.log("[Auth] Password provided upfront — attempting 2FA...");
      try {
        const passwordInfo = await client.invoke(new Api.account.GetPassword());
        const { computeCheck } = await import("telegram/Password.js");
        const passwordHash = await computeCheck(passwordInfo, password);
        const result = await client.invoke(new Api.auth.CheckPassword({ password: passwordHash }));
        return await _finalizeLogin(client, phoneNumber);
      } catch (pwdErr) {
        if (pwdErr.errorMessage === "PASSWORD_HASH_INVALID") {
          return { success: false, wrongPassword: true, error: "Wrong password." };
        }
        throw pwdErr;
      }
    }

    // Standard OTP sign-in
    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: `${phoneNumber}`,
          phoneCodeHash: phoneCodeHash,
          phoneCode: code,
        })
      );
      return await _finalizeLogin(client, phoneNumber);
    } catch (err) {
      if (err.code === 401 && err.errorMessage === "SESSION_PASSWORD_NEEDED") {
        return { success: false, needsPassword: true };
      }
      throw err;
    }
  } catch (error) {
    console.error("[Auth] Login error:", error.message);
    try { await client.disconnect(); } catch {}
    return { success: false, error: error.message };
  }
}

/**
 * Complete 2FA login after needsPassword was returned.
 * Client must still be connected with the same session.
 */
export async function loginWith2FA(client, phoneNumber, password) {
  try {
    const passwordInfo = await client.invoke(new Api.account.GetPassword());
    const { computeCheck } = await import("telegram/Password.js");
    const passwordHash = await computeCheck(passwordInfo, password);
    await client.invoke(new Api.auth.CheckPassword({ password: passwordHash }));
    return await _finalizeLogin(client, phoneNumber);
  } catch (error) {
    if (error.errorMessage === "PASSWORD_HASH_INVALID") {
      return { success: false, wrongPassword: true, error: "Wrong password." };
    }
    console.error("[Auth] 2FA error:", error.message);
    try { await client.disconnect(); } catch {}
    return { success: false, error: error.message };
  }
}

async function _finalizeLogin(client, phoneNumber) {
  const me = await client.getMe();
  const username = me.username || null;

  const dialogs = await client.getDialogs({ limit: 500 });
  const groups = [];
  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if (entity.className === "Channel" || entity.className === "Chat") {
      groups.push({
        id: entity.id.toString(),
        name: entity.title || "Unnamed Group",
        link: entity.username ? `https://t.me/${entity.username}` : null,
      });
    }
  }

  const session = client.session.save();
  await client.disconnect();

  return { success: true, username, groupCount: groups.length, session, groups, phoneNumber };
}

/**
 * Fetch groups for an existing session.
 */
export async function fetchAccountGroups(session) {
  const client = createClient(session);
  try {
    await client.connect();
    const dialogs = await client.getDialogs({ limit: 500 });
    const groups = [];
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (entity.className === "Channel" || entity.className === "Chat") {
        groups.push({
          id: entity.id.toString(),
          name: entity.title || "Unnamed Group",
          link: entity.username ? `https://t.me/${entity.username}` : null,
        });
      }
    }
    await client.disconnect();
    return groups;
  } catch (error) {
    try { await client.disconnect(); } catch {}
    console.error("[Telegram] fetchAccountGroups error:", error.message);
    return null;
  }
}
