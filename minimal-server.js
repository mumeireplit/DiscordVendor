import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Discord Bot Vending Machine API is running');
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});