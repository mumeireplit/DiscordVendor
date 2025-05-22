// Simpler Express server for Render deployment
import express from 'express';

const app = express();
app.use(express.json());

// API route for testing
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Discord Bot Vending Machine API is online',
    time: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.send('Discord Bot Vending Machine API is running');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});