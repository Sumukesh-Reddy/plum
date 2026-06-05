require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const claimRoutes = require('./routes/claimRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Plum OPD Claim Adjudication API'
  });
});

// API Routes
app.use('/api/claims', claimRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Plum API Server running on port ${PORT}`);
});

// Keep-alive timer for Render free tier (non-blocking)
const axios = require('axios');
function keepalive() {
  let i = 0;
  setInterval(() => {
    i = (i + 1) % 6;
    console.log(`[keepalive] Server is alive. Tick count: ${i}`);
  }, 30000); // 30 seconds

  // Optional: ping public URL if defined on Render to prevent sleep
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    console.log(`[keepalive] Self-ping active for Render URL: ${renderUrl}`);
    setInterval(() => {
      axios.get(`${renderUrl}/health`)
        .then(() => console.log('[keepalive] Self-ping successful'))
        .catch(err => console.error('[keepalive] Self-ping failed:', err.message));
    }, 10 * 60 * 1000); // 10 minutes
  }
}
keepalive();

module.exports = app;
