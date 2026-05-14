export const strings = {
  en: {
    welcome: (isForwarding, messageSet, accountCount) =>
      `🤖 *Thwaha Forwarder Bot*\n\n` +
      `📊 *Status*\n` +
      `• Accounts logged in: *${accountCount}*\n` +
      `• Message set: *${messageSet ? "✅ Yes" : "❌ No"}*\n` +
      `• Forwarding: *${isForwarding ? "🟢 ON" : "🔴 OFF"}*\n\n` +
      `What would you like to do?`,

    btnAddAccount: "➕ Add Account",
    btnBulkLogin: "📋 Bulk Login (CSV/TXT)",
    btnViewAccounts: "👥 View Accounts",
    btnSetMessage: "✉️ Set Message",
    btnJoinGroups: "ℹ️ Join Groups Info",
    btnSetInterval: "⏱ Set Interval",
    btnStartForwarding: "▶️ Start Forwarding",
    btnStopForwarding: "⏹ Stop Forwarding",
    btnAddAdmin: "👤 Add Admin",
    btnRemoveAdmin: "🗑 Remove Admin",
    btnLanguage: "🌐 Language: EN",
    btnBack: "« Back",

    addAdminPrompt:
      `👤 *Add New Admin*\n\n` +
      `Send me the user's *Telegram ID* (numeric) or *@username*.\n\n` +
      `Examples:\n` +
      `• \`123456789\`\n` +
      `• \`@johndoe\`\n\n` +
      `⚠️ If adding by username, the user must have previously started this bot.`,
    adminAdded: (id, username) =>
      `✅ Admin added!\n\nID: \`${id}\`${username ? `\nUsername: @${username}` : ""}`,
    adminAlreadyExists: "⚠️ That user is already an admin.",
    adminAddFail: "❌ Could not find that user. If using a username, the user must start the bot first so Telegram can resolve their ID.",

    removeAdminListHeader: "🗑 *Remove Admin*\n\nSelect an admin to remove:",
    noRemovableAdmins: "ℹ️ No removable admins found. Super admins cannot be removed.",
    removeAdminConfirmPrompt: (label) =>
      `⚠️ *Are you sure you want to remove* ${label} *as admin?*\n\nThis cannot be undone.`,
    btnConfirmRemove: "✅ Yes, remove",
    adminRemoved: (label) => `✅ Admin *${label}* has been removed.`,
    notSuperAdmin: "🚫 Only super admins can remove admins.",

    addAccountPrompt: "📱 Send me the phone number (with country code).\nExample: +919876543210",
    sendCodeSent: (phone) => `📨 OTP sent to *${phone}*. Please enter the code:`,
    sendCodeFail: (err) => `❌ Failed to send OTP: ${err}\n\nPlease check the number and try again.`,
    enterCode: "🔢 Enter the OTP you received:",
    enterPassword: "🔐 This account has 2FA enabled. Enter your password:",
    wrongPassword: "❌ Wrong password! Try again:",
    loginSuccess: (username, groups) => `✅ Account *@${username || "unknown"}* logged in!\n📌 Groups found: *${groups}*`,
    loginFail: (err) => `❌ Login failed: ${err}`,

    bulkUploadPrompt:
      `📋 *Bulk Login via CSV or TXT*\n\n` +
      `Upload a *.csv* or *.txt* file with one account per line.\n\n` +
      `*Format:*\n` +
      `\`phone,password\`\n` +
      `or just\n` +
      `\`phone\`\n\n` +
      `If a password is missing, I will ask for it when that account needs it.\n\n` +
      `Example:\n` +
      `\`\`\`\n+919876543210,mypassword\n+918765432109\n+917654321098,pass123\n\`\`\``,

    bulkStarting: (total) => `🚀 Starting bulk login for *${total}* accounts...`,
    bulkAccountProcessing: (phone, index, total) => `⏳ Processing account *${phone}* (${index}/${total})...`,
    bulkPasswordNeeded: (phone) => `🔐 Account *${phone}* needs a 2FA password.\nPlease enter it now:`,
    bulkComplete: (success, fail) => `✅ Bulk login complete!\n\n✅ Success: ${success}\n❌ Failed: ${fail}`,

    viewAccountsHeader: (count) => `👥 *Logged in accounts (${count}):*\n\n`,
    noAccounts: "ℹ️ No accounts logged in yet. Add one first!",
    accountLine: (username, number, groups, banned) =>
      `• *@${username || "unknown"}* (${number})\n  Groups: ${groups} | ${banned ? "🚫 Banned" : "✅ Active"}\n`,
    logoutPrompt: "Select an account to logout:",
    logoutConfirm: (number) => `✅ Account *${number}* logged out.`,
    logoutFail: "❌ Could not find that account.",

    setMessagePrompt:
      `✉️ *Set Forwarding Message*\n\n` +
      `Send me what you want to forward. It can be:\n` +
      `• 📝 A text message\n` +
      `• 🖼 A photo (with or without caption)\n` +
      `• 🎬 A video (with or without caption)\n` +
      `• 🎞 A GIF / Animation\n` +
      `• 📄 A document / file\n` +
      `• 🎵 An audio file\n\n` +
      `Just send it directly in this chat!`,
    messageSet: (type) => `✅ Message set! Type: *${type}*`,

    joinGroupsInfo:
      `ℹ️ *How to Join Groups*\n\n` +
      `Your userbot accounts must *manually join* the groups where you want to send messages.\n\n` +
      `*Steps:*\n` +
      `1. Open Telegram on your phone\n` +
      `2. Log into each account you added here\n` +
      `3. Join the target groups from each account\n` +
      `4. Come back here — the bot will detect the groups automatically\n\n` +
      `⚠️ The bot can only send to groups the account is already a member of.`,

    setIntervalPrompt: "⏱ *Set Forwarding Interval*\n\nHow often should messages be sent? Pick one or type a custom value in minutes:",
    intervalSet: (label) => `✅ Interval set to *${label}*`,
    intervalOptions: [
      { label: "Every 1 min", ms: 1 * 60 * 1000 },
      { label: "Every 2 min", ms: 2 * 60 * 1000 },
      { label: "Every 5 min", ms: 5 * 60 * 1000 },
      { label: "Every 10 min", ms: 10 * 60 * 1000 },
      { label: "Every 30 min", ms: 30 * 60 * 1000 },
      { label: "Every 1 hour", ms: 60 * 60 * 1000 },
      { label: "Every 3 hours", ms: 3 * 60 * 60 * 1000 },
      { label: "Every 6 hours", ms: 6 * 60 * 60 * 1000 },
    ],
    customIntervalPrompt: "⌨️ Type the interval in minutes (e.g. `2` for every 2 minutes):",
    invalidInterval: "❌ Invalid number. Please send a valid number of minutes.",

    forwardingStarted: "▶️ *Forwarding started!*\nMessages will now be sent on the configured interval.",
    forwardingStopped: "⏹ *Forwarding stopped.*",
    forwardingAlreadyOn: "⚠️ Forwarding is already running.",
    forwardingAlreadyOff: "⚠️ Forwarding is not running.",
    noMessageSet: "❌ Please set a message first before starting forwarding.",
    noAccountsForForwarding: "❌ No accounts with groups found. Make sure accounts are logged in and have joined groups.",
    noGroupsAnywhere: "⚠️ None of your accounts belong to any groups. Please join groups from the userbot accounts first.",

    adminNotifyBanned: (number) => `🚫 Account *${number}* has been *banned* by Telegram. It has been disabled.`,
    adminNotifyFrozen: (number) => `❄️ Account *${number}* appears to be *frozen/restricted*. It has been disabled.`,
    adminNotifyError: `🆘 A serious error occurred in the bot. Please contact the bot developer.`,

    forwardCycleReport: (sent, failed, accounts) =>
      `📨 Forward cycle done.\n✅ Sent: ${sent} | ❌ Failed: ${failed} | 👥 Accounts used: ${accounts}`,

    languageChanged: "✅ Language set to English.",
    notAdmin: "🚫 You are not authorized to use this bot.",
    cancelled: "✅ Cancelled.",
    error: "❌ An error occurred. Please try again.",
  },

  hi: {
    welcome: (isForwarding, messageSet, accountCount) =>
      `🤖 *Thwaha Forwarder Bot*\n\n` +
      `📊 *Status*\n` +
      `• Logged in accounts: *${accountCount}*\n` +
      `• Message set hai: *${messageSet ? "✅ Haan" : "❌ Nahi"}*\n` +
      `• Forwarding: *${isForwarding ? "🟢 Chal rahi hai" : "🔴 Band hai"}*\n\n` +
      `Kya karna chahte ho?`,

    btnAddAccount: "➕ Account Add Karo",
    btnBulkLogin: "📋 Bulk Login (CSV/TXT)",
    btnViewAccounts: "👥 Accounts Dekho",
    btnSetMessage: "✉️ Message Set Karo",
    btnJoinGroups: "ℹ️ Groups Join Karne Ki Info",
    btnSetInterval: "⏱ Interval Set Karo",
    btnStartForwarding: "▶️ Forwarding Shuru Karo",
    btnStopForwarding: "⏹ Forwarding Band Karo",
    btnAddAdmin: "👤 Admin Add Karo",
    btnRemoveAdmin: "🗑 Admin Hatao",
    btnLanguage: "🌐 Bhasha: HI",
    btnBack: "« Wapas",

    addAdminPrompt:
      `👤 *Naya Admin Add Karo*\n\n` +
      `User ka *Telegram ID* (number) ya *@username* bhejo.\n\n` +
      `Examples:\n` +
      `• \`123456789\`\n` +
      `• \`@johndoe\`\n\n` +
      `⚠️ Agar username se add kar rahe ho, toh user ne pehle is bot ko start kiya hona chahiye.`,
    adminAdded: (id, username) =>
      `✅ Admin add ho gaya!\n\nID: \`${id}\`${username ? `\nUsername: @${username}` : ""}`,
    adminAlreadyExists: "⚠️ Yeh user pehle se hi admin hai.",
    adminAddFail: "❌ Yeh user nahi mila. Username se add karte waqt, user ko pehle bot start karna hoga taaki Telegram unka ID resolve kar sake.",

    removeAdminListHeader: "🗑 *Admin Hatao*\n\nKonsa admin hatana hai? Chunna:",
    noRemovableAdmins: "ℹ️ Koi hatane wala admin nahi mila. Super admins ko nahi hataya ja sakta.",
    removeAdminConfirmPrompt: (label) =>
      `⚠️ *Kya tum sure ho ki* ${label} *ko admin se hatana chahte ho?*\n\nYeh wapas nahi ho sakta.`,
    btnConfirmRemove: "✅ Haan, hatao",
    adminRemoved: (label) => `✅ Admin *${label}* hata diya gaya.`,
    notSuperAdmin: "🚫 Sirf super admins hi admins ko hata sakte hain.",

    addAccountPrompt: "📱 Phone number bhejo (country code ke saath).\nExample: +919876543210",
    sendCodeSent: (phone) => `📨 OTP bheja gaya *${phone}* par. Code daalo:`,
    sendCodeFail: (err) => `❌ OTP nahi bheja ja saka: ${err}\n\nNumber check karo aur dobara try karo.`,
    enterCode: "🔢 Jo OTP mila woh daalo:",
    enterPassword: "🔐 Is account mein 2FA on hai. Apna password daalo:",
    wrongPassword: "❌ Galat password! Dobara try karo:",
    loginSuccess: (username, groups) => `✅ Account *@${username || "unknown"}* login ho gaya!\n📌 Groups mile: *${groups}*`,
    loginFail: (err) => `❌ Login fail hua: ${err}`,

    bulkUploadPrompt:
      `📋 *Bulk Login CSV ya TXT se*\n\n` +
      `Ek *.csv* ya *.txt* file upload karo — har line mein ek account.\n\n` +
      `*Format:*\n` +
      `\`phone,password\`\n` +
      `ya sirf\n` +
      `\`phone\`\n\n` +
      `Agar password missing hai, toh main baad mein maangunga.\n\n` +
      `Example:\n` +
      `\`\`\`\n+919876543210,merapassword\n+918765432109\n+917654321098,pass123\n\`\`\``,

    bulkStarting: (total) => `🚀 *${total}* accounts ka bulk login shuru ho raha hai...`,
    bulkAccountProcessing: (phone, index, total) => `⏳ Account *${phone}* (${index}/${total}) process ho raha hai...`,
    bulkPasswordNeeded: (phone) => `🔐 Account *${phone}* ka 2FA password chahiye.\nAbhi daalo:`,
    bulkComplete: (success, fail) => `✅ Bulk login complete!\n\n✅ Kamiyab: ${success}\n❌ Fail: ${fail}`,

    viewAccountsHeader: (count) => `👥 *Login kiye hue accounts (${count}):*\n\n`,
    noAccounts: "ℹ️ Abhi koi account login nahi hai. Pehle add karo!",
    accountLine: (username, number, groups, banned) =>
      `• *@${username || "unknown"}* (${number})\n  Groups: ${groups} | ${banned ? "🚫 Ban hua" : "✅ Active"}\n`,
    logoutPrompt: "Konsa account logout karna hai?",
    logoutConfirm: (number) => `✅ Account *${number}* logout ho gaya.`,
    logoutFail: "❌ Woh account nahi mila.",

    setMessagePrompt:
      `✉️ *Forwarding Message Set Karo*\n\n` +
      `Jo message forward karna hai woh bhejo. Yeh ho sakta hai:\n` +
      `• 📝 Text message\n` +
      `• 🖼 Photo (caption ke saath ya bina)\n` +
      `• 🎬 Video (caption ke saath ya bina)\n` +
      `• 🎞 GIF / Animation\n` +
      `• 📄 Document / File\n` +
      `• 🎵 Audio file\n\n` +
      `Seedha is chat mein bhej do!`,
    messageSet: (type) => `✅ Message set ho gaya! Type: *${type}*`,

    joinGroupsInfo:
      `ℹ️ *Groups Kaise Join Karein*\n\n` +
      `Tumhare userbot accounts ko *manually* un groups mein join karna hoga jahan message bhejne hain.\n\n` +
      `*Steps:*\n` +
      `1. Apne phone par Telegram kholna\n` +
      `2. Har added account se login karna\n` +
      `3. Target groups join karna\n` +
      `4. Yahan wapas aana — bot khud groups detect kar lega\n\n` +
      `⚠️ Bot sirf unhi groups mein bhej sakta hai jisme account already member hai.`,

    setIntervalPrompt: "⏱ *Forwarding Interval Set Karo*\n\nKitni der baad message bhejne chahiye? Neeche se chuno ya khud minutes mein type karo:",
    intervalSet: (label) => `✅ Interval set ho gaya: *${label}*`,
    intervalOptions: [
      { label: "Har 1 min", ms: 1 * 60 * 1000 },
      { label: "Har 2 min", ms: 2 * 60 * 1000 },
      { label: "Har 5 min", ms: 5 * 60 * 1000 },
      { label: "Har 10 min", ms: 10 * 60 * 1000 },
      { label: "Har 30 min", ms: 30 * 60 * 1000 },
      { label: "Har 1 ghanta", ms: 60 * 60 * 1000 },
      { label: "Har 3 ghante", ms: 3 * 60 * 60 * 1000 },
      { label: "Har 6 ghante", ms: 6 * 60 * 60 * 1000 },
    ],
    customIntervalPrompt: "⌨️ Minutes mein number type karo (e.g. `2` matlab har 2 minute):",
    invalidInterval: "❌ Galat number. Sahi minutes ka number daalo.",

    forwardingStarted: "▶️ *Forwarding shuru ho gayi!*\nMessages configured interval par bheje jaayenge.",
    forwardingStopped: "⏹ *Forwarding band ho gayi.*",
    forwardingAlreadyOn: "⚠️ Forwarding already chal rahi hai.",
    forwardingAlreadyOff: "⚠️ Forwarding chal nahi rahi hai.",
    noMessageSet: "❌ Pehle message set karo, phir forwarding start karo.",
    noAccountsForForwarding: "❌ Koi bhi account groups mein nahi hai. Accounts login karo aur groups join karo.",
    noGroupsAnywhere: "⚠️ Kisi bhi account mein koi group nahi hai. Pehle userbot accounts se groups join karo.",

    adminNotifyBanned: (number) => `🚫 Account *${number}* Telegram ne *ban* kar diya. Ise disable kar diya gaya hai.`,
    adminNotifyFrozen: (number) => `❄️ Account *${number}* *freeze/restrict* lag raha hai. Ise disable kar diya gaya hai.`,
    adminNotifyError: `🆘 Bot mein ek serious error aaya. Bot developer se contact karo.`,

    forwardCycleReport: (sent, failed, accounts) =>
      `📨 Forward cycle complete.\n✅ Bheja: ${sent} | ❌ Fail: ${failed} | 👥 Accounts use hue: ${accounts}`,

    languageChanged: "✅ Bhasha Hindi (Romanized) set ho gayi.",
    notAdmin: "🚫 Tumhe is bot ko use karne ki permission nahi hai.",
    cancelled: "✅ Cancel ho gaya.",
    error: "❌ Kuch error aaya. Dobara try karo.",
  },
};

export async function getLang(System) {
  const doc = await System.findOne({});
  return doc?.language || "en";
}

export function t(strings, lang) {
  return strings[lang] || strings["en"];
}
