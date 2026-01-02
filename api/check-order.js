const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');

router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    const order = await storage.getOrder(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Return order data (exclude sensitive info for security)
    const safeOrder = {
      reff_id: order.reff_id,
      status: order.status,
      username: order.username,
      package: order.package,
      package_name: order.package_name,
      package_details: order.package_details,
      nominal: order.nominal,
      created_at: order.created_at,
      updated_at: order.updated_at,
      expired_at: order.expired_at,
      qr_url: order.qr_url
    };

    // Include server info if order is successful
    if (order.status === 'success' && order.server_info) {
      safeOrder.server_info = {
        server_id: order.server_info.server_id,
        identifier: order.server_info.identifier,
        name: order.server_info.name,
        package: order.server_info.package,
        memory: order.server_info.memory,
        disk: order.server_info.disk,
        cpu: order.server_info.cpu,
        panel_url: order.server_info.panel_url,
        created_at: order.server_info.created_at
      };
      
      // Include credentials (in real production, you might want to secure this more)
      if (order.server_info.credentials) {
        safeOrder.credentials = order.server_info.credentials;
      }
    }

    res.json({
      success: true,
      order: safeOrder
    });

  } catch (error) {
    console.error('Check order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check order status'
    });
  }
});

module.exports = router;