const express = require('express');
const router = express.Router();
const payment = require('../utils/payment');
const storage = require('../utils/storage');

// Server packages configuration
const SERVER_PACKAGES = [
  { id: 'basic', name: 'Basic Bot Hosting', ram: '1GB', disk: '5GB', cpu: '50%', price: 500 },
  { id: 'standard', name: 'Standard Bot Hosting', ram: '2GB', disk: '10GB', cpu: '100%', price: 500 },
  { id: 'premium', name: 'Premium Bot Hosting', ram: '4GB', disk: '20GB', cpu: '150%', price: 1000 },
  { id: 'enterprise', name: 'Enterprise Bot Hosting', ram: '8GB', disk: '40GB', cpu: '200%', price: 1500 }
];

router.post('/', async (req, res) => {
  try {
    const { package: packageId, username } = req.body;

    // Validate inputs
    if (!packageId || !username) {
      return res.status(400).json({
        success: false,
        error: 'Package and username are required'
      });
    }

    if (typeof username !== 'string' || username.length < 3 || username.length > 16) {
      return res.status(400).json({
        success: false,
        error: 'Username must be 3-16 characters'
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Username can only contain letters, numbers, and underscores'
      });
    }

    // Validate package
    const selectedPackage = SERVER_PACKAGES.find(pkg => pkg.id === packageId);
    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        error: 'Invalid package selected'
      });
    }

    // Check if username already has pending order
    try {
      const orders = await storage.readJSON('orders.json');
      
      if (!Array.isArray(orders)) {
        console.warn('orders is not an array, resetting...');
        await storage.writeJSON('orders.json', []);
      } else {
        const pendingOrder = orders.find(order => 
          order.username === username && order.status === 'pending'
        );

        if (pendingOrder) {
          return res.status(400).json({
            success: false,
            error: 'You have a pending order. Please complete it first.',
            order_id: pendingOrder.reff_id
          });
        }
      }
    } catch (storageError) {
      console.error('Storage error:', storageError);
      // Continue anyway, don't block order creation
    }

    // Create payment
    const paymentResult = await payment.createDeposit(selectedPackage.price, username);

    if (!paymentResult.success) {
      throw new Error(paymentResult.error || 'Payment creation failed');
    }

    // Update order with package info
    const order = await storage.getOrder(paymentResult.reff_id);
    if (order) {
      order.package = selectedPackage.id;
      order.package_name = selectedPackage.name;
      order.package_details = {
        ram: selectedPackage.ram,
        disk: selectedPackage.disk,
        cpu: selectedPackage.cpu
      };
      await storage.saveOrder(order);
    }

    res.json({
      success: true,
      message: 'Order created successfully',
      order_id: paymentResult.reff_id,
      qr_url: paymentResult.qr_url,
      qr_string: paymentResult.qr_string,
      amount: paymentResult.amount,
      expired_at: paymentResult.expired_at,
      order_data: {
        ...paymentResult.order_data,
        package: selectedPackage.id,
        package_name: selectedPackage.name
      }
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get available packages
router.get('/packages', (req, res) => {
  res.json({
    success: true,
    packages: SERVER_PACKAGES
  });
});

module.exports = router;