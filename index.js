// Simple Express server for Render deployment
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Basic route to verify the server is working
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Discord Bot Vending Machine API is running',
    env: {
      firebase: process.env.USE_FIREBASE === 'true',
      discordBot: !!process.env.DISCORD_BOT_TOKEN,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// For all other routes
app.get('*', (req, res) => {
  res.json({ message: 'Welcome to Discord Bot Vending Machine API' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});