import { Account, System, BatchQueue, Admin } from "./db.js";
import { strings } from "./i18n.js";
import { sendCodeWithRetry, loginWithCode, loginWith2FA, createClient, fetchAccountGroups } from "./telegram.js";
import { parseBulkFile } from "./csvParser.js";
import { getSession, setSession, clearSession } from "./sessions.js";
import { startForwarding, stopForwarding, isForwardingActive, restartForwardingWithNewInterval } from "./forwarder.js";
import fetch from "node-fetch";

// ─── Risk thresholds ──────────────────────────────────────────────────────────
// < 5 min  → high risk (red warning, strong language)
// 5–9 min  → moderate risk (yellow warning, softer)
// >= 10min → safe, no warning

function getIntervalRisk(ms) {
  const mins = ms / 60000;
  if (mins < 5) return "high";
  if (mins < 10) return "moderate";
  return "safe";
}

function riskWarningText(ms, lang) {
  const mins = Math.round(ms / 60000);
  const risk = getIntervalRisk(ms);

  if (lang === "hi") {
    if (risk === "high") {
      return (
        `⚠️ *Yeh bahut risky setting hai!*\n\n` +
        `Har *${mins} minute* mein bhejne se Telegram ko pata chal sakta hai ki tum spam kar rahe ho.\n` +
        `Accounts ban ho sakte hain — *permanently*.\n\n` +
        `✅ Recommended minimum: *10 minutes*\n\n` +
        `Kya tum phir bhi yahi interval use karna chahte ho?`
      );
    }
    return (
      `⚠️ *Thodi risky setting hai.*\n\n` +
      `Har *${mins} minute* mein bhejne par accounts flag ho sakte hain.\n\n` +
      `✅ Recommended: *10 minutes ya zyada*\n\n` +
      `Kya tum confirm karte ho?`
    );
  }

  if (risk === "high") {
    return (
      `⚠️ *This is a very risky setting!*\n\n` +
      `Sending every *${mins} minute(s)* is likely to trigger Telegram's spam detection.\n` +
      `Your accounts could get banned — *permanently*.\n\n` +
      `✅ Recommended minimum: *10 minutes*\n\n` +
      `Do you still want to use this interval?`
    );
  }
  return (
    `⚠️ *This is a slightly risky setting.*\n\n` +
    `Sending every *${mins} minutes* may flag your accounts over time.\n\n` +
    `✅ Recommended: *10 minutes or more*\n\n` +
    `Do you want to proceed anyway?`
  );
}

function riskConfirmKeyboard(ms, lang) {
  const yes = lang === "hi" ? "✅ Haan, proceed karo" : "✅ Yes, proceed anyway";
  const no  = lang === "hi" ? "🔙 Nahi, interval change karo" : "🔙 No, let me change it";
  return {
    inline_keyboard: [
      [{ text: yes, callback_data: `confirm_interval:${ms}` }],
      [{ text: no,  callback_data: "set_interval" }],
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function isAdmin(userId) {
  const id = userId?.toString();
  if (!id) return false;
  const admin = await Admin.findOne({ userId: id });
  return !!admin;
}

async function getSys() {
  let doc = await System.findOne({});
  if (!doc) { doc = new System({}); await doc.save(); }
  return doc;
}

async function getLangStrings(ctx) {
  const sys = await getSys();
  const lang = sys.language || "en";
  return { s: strings[lang], lang };
}

function mainKeyboard(s, isForwarding) {
  return {
    inline_keyboard: [
      [{ text: s.btnAddAccount, callback_data: "add_account" }, { text: s.btnBulkLogin, callback_data: "bulk_login" }],
      [{ text: s.btnViewAccounts, callback_data: "view_accounts" }],
      [{ text: s.btnSetMessage, callback_data: "set_message" }, { text: s.btnJoinGroups, callback_data: "join_groups_info" }],
      [{ text: s.btnSetInterval, callback_data: "set_interval" }],
      isForwarding
        ? [{ text: s.btnStopForwarding, callback_data: "stop_forwarding" }]
        : [{ text: s.btnStartForwarding, callback_data: "start_forwarding" }],
      [{ text: s.btnAddAdmin, callback_data: "add_admin" }],
      [{ text: s.btnLanguage, callback_data: "toggle_language" }],
    ],
  };
}

// ─── Apply interval (shared by preset, custom, and confirm paths) ─────────────

async function applyInterval(ctx, ms, s, lang) {
  const sys = await getSys();
  sys.intervalMs = ms;
  await sys.save();
  await restartForwardingWithNewInterval();

  const mins = ms / 60000;
  const label = s.intervalOptions?.find((o) => o.ms === ms)?.label || `${mins} min`;

  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(s.intervalSet(label), {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
  });
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function handleCancel(ctx) {
  const userId = ctx.from.id;
  const session = getSession(userId);

  if (session?.client) {
    try { await session.client.disconnect(); } catch {}
  }

  clearSession(userId);
  const { s } = await getLangStrings(ctx);

  if (ctx.callbackQuery) await ctx.answerCbQuery();

  await ctx.reply(s.cancelled, {
    parse_mode: "Markdown",
    reply_markup: mainKeyboard(s, isForwardingActive()),
  });
}

// ─── Main Menu ────────────────────────────────────────────────────────────────

export async function handleStart(ctx) {
  try {
    const { s } = await getLangStrings(ctx);
    const sys = await getSys();
    const accountCount = await Account.countDocuments({ banned: false, frozen: false });
    const messageSet = !!(sys.message?.text || sys.message?.fileId);
    const forwarding = isForwardingActive();

    const text = s.welcome(forwarding, messageSet, accountCount);
    const reply_markup = mainKeyboard(s, forwarding);

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup });
      } catch {
        await ctx.reply(text, { parse_mode: "Markdown", reply_markup });
      }
      await ctx.answerCbQuery();
    } else {
      await ctx.reply(text, { parse_mode: "Markdown", reply_markup });
    }
  } catch (e) {
    console.error("[handleStart]", e);
  }
}

// ─── Single Account Login ─────────────────────────────────────────────────────

export async function handleAddAccount(ctx) {
  const { s } = await getLangStrings(ctx);
  setSession(ctx.from.id, { step: "awaiting_phone" });
  await ctx.answerCbQuery?.();
  await ctx.reply(s.addAccountPrompt, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: s.btnBack, callback_data: "back_main" }],
        [{ text: "❌ Cancel", callback_data: "cancel" }],
      ],
    },
  });
}

// ─── Bulk Login ───────────────────────────────────────────────────────────────

export async function handleBulkLogin(ctx) {
  const { s } = await getLangStrings(ctx);
  setSession(ctx.from.id, { step: "awaiting_bulk_file" });
  await ctx.answerCbQuery?.();
  await ctx.reply(s.bulkUploadPrompt, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: s.btnBack, callback_data: "back_main" }],
        [{ text: "❌ Cancel", callback_data: "cancel" }],
      ],
    },
  });
}

// ─── View Accounts ────────────────────────────────────────────────────────────

export async function handleViewAccounts(ctx) {
  const { s } = await getLangStrings(ctx);
  await ctx.answerCbQuery?.();

  const accounts = await Account.find({});
  if (!accounts.length) {
    return ctx.reply(s.noAccounts, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }

  let text = s.viewAccountsHeader(accounts.length);
  const logoutButtons = [];

  for (const acc of accounts) {
    text += s.accountLine(acc.username, acc.number, acc.groups?.length || 0, acc.banned || acc.frozen);
    logoutButtons.push([{ text: `🚪 Logout ${acc.number}`, callback_data: `logout:${acc.number}` }]);
  }

  logoutButtons.push([{ text: s.btnBack, callback_data: "back_main" }]);

  await ctx.reply(text, { parse_mode: "Markdown", reply_markup: { inline_keyboard: logoutButtons } });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function handleLogout(ctx) {
  const { s } = await getLangStrings(ctx);
  const number = ctx.match[1];
  await ctx.answerCbQuery();

  const deleted = await Account.findOneAndDelete({ number });
  if (!deleted) {
    return ctx.reply(s.logoutFail, { parse_mode: "Markdown" });
  }
  await ctx.reply(s.logoutConfirm(number), {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
  });
}

// ─── Set Message ──────────────────────────────────────────────────────────────

export async function handleSetMessage(ctx) {
  const { s } = await getLangStrings(ctx);
  setSession(ctx.from.id, { step: "awaiting_message" });
  await ctx.answerCbQuery?.();
  await ctx.reply(s.setMessagePrompt, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: s.btnBack, callback_data: "back_main" }],
        [{ text: "❌ Cancel", callback_data: "cancel" }],
      ],
    },
  });
}

// ─── Join Groups Info ─────────────────────────────────────────────────────────

export async function handleJoinGroupsInfo(ctx) {
  const { s } = await getLangStrings(ctx);
  await ctx.answerCbQuery?.();
  await ctx.reply(s.joinGroupsInfo, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
  });
}

// ─── Set Interval ─────────────────────────────────────────────────────────────

export async function handleSetInterval(ctx) {
  const { s } = await getLangStrings(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const buttons = s.intervalOptions.map((opt) => [
    { text: opt.label, callback_data: `set_interval_ms:${opt.ms}` },
  ]);
  buttons.push([{ text: "✏️ Custom", callback_data: "set_interval_custom" }]);
  buttons.push([{ text: s.btnBack, callback_data: "back_main" }]);

  const text = ctx.callbackQuery
    ? ctx.callbackQuery.message?.text
    : null;

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(s.setIntervalPrompt, { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
    } else {
      await ctx.reply(s.setIntervalPrompt, { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
    }
  } catch {
    await ctx.reply(s.setIntervalPrompt, { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
  }
}

// Called when user picks a preset interval button
export async function handleSetIntervalMs(ctx) {
  const { s, lang } = await getLangStrings(ctx);
  const ms = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  const risk = getIntervalRisk(ms);
  if (risk !== "safe") {
    // Show risk warning and ask to confirm
    await ctx.reply(riskWarningText(ms, lang), {
      parse_mode: "Markdown",
      reply_markup: riskConfirmKeyboard(ms, lang),
    });
    return;
  }

  await applyInterval(ctx, ms, s, lang);
}

// Called when user confirms a risky interval
export async function handleConfirmInterval(ctx) {
  const { s, lang } = await getLangStrings(ctx);
  const ms = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  await applyInterval(ctx, ms, s, lang);
}

export async function handleSetIntervalCustom(ctx) {
  const { s } = await getLangStrings(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery();
  setSession(ctx.from.id, { step: "awaiting_custom_interval" });
  await ctx.reply(s.customIntervalPrompt, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: s.btnBack, callback_data: "set_interval" }],
        [{ text: "❌ Cancel", callback_data: "cancel" }],
      ],
    },
  });
}

// ─── Start / Stop Forwarding ──────────────────────────────────────────────────

export async function handleStartForwarding(ctx) {
  const { s } = await getLangStrings(ctx);
  await ctx.answerCbQuery();

  const sys = await getSys();
  if (!sys.message?.text && !sys.message?.fileId) {
    return ctx.reply(s.noMessageSet, { parse_mode: "Markdown" });
  }

  const accountsWithGroups = await Account.countDocuments({
    banned: false,
    frozen: false,
    "groups.0": { $exists: true },
  });

  if (!accountsWithGroups) {
    return ctx.reply(s.noAccountsForForwarding, { parse_mode: "Markdown" });
  }

  if (isForwardingActive()) {
    return ctx.reply(s.forwardingAlreadyOn, { parse_mode: "Markdown" });
  }

  sys.forwardingActive = true;
  await sys.save();
  await startForwarding();

  await ctx.reply(s.forwardingStarted, {
    parse_mode: "Markdown",
    reply_markup: mainKeyboard(s, true),
  });
}

export async function handleStopForwarding(ctx) {
  const { s } = await getLangStrings(ctx);
  await ctx.answerCbQuery();

  if (!isForwardingActive()) {
    return ctx.reply(s.forwardingAlreadyOff, { parse_mode: "Markdown" });
  }

  const sys = await getSys();
  sys.forwardingActive = false;
  await sys.save();
  stopForwarding();

  await ctx.reply(s.forwardingStopped, {
    parse_mode: "Markdown",
    reply_markup: mainKeyboard(s, false),
  });
}

// ─── Language Toggle ──────────────────────────────────────────────────────────

export async function handleToggleLanguage(ctx) {
  await ctx.answerCbQuery();
  const sys = await getSys();
  sys.language = sys.language === "en" ? "hi" : "en";
  await sys.save();

  const s = strings[sys.language];
  await ctx.reply(s.languageChanged, { parse_mode: "Markdown" });
  await handleStart(ctx);
}

// ─── Add Admin ────────────────────────────────────────────────────────────────

export async function handleAddAdmin(ctx) {
  const { s } = await getLangStrings(ctx);
  setSession(ctx.from.id, { step: "awaiting_admin_input" });
  await ctx.answerCbQuery?.();
  await ctx.reply(s.addAdminPrompt, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: s.btnBack, callback_data: "back_main" }],
        [{ text: "❌ Cancel", callback_data: "cancel" }],
      ],
    },
  });
}

// ─── Text Message Handler (multi-step router) ─────────────────────────────────

export async function handleText(ctx) {
  const userId = ctx.from.id;
  const session = getSession(userId);
  const { s, lang } = await getLangStrings(ctx);
  const text = ctx.message.text.trim();

  if (text === "/cancel") {
    await handleCancel(ctx);
    return;
  }

  if (!session) return;

  // ── Phone number step ────────────────────────────────────────────────────
  if (session.step === "awaiting_phone") {
    const phone = text;
    await ctx.reply(`⏳ Sending OTP to ${phone}...`);

    const client = createClient("");
    await client.connect();

    const result = await sendCodeWithRetry(client, phone);
    if (!result.success) {
      clearSession(userId);
      return ctx.reply(s.sendCodeFail(result.error), { parse_mode: "Markdown" });
    }

    const activeClient = result.client || client;

    setSession(userId, {
      step: "awaiting_code",
      phone,
      phoneCodeHash: result.phoneCodeHash,
      client: activeClient,
    });

    await ctx.reply(s.sendCodeSent(phone), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]] },
    });
    return;
  }

  // ── OTP code step ────────────────────────────────────────────────────────
  if (session.step === "awaiting_code") {
    const code = text;
    const { phone, phoneCodeHash, client } = session;

    const result = await loginWithCode(client, phone, phoneCodeHash, code);

    if (result.success) {
      await _saveAccountFromLoginResult(result, phone);
      clearSession(userId);
      return ctx.reply(s.loginSuccess(result.username, result.groupCount), {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
      });
    }

    if (result.needsPassword) {
      setSession(userId, { ...session, step: "awaiting_password" });
      return ctx.reply(s.enterPassword, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]] },
      });
    }

    clearSession(userId);
    return ctx.reply(s.loginFail(result.error), { parse_mode: "Markdown" });
  }

  // ── 2FA password step ────────────────────────────────────────────────────
  if (session.step === "awaiting_password") {
    const password = text;
    const { phone, client } = session;

    const result = await loginWith2FA(client, phone, password);

    if (result.wrongPassword) {
      return ctx.reply(s.wrongPassword, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]] },
      });
    }

    if (result.success) {
      await _saveAccountFromLoginResult(result, phone);
      clearSession(userId);
      return ctx.reply(s.loginSuccess(result.username, result.groupCount), {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
      });
    }

    clearSession(userId);
    return ctx.reply(s.loginFail(result.error), { parse_mode: "Markdown" });
  }

  // ── Set message (plain text) ─────────────────────────────────────────────
  if (session.step === "awaiting_message") {
    const sys = await getSys();
    sys.message = { type: "text", text, fileId: null, caption: null };
    await sys.save();
    clearSession(userId);
    return ctx.reply(s.messageSet("text"), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }

  // ── Custom interval step ─────────────────────────────────────────────────
  if (session.step === "awaiting_custom_interval") {
    const mins = parseFloat(text);
    if (isNaN(mins) || mins <= 0) {
      return ctx.reply(s.invalidInterval, { parse_mode: "Markdown" });
    }
    const ms = Math.round(mins * 60 * 1000);
    clearSession(userId);

    const risk = getIntervalRisk(ms);
    if (risk !== "safe") {
      await ctx.reply(riskWarningText(ms, lang), {
        parse_mode: "Markdown",
        reply_markup: riskConfirmKeyboard(ms, lang),
      });
      return;
    }

    await applyInterval(ctx, ms, s, lang);
    return;
  }

  // ── Add admin step ───────────────────────────────────────────────────────
  if (session.step === "awaiting_admin_input") {
    const input = text.trim();
    clearSession(userId);

    let targetId = null;
    let targetUsername = null;

    if (/^\d+$/.test(input)) {
      targetId = input;
    } else {
      const usernameArg = input.startsWith("@") ? input.slice(1) : input;
      if (ctx.from.username && ctx.from.username.toLowerCase() === usernameArg.toLowerCase()) {
        targetId = ctx.from.id.toString();
        targetUsername = ctx.from.username;
      }
    }

    if (!targetId) {
      return ctx.reply(s.adminAddFail, { parse_mode: "Markdown" });
    }

    const existing = await Admin.findOne({ userId: targetId });
    if (existing) {
      return ctx.reply(s.adminAlreadyExists, { parse_mode: "Markdown" });
    }

    await Admin.create({ userId: targetId, username: targetUsername });
    return ctx.reply(s.adminAdded(targetId, targetUsername), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }

  // ── Bulk password step (mid-batch) ───────────────────────────────────────
  if (session.step === "awaiting_bulk_password") {
    const password = text;
    await _processBulkPassword(ctx, session, password, s);
    return;
  }
}

// ─── Document / Media Handlers ────────────────────────────────────────────────

export async function handleDocument(ctx) {
  const userId = ctx.from.id;
  const session = getSession(userId);
  const { s } = await getLangStrings(ctx);

  if (session?.step === "awaiting_bulk_file") {
    const doc = ctx.message.document;
    if (!doc) return;

    const filename = doc.file_name || "";
    const ext = filename.split(".").pop().toLowerCase();
    if (!["csv", "txt"].includes(ext)) {
      return ctx.reply("❌ Please upload a .csv or .txt file.", { parse_mode: "Markdown" });
    }

    await ctx.reply("⏳ Parsing file...");

    try {
      const fileLink = await ctx.telegram.getFileLink(doc.file_id);
      const response = await fetch(fileLink.href);
      const content = await response.text();

      const rows = parseBulkFile(content, filename);
      if (!rows.length) {
        clearSession(userId);
        return ctx.reply("❌ No valid rows found in the file.", { parse_mode: "Markdown" });
      }

      clearSession(userId);
      await ctx.reply(s.bulkStarting(rows.length), { parse_mode: "Markdown" });
      await _processBulkRows(ctx, rows, s);
    } catch (e) {
      console.error("[BulkUpload] Error:", e);
      clearSession(userId);
      await ctx.reply(s.error, { parse_mode: "Markdown" });
    }
    return;
  }

  if (session?.step === "awaiting_message") {
    const doc = ctx.message.document;
    const caption = ctx.message.caption || null;
    const sys = await getSys();
    sys.message = { type: "document", fileId: doc.file_id, caption, text: null };
    await sys.save();
    clearSession(userId);
    return ctx.reply(s.messageSet("document"), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }
}

export async function handlePhoto(ctx) {
  const userId = ctx.from.id;
  const session = getSession(userId);
  const { s } = await getLangStrings(ctx);

  if (session?.step === "awaiting_message") {
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    const caption = ctx.message.caption || null;
    const sys = await getSys();
    sys.message = { type: "photo", fileId, caption, text: null };
    await sys.save();
    clearSession(userId);
    return ctx.reply(s.messageSet("photo"), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }
}

export async function handleVideo(ctx) {
  const userId = ctx.from.id;
  const session = getSession(userId);
  const { s } = await getLangStrings(ctx);

  if (session?.step === "awaiting_message") {
    const video = ctx.message.video;
    const caption = ctx.message.caption || null;
    const sys = await getSys();
    sys.message = { type: "video", fileId: video.file_id, caption, text: null };
    await sys.save();
    clearSession(userId);
    return ctx.reply(s.messageSet("video"), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }
}

export async function handleAnimation(ctx) {
  const userId = ctx.from.id;
  const session = getSession(userId);
  const { s } = await getLangStrings(ctx);

  if (session?.step === "awaiting_message") {
    const gif = ctx.message.animation;
    const caption = ctx.message.caption || null;
    const sys = await getSys();
    sys.message = { type: "animation", fileId: gif.file_id, caption, text: null };
    await sys.save();
    clearSession(userId);
    return ctx.reply(s.messageSet("GIF/animation"), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }
}

export async function handleAudio(ctx) {
  const userId = ctx.from.id;
  const session = getSession(userId);
  const { s } = await getLangStrings(ctx);

  if (session?.step === "awaiting_message") {
    const audio = ctx.message.audio || ctx.message.voice;
    const sys = await getSys();
    sys.message = { type: "audio", fileId: audio.file_id, caption: null, text: null };
    await sys.save();
    clearSession(userId);
    return ctx.reply(s.messageSet("audio"), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }
}

// ─── Bulk Processing Internals ────────────────────────────────────────────────

async function _processBulkRows(ctx, rows, s) {
  let success = 0;
  let fail = 0;

  for (let i = 0; i < rows.length; i++) {
    const { phone, password } = rows[i];

    await ctx.reply(s.bulkAccountProcessing(phone, i + 1, rows.length), { parse_mode: "Markdown" });

    try {
      const client = createClient("");
      await client.connect();

      const codeResult = await sendCodeWithRetry(client, phone);
      if (!codeResult.success) {
        fail++;
        await ctx.reply(`❌ ${phone}: Could not send OTP — ${codeResult.error}`);
        continue;
      }

      const activeClient = codeResult.client || client;

      setSession(ctx.from.id, {
        step: "awaiting_bulk_code",
        phone,
        phoneCodeHash: codeResult.phoneCodeHash,
        client: activeClient,
        password: password || null,
        remainingRows: rows.slice(i + 1),
        successCount: success,
        failCount: fail,
        totalRows: rows.length,
      });

      await ctx.reply(
        `📨 OTP sent to *${phone}*. Please send the code now:\n\nSend /cancel to abort the entire bulk login.`,
        { parse_mode: "Markdown" }
      );

      return;
    } catch (e) {
      fail++;
      await ctx.reply(`❌ ${phone}: Error — ${e.message}`);
    }
  }

  await ctx.reply(s.bulkComplete(success, fail), {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
  });
}

async function _processBulkPassword(ctx, session, password, s) {
  const { phone, client } = session;

  const result = await loginWith2FA(client, phone, password);

  if (result.wrongPassword) {
    await ctx.reply(s.wrongPassword, { parse_mode: "Markdown" });
    return;
  }

  let { successCount, failCount, remainingRows } = session;

  if (result.success) {
    await _saveAccountFromLoginResult(result, phone);
    successCount++;
    await ctx.reply(s.loginSuccess(result.username, result.groupCount), { parse_mode: "Markdown" });
  } else {
    failCount++;
    await ctx.reply(`❌ ${phone}: ${result.error}`);
  }

  clearSession(ctx.from.id);

  if (remainingRows.length) {
    await _processBulkRows(ctx, remainingRows, s);
  } else {
    await ctx.reply(s.bulkComplete(successCount, failCount), {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: s.btnBack, callback_data: "back_main" }]] },
    });
  }
}

export async function handleBulkCode(ctx, session, s) {
  const code = ctx.message.text.trim();
  const { phone, phoneCodeHash, client, password, remainingRows, successCount, failCount } = session;

  const result = await loginWithCode(client, phone, phoneCodeHash, code, password || undefined);

  if (result.success) {
    await _saveAccountFromLoginResult(result, phone);
    await ctx.reply(s.loginSuccess(result.username, result.groupCount), { parse_mode: "Markdown" });
    clearSession(ctx.from.id);
    await _processBulkRows(ctx, remainingRows, s);
    return;
  }

  if (result.needsPassword) {
    setSession(ctx.from.id, { ...session, step: "awaiting_bulk_password", successCount, failCount });
    await ctx.reply(s.bulkPasswordNeeded(phone), { parse_mode: "Markdown" });
    return;
  }

  clearSession(ctx.from.id);
  await ctx.reply(`❌ ${phone}: ${result.error}`);
  await _processBulkRows(ctx, remainingRows, s);
}

// ─── Save account to DB ───────────────────────────────────────────────────────

async function _saveAccountFromLoginResult(result, phoneFallback) {
  const phone = result.phoneNumber || phoneFallback;

  await Account.findOneAndUpdate(
    { number: phone },
    {
      $set: {
        number: phone,
        username: result.username || null,
        session: result.session,
        groups: result.groups || [],
        banned: false,
        frozen: false,
        currentGroupIndex: 0,
      },
    },
    { upsert: true, new: true }
  );
  console.log(`[Auth] Saved account: ${phone} (${result.username})`);
}