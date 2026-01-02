const fs = require('fs').promises;
const path = require('path');

class Storage {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    // In-memory storage for Vercel/EROFS compatibility
    this.memoryStore = {
      orders: [],
      users: []
    };
    this.isReadOnly = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Try to load data from file system first
      const filePath = path.join(this.dataDir, 'orders.json');
      await fs.access(filePath);
      const data = await fs.readFile(filePath, 'utf8');
      if (data && data.trim() !== '') {
        this.memoryStore.orders = JSON.parse(data);
        console.log('📁 Loaded orders from file system');
      }
    } catch (error) {
      // File system is read-only or file doesn't exist
      if (error.code === 'EROFS') {
        this.isReadOnly = true;
        console.log('⚠️ File system is read-only, using in-memory storage');
      } else {
        console.log('📁 Starting with empty in-memory storage');
      }
    }
    
    this.initialized = true;
  }

  async readJSON(filename) {
    // Initialize if needed
    if (!this.initialized) {
      await this.init();
    }

    try {
      const filePath = path.join(this.dataDir, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        // File doesn't exist, create it with default data
        const defaultData = filename === 'orders.json' ? [] : [];
        await this.writeJSON(filename, defaultData);
        return defaultData;
      }
      
      // Read and parse file
      const data = await fs.readFile(filePath, 'utf8');
      
      // Handle empty file
      if (!data || data.trim() === '') {
        const defaultData = filename === 'orders.json' ? [] : [];
        await this.writeJSON(filename, defaultData);
        return defaultData;
      }
      
      const parsedData = JSON.parse(data);
      
      // Validate structure for Node.js 24 compatibility
      if (filename === 'orders.json') {
        if (!Array.isArray(parsedData)) {
          console.warn(`orders.json is not an array, resetting to empty array`);
          await this.writeJSON(filename, []);
          return [];
        }
        
        // Validate each order has required fields
        const validOrders = parsedData.filter(order => 
          order && typeof order === 'object' && order.reff_id
        );
        
        if (validOrders.length !== parsedData.length) {
          console.warn(`Found invalid orders, cleaning up...`);
          await this.writeJSON(filename, validOrders);
          return validOrders;
        }
      }
      
      if (filename === 'users.json' && !Array.isArray(parsedData)) {
        console.warn(`users.json is not an array, resetting to empty array`);
        await this.writeJSON(filename, []);
        return [];
      }
      
      // Also update memory store
      if (filename === 'orders.json') {
        this.memoryStore.orders = parsedData;
      } else if (filename === 'users.json') {
        this.memoryStore.users = parsedData;
      }
      
      return parsedData;
    } catch (error) {
      // Check if it's EROFS (read-only file system)
      if (error.code === 'EROFS' || error.message.includes('EROFS')) {
        this.isReadOnly = true;
        console.warn('⚠️ Read-only file system detected, using in-memory storage');
      }
      
      // Return from memory store
      if (filename === 'orders.json') {
        return this.memoryStore.orders || [];
      } else if (filename === 'users.json') {
        return this.memoryStore.users || [];
      }
      return {};
    }
  }

  async writeJSON(filename, data) {
    // Initialize if needed
    if (!this.initialized) {
      await this.init();
    }

    // If read-only, just update memory store
    if (this.isReadOnly) {
      console.log(`📝 [Memory] Writing ${filename}:`, data.length ? `${data.length} items` : 'object');
      if (filename === 'orders.json') {
        this.memoryStore.orders = data;
      } else if (filename === 'users.json') {
        this.memoryStore.users = data;
      }
      return true;
    }

    try {
      const filePath = path.join(this.dataDir, filename);
      
      // Ensure directory exists
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Validate data before writing (Node.js 24 safe)
      let validatedData = data;
      if (filename === 'orders.json') {
        if (!Array.isArray(data)) {
          console.error('Invalid orders data, must be array');
          validatedData = [];
        } else {
          // Ensure all orders have required fields
          validatedData = data.map(order => ({
            reff_id: order.reff_id || `WS${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            username: order.username || 'unknown',
            email: order.email || `${order.username || 'unknown'}@gmail.com`,
            status: order.status || 'pending',
            created_at: order.created_at || new Date().toISOString(),
            updated_at: order.updated_at || new Date().toISOString(),
            ...order
          }));
        }
      }
      
      if (filename === 'users.json' && !Array.isArray(data)) {
        console.error('Invalid users data, must be array');
        validatedData = [];
      }
      
      const jsonData = JSON.stringify(validatedData, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf8');
      
      // Also update memory store
      if (filename === 'orders.json') {
        this.memoryStore.orders = validatedData;
      } else if (filename === 'users.json') {
        this.memoryStore.users = validatedData;
      }
      
      return true;
    } catch (error) {
      // Check if it's EROFS (read-only file system)
      if (error.code === 'EROFS' || error.message.includes('EROFS')) {
        this.isReadOnly = true;
        console.warn('⚠️ Read-only file system detected, falling back to in-memory storage');
        
        // Update memory store instead
        if (filename === 'orders.json') {
          this.memoryStore.orders = data;
        } else if (filename === 'users.json') {
          this.memoryStore.users = data;
        }
        return true;
      }
      
      console.error(`Error writing ${filename}:`, error);
      throw error;
    }
  }

  async saveOrder(order) {
    try {
      const orders = await this.readJSON('orders.json');
      
      // Ensure orders is an array
      if (!Array.isArray(orders)) {
        console.warn('orders is not an array, resetting');
        await this.writeJSON('orders.json', []);
        return await this.saveOrder(order); // Retry
      }
      
      // Validate order data
      if (!order.reff_id) {
        order.reff_id = `WS${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      }
      
      if (!order.created_at) {
        order.created_at = new Date().toISOString();
      }
      
      const existingIndex = orders.findIndex(o => o.reff_id === order.reff_id);
      
      if (existingIndex >= 0) {
        // Update existing order
        orders[existingIndex] = { 
          ...orders[existingIndex], 
          ...order,
          updated_at: new Date().toISOString()
        };
      } else {
        // Add new order
        const newOrder = {
          ...order,
          created_at: order.created_at,
          updated_at: new Date().toISOString()
        };
        orders.push(newOrder);
      }
      
      await this.writeJSON('orders.json', orders);
      return order;
    } catch (error) {
      console.error('Error saving order:', error);
      throw error;
    }
  }

  async getOrder(reffId) {
    try {
      const orders = await this.readJSON('orders.json');
      
      // Ensure orders is an array
      if (!Array.isArray(orders)) {
        console.warn('orders is not an array, returning null');
        return null;
      }
      
      return orders.find(order => order.reff_id === reffId) || null;
    } catch (error) {
      console.error('Error getting order:', error);
      return null;
    }
  }

  async updateOrderStatus(reffId, status, serverInfo = null) {
    try {
      const orders = await this.readJSON('orders.json');
      
      // Ensure orders is an array
      if (!Array.isArray(orders)) {
        console.warn('orders is not an array, cannot update');
        return null;
      }
      
      const orderIndex = orders.findIndex(order => order.reff_id === reffId);
      
      if (orderIndex >= 0) {
        orders[orderIndex].status = status;
        orders[orderIndex].updated_at = new Date().toISOString();
        
        if (serverInfo) {
          orders[orderIndex].server_info = serverInfo;
        }
        
        await this.writeJSON('orders.json', orders);
        return orders[orderIndex];
      }
      
      console.warn(`Order ${reffId} not found for status update`);
      return null;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  async saveUser(user) {
    try {
      const users = await this.readJSON('users.json');
      
      // Ensure users is an array
      if (!Array.isArray(users)) {
        console.warn('users is not an array, resetting');
        await this.writeJSON('users.json', []);
        return await this.saveUser(user); // Retry
      }
      
      const existingIndex = users.findIndex(u => u.username === user.username);
      
      if (existingIndex >= 0) {
        users[existingIndex] = { ...users[existingIndex], ...user };
      } else {
        users.push(user);
      }
      
      await this.writeJSON('users.json', users);
      return user;
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  async getUser(username) {
    try {
      const users = await this.readJSON('users.json');
      
      // Ensure users is an array
      if (!Array.isArray(users)) {
        console.warn('users is not an array, returning null');
        return null;
      }
      
      return users.find(user => user.username === username) || null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }
}

module.exports = new Storage();