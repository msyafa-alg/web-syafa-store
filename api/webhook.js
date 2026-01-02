const express = require('express');
const router = express.Router();
const payment = require('../utils/payment');
const pterodactyl = require('../utils/pterodactyl');
const storage = require('../utils/storage');

router.post('/', async (req, res) => {
  console.log('📥 Webhook received:', {
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body
  });

  try {
    const signature = req.headers['x-atl-signature'];
    const payload = req.body;

    if (!signature) {
      console.error('❌ No signature provided in webhook');
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Validate webhook signature
    if (!payment.validateWebhookSignature(payload, signature)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Validate webhook event
    if (payload.event !== 'deposit') {
      console.log('ℹ️ Ignoring non-deposit event:', payload.event);
      return res.json({ received: true });
    }

    const depositData = payload.data;
    
    if (!depositData || !depositData.reff_id) {
      console.error('❌ Invalid deposit data in webhook');
      return res.status(400).json({ error: 'Invalid deposit data' });
    }
    
    // Check if deposit was successful
if (depositData.status === 'processing') {
  console.log(`⏳ Payment still processing: ${depositData.reff_id}`);
  await storage.updateOrderStatus(depositData.reff_id, 'pending');
  return res.json({ received: true });
}

if (depositData.status !== 'success') {
  console.log(`❌ Payment failed: ${depositData.reff_id}`);
  await storage.updateOrderStatus(depositData.reff_id, 'failed');
  return res.json({ received: true });
}


    // Get order from storage
    const order = await storage.getOrder(depositData.reff_id);
    
    if (!order) {
      console.error(`❌ Order not found: ${depositData.reff_id}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Prevent double processing
    if (order.status === 'success') {
      console.log(`✅ Order already processed: ${depositData.reff_id}`);
      return res.json({ received: true, status: 'already_processed' });
    }

    // Update order with payment details
    order.deposit_id = depositData.id;
    order.paid_amount = depositData.nominal;
    order.fee = depositData.fee;
    order.paid_at = depositData.created_at;
    order.status = 'processing';
    await storage.saveOrder(order);

    console.log(`✅ Payment successful for order: ${order.reff_id}, starting provisioning...`);

    // Provision server
    try {
      const provisionResult = await pterodactyl.provisionServer(order);
      
      // Update order as successful with server info
      await storage.updateOrderStatus(
        order.reff_id,
        'success',
        provisionResult.server_info
      );

      console.log(`🎉 Server provisioned successfully for order: ${order.reff_id}`);
      
    } catch (provisionError) {
      console.error('❌ Provisioning failed:', provisionError);
      
      // Mark order as failed if provisioning fails
      await storage.updateOrderStatus(order.reff_id, 'failed');
      
      // You might want to implement retry logic or manual intervention here
      console.log('⚠️ Order marked as failed due to provisioning error');
    }

    // Always respond with 200 to prevent webhook retries
    res.json({ 
      received: true, 
      processed: true,
      order_id: depositData.reff_id
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    console.error('Stack:', error.stack);
    
    // Still respond with 200 to prevent webhook retries
    res.json({ 
      received: true, 
      error: 'Internal error but acknowledged',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;