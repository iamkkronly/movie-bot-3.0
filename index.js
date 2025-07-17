import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';

// ====== Configuration ======
const BOT_TOKEN = '7929567285:AAEZ6jjlShWNF2Uf16SI8tqA-R501jEIbmc';
const MONGO_URI = 'mongodb+srv://gdfnj66:qonbOLu0Qxs0qLOw@cluster0.cr5ef04.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const CHANNEL_ID = -1002767614449;

// ====== MongoDB Setup ======
await mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const movieSchema = new mongoose.Schema({
  message_id: Number,
  title: String,
  caption: String,
  full_text: String,
});

const Movie = mongoose.model('Movie', movieSchema);

// ====== Bot Setup ======
const bot = new Telegraf(BOT_TOKEN);

// ====== Normalize Function ======
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ====== Indexing Channel Messages ======
bot.on('channel_post', async (ctx) => {
  const msg = ctx.channelPost;
  const file = msg.document || msg.video;

  if (!file) return;

  const title = file.file_name || msg.caption?.split('\n')[0] || 'Untitled';
  const caption = msg.caption || '';
  const full_text = normalize(title + ' ' + caption);

  try {
    await Movie.create({
      message_id: msg.message_id,
      title,
      caption,
      full_text,
    });
    console.log(`📥 Indexed: ${title}`);
  } catch (err) {
    if (err.code !== 11000) {
      console.error('❌ Error indexing:', err.message);
    }
  }
});

// ====== Handle User Movie Search ======
bot.on('text', async (ctx) => {
  const query = normalize(ctx.message.text);

  let movie = await Movie.findOne({
    full_text: { $regex: query, $options: 'i' },
  });

  if (!movie) {
    return ctx.reply('❌ Movie not found.');
  }

  try {
    await ctx.telegram.copyMessage(
      ctx.chat.id,
      CHANNEL_ID,
      movie.message_id,
      { caption: movie.caption }
    );
  } catch (err) {
    console.error('❌ Error sending movie:', err.message);
    ctx.reply('⚠️ Error sending movie file.');
  }
});

// ====== Start Bot ======
bot.launch().then(() => {
  console.log('🤖 Bot started');
});

// ====== Graceful Shutdown ======
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
