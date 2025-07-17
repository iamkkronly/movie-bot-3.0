const { Telegraf, Markup } = require("telegraf");
const mongoose = require("mongoose");
const express = require("express");

const BOT_TOKEN = "7929567285:AAGd9W_5uYNZdRVBVPm07swe7lx74iyDISA";
const MONGO_URI = "mongodb+srv://gdfnj66:qonbOLu0Qxs0qLOw@cluster0.cr5ef04.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const CHANNEL_ID = -1002767614449;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected."))
  .catch(err => console.error("Mongo error:", err));

const MovieSchema = new mongoose.Schema({
  file_id: String,
  title: String,
  caption: String,
  file_size: String
});
const Movie = mongoose.model("Movie", MovieSchema);

// 🌐 Web service to keep Render alive
app.get("/", (req, res) => {
  res.send("Bot is running...");
});
app.listen(process.env.PORT || 3000);

// 📥 Auto-index from channel
bot.on("channel_post", async (ctx) => {
  const msg = ctx.channelPost;
  if (!msg.document) return;

  const title = msg.caption || msg.document.file_name || "Unknown Title";
  const fileSize = (msg.document.file_size / (1024 * 1024)).toFixed(2) + " GB";

  const exists = await Movie.findOne({ file_id: msg.document.file_id });
  if (exists) return;

  const newMovie = new Movie({
    file_id: msg.document.file_id,
    title,
    caption: msg.caption || "",
    file_size: fileSize
  });

  await newMovie.save();
});

// 🧠 Normalize text for better search
function normalize(text) {
  return text.replace(/[_\-\.]/g, " ").toLowerCase().trim();
}

// 🔍 Handle user search
bot.on("text", async (ctx) => {
  const query = normalize(ctx.message.text);
  const movies = await Movie.find({
    title: { $regex: new RegExp(query, "i") }
  });

  if (!movies.length) return ctx.reply("❌ Movie not found.");

  ctx.session = ctx.session || {};
  ctx.session[ctx.from.id] = { query, page: 0 };

  return sendMoviePage(ctx, movies, 0);
});

// 📤 Send a page of results
async function sendMoviePage(ctx, movies, page) {
  const pageSize = 5;
  const start = page * pageSize;
  const end = start + pageSize;
  const pageMovies = movies.slice(start, end);

  const buttons = pageMovies.map(m =>
    [Markup.button.callback(`${m.file_size} • ${m.title.slice(0, 40)}`, `send_${m._id}`)]
  );

  if (movies.length > pageSize) {
    buttons.push([
      ...(page > 0 ? [Markup.button.callback("⬅ Prev", "prev")] : []),
      ...(end < movies.length ? [Markup.button.callback("Next ➡", "next")] : [])
    ]);
  }

  await ctx.reply("🎬 Select a movie:", Markup.inlineKeyboard(buttons));
}

// 🧾 Button handlers
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;

  const userSession = ctx.session?.[ctx.from.id];
  if (!userSession) return ctx.answerCbQuery("Session expired. Search again.");

  const allMatches = await Movie.find({
    title: { $regex: new RegExp(userSession.query, "i") }
  });

  if (data.startsWith("send_")) {
    const movie = await Movie.findById(data.split("send_")[1]);
    if (movie) {
      await ctx.telegram.sendDocument(ctx.chat.id, movie.file_id, {
        caption: movie.caption,
        parse_mode: "HTML"
      });
    }
    return ctx.answerCbQuery();
  }

  if (data === "next") {
    userSession.page += 1;
    return sendMoviePage(ctx, allMatches, userSession.page);
  }

  if (data === "prev") {
    userSession.page -= 1;
    return sendMoviePage(ctx, allMatches, userSession.page);
  }
});

bot.launch();
console.log("🤖 Bot running...");
