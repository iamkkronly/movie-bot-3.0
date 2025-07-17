const { Telegraf, Markup, session } = require("telegraf");
const mongoose = require("mongoose");
const express = require("express");

// Replace with your actual values
const BOT_TOKEN = "7929567285:AAGd9W_5uYNZdRVBVPm07swe7lx74iyDISA";
const MONGODB_URI = "mongodb+srv://gdfnj66:qonbOLu0Qxs0qLOw@cluster0.cr5ef04.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const CHANNEL_ID = -1002767614449;

// Initialize bot and web server
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

const app = express();
app.get("/", (_, res) => res.send("Bot is active"));
app.listen(3000, () => console.log("Web server running on port 3000"));

// MongoDB model in same file
const movieSchema = new mongoose.Schema({
  file_id: String,
  caption: String,
  title: String
});
const Movie = mongoose.model("Movie", movieSchema);

// MongoDB connect
mongoose.connect(MONGODB_URI).then(() => console.log("Connected to MongoDB"));

// Index new movie documents from channel posts
bot.on("message", async (ctx) => {
  const msg = ctx.message;
  if (msg.chat.id === CHANNEL_ID && msg.document) {
    const file_id = msg.document.file_id;
    const caption = msg.caption || "No caption";
    const title = caption.toLowerCase().replace(/\s+/g, "_");

    const alreadyExists = await Movie.findOne({ file_id });
    if (!alreadyExists) {
      await Movie.create({ file_id, caption, title });
      console.log("Movie indexed:", title);
    }
  }
});

// Search functionality
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

// Send paginated result page
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

// Pagination
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

// Send selected movie file
bot.action(/^send_(.+)/, async (ctx) => {
  const file_id = ctx.match[1];
  const movie = await Movie.findOne({ file_id });
  if (!movie) return ctx.reply("File not found or removed.");
  await ctx.replyWithDocument(file_id, { caption: movie.caption });
});

// Launch bot
bot.launch().then(() => console.log("Telegram bot started"));
