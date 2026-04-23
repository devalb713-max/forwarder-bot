const launchBot = (bot) => {
  bot.telegram
    .getMe()
    .then((botInfo) => {
      console.log(`✅ Bot @${botInfo.username} connected and running.`);
      bot.launch({
        allowedUpdates: ["message", "edited_message", "callback_query"],
      });
    })
    .catch((err) => {
      console.error("Error connecting bot:", err.message);
      console.log("Retrying in 3s...");
      setTimeout(() => launchBot(bot), 3000);
    });
};

export default launchBot;
