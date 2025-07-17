const express = require('express');
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');

// === Your Config ===
const BOT_TOKEN = '7929567285:AAGd9W_5uYNZdRVBVPm07swe7lx74iyDISA';
const MONGO_URI = 'mongodb+srv://gdfnj66:qonbOLu0Qxs0qLOw@cluster0.cr5ef04.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const SOURCE_CHANNEL = -1002767614449;

// === Connect to MongoDB ===
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// === Define Movie Schema ===
const movieSchema = new mongoose.Schema({
  file_id: String,
  title: String,
  caption: String,
});
const Movie = mongoose.model('Movie', movieSchema);

// === Initialize Telegram Bot ===
const bot = new Telegraf(BOT_TOKEN);

// === Listen for new channel posts to index ===
bot.on('channel_post', async (ctx) => {
  try {
    const msg = ctx.channelPost;
    const file = msg.document || msg.video;
    if (!file) return;

    const title = file.file_name || msg.caption?.split('\n')[0] || 'Untitled';
    const caption = msg.caption || '';

    const exists = await Movie.findOne({ file_id: file.file_id });
    if (!exists) {
      await Movie.create({
        file_id: file.file_id,
        title: title.toLowerCase(),
        caption,
      });
      console.log(`📥 Indexed: ${title}`);
    }
  } catch (err) {
    console.error('❌ Error indexing message:', err.message);
  }
});

// === Respond to user queries ===
bot.on('text', async (ctx) => {
  try {
    const query = ctx.message.text.toLowerCase();
    const movie = await Movie.findOne({ title: { $regex: query, $options: 'i' } });

    if (movie) {
      await ctx.telegram.sendDocument(ctx.chat.id, movie.file_id, {
        caption: movie.caption,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.reply('❌ Movie not found. Try another name.');
    }
  } catch (err) {
    console.error('❌ Error responding to user:', err.message);
    ctx.reply('⚠️ Internal error.');
  }
});

// === Launch bot ===
bot.launch();
console.log('🤖 Telegram bot launched');

// === Express app to keep Render web service alive ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Telegram Movie Bot is running.');
});

app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});
