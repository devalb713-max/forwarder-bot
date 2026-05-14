import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import express from "express";
import { connectDB } from "./db.js";
import { System, Admin } from "./db.js";
import launchBot from "./launchbot.js";
import { startForwarding, stopForwarding, isForwardingActive } from "./forwarder.js";
import { getSession, setSession, clearSession } from "./sessions.js";
import {
  isAdmin,
  handleStart,
  handleAddAccount,
  handleBulkLogin,
  handleViewAccounts,
  handleLogout,
  handleSetMessage,
  handleJoinGroupsInfo,
  handleSetInterval,
  handleSetIntervalMs,
  handleSetIntervalCustom,
  handleConfirmInterval,
  handleStartForwarding,
  handleStopForwarding,
  handleToggleLanguage,
  handleText,
  handleDocument,
  handlePhoto,
  handleVideo,
  handleAnimation,
  handleAudio,
  handleBulkCode,
  handleCancel,
  handleAddAdmin,
  handleRemoveAdmin,
  handleRemoveAdminSelect,
  handleRemoveAdminDo,
} from "./handlers.js";
import { strings } from "./i18n.js";

// ─── Express ──────────────────────────────────────────────────────────────────

const app = express();
app.get("/ping", (_req, res) => res.send("hello world"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// ─── Bot ──────────────────────────────────────────────────────────────────────

const bot = new Telegraf(process.env.BOT_TOKEN);
global.bot = bot;

bot.catch((err, ctx) => {
  const msg = err && err.message || "";
  if (msg.includes("TIMEOUT") || msg.includes("ETELEGRAM") || msg.includes("409")) return;
  console.error("[bot.catch] Update " + (ctx && ctx.update && ctx.update.update_id) + ":", err.message);
});

// ── Admin guard middleware ────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const allowed = await isAdmin(userId, ctx.from?.username);
  if (!allowed) {
    let lang = "en";
    try {
      const sys = await System.findOne({});
      lang = sys?.language || "en";
    } catch {}
    const s = strings[lang];
    if (ctx.callbackQuery) await ctx.answerCbQuery(s.notAdmin);
    else await ctx.reply(s.notAdmin);
    return;
  }

  return next();
});

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.start(handleStart);
bot.command("cancel", handleCancel);

bot.command("whoami", async (ctx) => {
  const id = ctx.from.id.toString();
  const username = ctx.from.username ? `@${ctx.from.username}` : "none";
  await ctx.reply(`ID: \`${id}\`\nUsername: ${username}`, { parse_mode: "Markdown" });
});

// ─── Callback Actions ─────────────────────────────────────────────────────────

bot.action("back_main", handleStart);
bot.action("cancel", handleCancel);
bot.action("add_account", handleAddAccount);
bot.action("bulk_login", handleBulkLogin);
bot.action("view_accounts", handleViewAccounts);
bot.action("set_message", handleSetMessage);
bot.action("join_groups_info", handleJoinGroupsInfo);
bot.action("set_interval", handleSetInterval);
bot.action(/^set_interval_ms:(\d+)$/, handleSetIntervalMs);
bot.action("set_interval_custom", handleSetIntervalCustom);
bot.action(/^confirm_interval:(\d+)$/, handleConfirmInterval);
bot.action("start_forwarding", handleStartForwarding);
bot.action("stop_forwarding", handleStopForwarding);
bot.action("toggle_language", handleToggleLanguage);
bot.action("add_admin", handleAddAdmin);
bot.action("remove_admin", handleRemoveAdmin);
bot.action(/^remove_admin_select:(.+)$/, handleRemoveAdminSelect);
bot.action(/^remove_admin_do:(.+)$/, handleRemoveAdminDo);
bot.action(/^logout:(.+)$/, handleLogout);

// ─── Message Handlers ─────────────────────────────────────────────────────────

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const session = getSession(userId);

  if (session?.step === "awaiting_bulk_code") {
    let lang = "en";
    try { const sys = await System.findOne({}); lang = sys?.language || "en"; } catch {}
    const s = strings[lang];
    await handleBulkCode(ctx, session, s);
    return;
  }

  await handleText(ctx);
});

bot.on("document", handleDocument);
bot.on("photo", handlePhoto);
bot.on("video", handleVideo);
bot.on("animation", handleAnimation);
bot.on("audio", handleAudio);
bot.on("voice", handleAudio);

// ─── Init ─────────────────────────────────────────────────────────────────────

async function main() {
  await connectDB();

  await bot.telegram.setMyCommands([
    { command: "start", description: "Open main menu" },
    { command: "cancel", description: "Cancel current operation" },
    { command: "whoami", description: "Show your Telegram ID" },
  ]);

  launchBot(bot);

  try {
    const sys = await System.findOne({});
    if (sys?.forwardingActive) {
      console.log("▶️ Resuming forwarding from previous session...");
      await startForwarding();
    }
  } catch (e) {
    console.error("Could not resume forwarding:", e.message);
  }

  const shutdown = async (signal) => {
    console.log(`\n⏳ ${signal} received — shutting down...`);
    stopForwarding();
    bot.stop(signal);
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("❌ Failed to start:", e);
  process.exit(1);
});

// ─── Global error guards ──────────────────────────────────────────────────────

process.on("unhandledRejection", (reason) => {
  const msg = reason?.message || reason?.toString() || "";
  if (msg.includes("TIMEOUT") || msg.includes("ETELEGRAM")) return;
  console.error("⚠️ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  const msg = error?.message || "";
  if (msg.includes("TIMEOUT") || msg.includes("ETELEGRAM")) return;
  console.error("⚠️ Uncaught Exception:", error);

  try {
    Admin.find({}).then((admins) => {
      for (const admin of admins) {
        global.bot?.telegram
          .sendMessage(admin.userId, `🆘 A serious error occurred in the bot. Please contact the bot developer.\n\n\`${msg.slice(0, 300)}\``, { parse_mode: "Markdown" })
          .catch(() => {});
      }
    });
  } catch {}
});