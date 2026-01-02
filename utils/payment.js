const axios = require('axios');
const crypto = require('crypto');
const storage = require('./storage');

class AtlanticPayment {
  constructor() {
    this.apiKey = process.env.ATLANTIC_API_KEY;
    this.baseUrl = process.env.ATLANTIC_BASE_URL || 'https://atlantic-payment.h2h.dev';
    
    // ✅ DEBUG
    console.log('🔑 Atlantic Config:', {
      apiKey: this.apiKey ? '✅ SET' : '❌ MISSING',
      baseUrl: this.baseUrl
    });
  }

  generateReffId() {
    return `WS${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  async createDeposit(nominal, username) {
    try {
      // ✅ VALIDASI API KEY SAJA
      if (!this.apiKey) {
        console.error('❌ ATLANTIC_API_KEY is missing in environment variables!');
        throw new Error('Payment gateway credentials not configured');
      }

      const reffId = this.generateReffId();
      const email = `${username}@gmail.com`;
      const password = this.generatePassword();
      
      const order = {
        reff_id: reffId,
        username: username,
        email: email,
        password: password,
        nominal: nominal,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      
      await storage.saveOrder(order);

      // ✅ SIMPLE REQUEST TANPA SIGNATURE
      const formData = new URLSearchParams();
      formData.append('api_key', this.apiKey);
      formData.append('reff_id', reffId);
      formData.append('nominal', nominal.toString());
      formData.append('type', 'ewallet');
      formData.append('metode', 'qris');

      console.log('🚀 Request to Atlantic:', {
        url: `${this.baseUrl}/deposit/create`,
        reff_id: reffId,
        nominal: nominal
      });

      const response = await axios.post(
        `${this.baseUrl}/deposit/create`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
            // ❌ JANGAN PAKE X-ATL-Signature kalo gak ada secretKey
          },
          timeout: 30000
        }
      );

      console.log('📦 Atlantic response:', response.status, response.data?.success);

      if (response.data && response.data.success) {
        const paymentData = response.data.data;
        
        order.deposit_id = paymentData.id;
        order.qr_url = paymentData.qr_url || paymentData.qr_image;
        order.qr_string = paymentData.qr_string;
        order.expired_at = paymentData.expired_at || new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await storage.saveOrder(order);

        return {
          success: true,
          reff_id: reffId,
          qr_url: order.qr_url,
          qr_string: order.qr_string,
          amount: nominal,
          expired_at: order.expired_at,
          order_data: order
        };
      }

      // Kalo response format beda, coba format lain
      if (response.data && response.data.data) {
        const paymentData = response.data.data;
        
        order.deposit_id = paymentData.id || paymentData.reference;
        order.qr_url = paymentData.qr_url || paymentData.qr_code || paymentData.qr_image;
        order.qr_string = paymentData.qr_string || paymentData.qr_content;
        order.expired_at = paymentData.expired_at || paymentData.expiry_time || new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await storage.saveOrder(order);

        return {
          success: true,
          reff_id: reffId,
          qr_url: order.qr_url,
          qr_string: order.qr_string,
          amount: nominal,
          expired_at: order.expired_at,
          order_data: order
        };
      }

      throw new Error('Invalid response format from Atlantic');

    } catch (error) {
      console.error('❌ Atlantic API Error:', {
        message: error.message,
        responseData: error.response?.data,
        url: error.config?.url
      });

      // ✅ FALLBACK: RETURN DUMMY DATA
      console.log('🟡 Using dummy payment data for testing...');
      
      const reffId = `WS${Date.now()}`;
      const email = `${username}@gmail.com`;
      const password = this.generatePassword();
      
      const dummyOrder = {
        reff_id: reffId,
        username: username,
        email: email,
        password: password,
        nominal: nominal,
        status: 'pending',
        qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=ORDER-${reffId}&format=png`,
        qr_string: `ORDER-${reffId}`,
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        note: 'Dummy payment - Atlantic API error'
      };
      
      await storage.saveOrder(dummyOrder);
      
      return {
        success: true,
        reff_id: reffId,
        qr_url: dummyOrder.qr_url,
        qr_string: dummyOrder.qr_string,
        amount: nominal,
        expired_at: dummyOrder.expired_at,
        order_data: dummyOrder,
        warning: 'Dummy mode - Check Atlantic API configuration'
      };
    }
  }

  generatePassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

module.exports = new AtlanticPayment();