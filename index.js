const { Telegraf, Markup, session } = require("telegraf");
const mongoose = require("mongoose");
const express = require("express");

// Constants (Directly included)
const BOT_TOKEN = "";
const MONGODB_URI = "mongodb+srv://gdfnj66:qonbOLu0Qxs0qLOw@cluster0.cr5ef04.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const CHANNEL_ID = -1002767614449;
const PORT = 3000;

// Initialize bot and session
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// Web server (for Render health check)
const app = express();
app.get("/", (_, res) => res.send("Bot is active"));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// MongoDB schema
const movieSchema = new mongoose.Schema({
  file_id: String,
  caption: String,
  title: String
});
const Movie = mongoose.model("Movie", movieSchema);

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Index new documents from the channel
bot.on("message", async (ctx) => {
  const msg = ctx.message;
  if (msg.chat.id === CHANNEL_ID && msg.document) {
    const file_id = msg.document.file_id;
    const caption = msg.caption || "No caption";
    const title = caption.toLowerCase().replace(/\s+/g, "_");

    const exists = await Movie.findOne({ file_id });
    if (!exists) {
      await Movie.create({ file_id, caption, title });
      console.log("Movie indexed:", title);
    }
  }
});

// Search handler
bot.on("text", async (ctx) => {
  const searchQuery = ctx.message.text.toLowerCase().replace(/\s+/g, "_");
  const results = await Movie.find({ title: { $regex: searchQuery } });

  if (results.length === 0) {
    return ctx.reply("❌ No results found.");
  }

  ctx.session.results = results;
  ctx.session.page = 0;
  return sendResultsPage(ctx);
});

// Paginated response
async function sendResultsPage(ctx) {
  const results = ctx.session.results || [];
  const page = ctx.session.page || 0;
  const pageSize = 5;

  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = results.slice(start, end);

  const buttons = pageItems.map(movie =>
    [Markup.button.callback(movie.caption.slice(0, 60), `send_${movie.file_id}`)]
  );

  const navigationButtons = [];
  if (start > 0) navigationButtons.push(Markup.button.callback("⬅️ Prev", "prev"));
  if (end < results.length) navigationButtons.push(Markup.button.callback("Next ➡️", "next"));
  if (navigationButtons.length) buttons.push(navigationButtons);

  await ctx.reply("🎬 Search Results:", Markup.inlineKeyboard(buttons));
}

// Pagination controls
bot.action("next", async (ctx) => {
  ctx.session.page++;
  await ctx.deleteMessage();
  return sendResultsPage(ctx);
});

bot.action("prev", async (ctx) => {
  ctx.session.page--;
  await ctx.deleteMessage();
  return sendResultsPage(ctx);
});

// Send selected file
bot.action(/^send_(.+)/, async (ctx) => {
  const file_id = ctx.match[1];
  const movie = await Movie.findOne({ file_id });
  if (!movie) return ctx.reply("File not found or removed.");
  await ctx.replyWithDocument(file_id, { caption: movie.caption });
});

// Graceful shutdown (prevent 409 Conflict)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Launch bot (long polling)
bot.launch().then(() => console.log("Telegram bot started"));
