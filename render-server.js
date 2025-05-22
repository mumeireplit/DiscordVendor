import express from 'express';

const app = express();

// Basic route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Discord Bot Vending Machine</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #5865F2; }
          .success { color: green; }
        </style>
      </head>
      <body>
        <h1>Discord Bot Vending Machine</h1>
        <p class="success">✅ サーバーが正常に動作しています</p>
        <p>このサーバーは稼働中です。フルバージョンをデプロイするためには、完全なセットアップが必要です。</p>
        <h2>サーバー情報:</h2>
        <ul>
          <li>環境: ${process.env.NODE_ENV || 'development'}</li>
          <li>Firebase: ${process.env.USE_FIREBASE === 'true' ? '有効' : '無効'}</li>
          <li>Discord Bot: ${process.env.DISCORD_BOT_TOKEN ? '設定済み' : '未設定'}</li>
        </ul>
      </body>
    </html>
  `);
});

// API status route
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    server: 'Discord Bot Vending Machine API',
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    firebase: process.env.USE_FIREBASE === 'true',
    discordBot: !!process.env.DISCORD_BOT_TOKEN
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Discord Bot Vending Machine server running on port ${PORT}`);
});