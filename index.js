const express = require('express');
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');

// === Config ===
const BOT_TOKEN = '7929567285:AAEZ6jjlShWNF2Uf16SI8tqA-R501jEIbmc';
const MONGO_URI = 'mongodb+srv://gdfnj66:qonbOLu0Qxs0qLOw@cluster0.cr5ef04.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const SOURCE_CHANNEL = -1002767614449;

// === Connect to MongoDB ===
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// === Movie Schema ===
const movieSchema = new mongoose.Schema({
  file_id: String,
  title: String,
  caption: String,
  search_key: String,
});
const Movie = mongoose.model('Movie', movieSchema);

// === Telegram Bot Setup ===
const bot = new Telegraf(BOT_TOKEN);

// === Normalize Function ===
const normalize = (text) =>
  text.toLowerCase().replace(/[\s_]+/g, '').replace(/[^a-z0-9]/gi, '');

// === Index New Channel Posts ===
bot.on('channel_post', async (ctx) => {
  try {
    const msg = ctx.channelPost;
    const file = msg.document || msg.video;
    if (!file) return;

    const title = file.file_name || msg.caption?.split('\n')[0] || 'Untitled';
    const caption = msg.caption || '';
    const search_key = normalize(title);

    const exists = await Movie.findOne({ file_id: file.file_id });
    if (!exists) {
      await Movie.create({
        file_id: file.file_id,
        title,
        caption,
        search_key,
      });
      console.log(`📥 Indexed: ${title}`);
    }
  } catch (err) {
    console.error('❌ Indexing error:', err.message);
  }
});

// === Respond to User Messages ===
bot.on('text', async (ctx) => {
  try {
    const query = normalize(ctx.message.text);
    const movie = await Movie.findOne({ search_key: query });

    if (movie) {
      await ctx.telegram.sendDocument(ctx.chat.id, movie.file_id, {
        caption: movie.caption,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.reply('❌ Movie not found. Try a different name.');
    }
  } catch (err) {
    console.error('❌ Search error:', err.message);
    ctx.reply('⚠️ Internal server error.');
  }
});

// === Launch the Bot ===
bot.launch();
console.log('🤖 Bot started');

// === Express App for Render ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🎬 Telegram Movie Bot is running.');
});

app.listen(PORT, () => {
  console.log(`🌐 Server is running on port ${PORT}`);
});
