const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ FIX 1: Trust proxy untuk Vercel
app.set('trust proxy', 1);

// ✅ FIX 2: Absolute path untuk static files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ FIX 3: Rate limiter yang Vercel compatible
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true // ✅ Ini penting!
});

app.use(limiter);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes... (tetap sama)

// Import routes
const createOrderRoute = require('./api/create-order');
const webhookRoute = require('./api/webhook');
const checkOrderRoute = require('./api/check-order');

// API Routes
app.use('/api/create-order', createOrderRoute);
app.use('/api/webhook', webhookRoute);
app.use('/api/check-order', checkOrderRoute);

// Serve frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/payment/:orderId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

app.get('/status/:orderId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

// Health check endpoint with storage check
app.get('/api/health', async (req, res) => {
  try {
    const storage = require('./utils/storage');
    const orders = await storage.readJSON('orders.json');
    const users = await storage.readJSON('users.json');
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      storage: {
        orders_count: Array.isArray(orders) ? orders.length : 'invalid',
        users_count: Array.isArray(users) ? users.length : 'invalid'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize data directory
const fs = require('fs').promises;

async function initializeApp() {
  try {
    console.log('🚀 Initializing WEB SYAFA STORE...');
    
    // Ensure data directory exists
    await fs.mkdir('./data', { recursive: true });
    console.log('✅ Data directory ready');
    
    // Test storage
    const storage = require('./utils/storage');
    
    // Initialize orders.json
    const orders = await storage.readJSON('orders.json');
    console.log(`✅ orders.json initialized with ${Array.isArray(orders) ? orders.length : 0} orders`);
    
    // Initialize users.json
    const users = await storage.readJSON('users.json');
    console.log(`✅ users.json initialized with ${Array.isArray(users) ? users.length : 0} users`);
    
    // Create sample order if empty (for testing)
    if (Array.isArray(orders) && orders.length === 0) {
      console.log('📝 Creating sample order for testing...');
      await storage.saveOrder({
        reff_id: 'WS' + Date.now(),
        username: 'test_user',
        email: 'test_user@gmail.com',
        password: 'TestPass123!',
        package: 'basic',
        package_name: 'Basic Bot Hosting',
        nominal: 25000,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }
    
    console.log('🎉 Application initialization complete!');
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    console.error('Stack:', error.stack);
  }
}

// Start server
if (require.main === module) {
  initializeApp().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 ${process.env.APP_NAME || 'WEB SYAFA STORE'} running on port ${PORT}`);
      console.log(`📁 Data storage: ${path.join(__dirname, 'data')}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    });
  });
}

module.exports = app;