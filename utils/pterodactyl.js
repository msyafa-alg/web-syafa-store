const axios = require('axios');
const storage = require('./storage');

class PterodactylClient {
  constructor() {
    this.baseUrl = process.env.PTERODACTYL_URL;
    this.apiKey = process.env.PTERODACTYL_API_KEY;
    this.locationId = parseInt(process.env.PTERODACTYL_LOCATION_ID) || 1;
    this.eggId = parseInt(process.env.PTERODACTYL_EGG_ID) || 15;
    this.nestId = parseInt(process.env.PTERODACTYL_NEST_ID) || 1;
    this.dockerImage = process.env.PTERODACTYL_DOCKER_IMAGE || 'nodejs_20';
  }

  async createUser(email, username, firstName, lastName) {
    try {
      if (!this.baseUrl || !this.apiKey) {
        throw new Error('Pterodactyl credentials not configured');
      }

      const response = await axios.post(
        `${this.baseUrl}/api/application/users`,
        {
          email: email,
          username: username,
          first_name: firstName || 'Customer',
          last_name: lastName || username,
          language: 'en'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      return response.data.attributes;
    } catch (error) {
      // If user already exists, try to get existing user
      if (error.response?.status === 422) {
        const usersResponse = await axios.get(
          `${this.baseUrl}/api/application/users`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const existingUser = usersResponse.data.data.find(
          user => user.attributes.email === email || user.attributes.username === username
        );
        
        if (existingUser) {
          return existingUser.attributes;
        }
      }
      throw error;
    }
  }

  async createServer(userId, serverName, memory, disk, cpu, orderId) {
    try {
      // Map RAM to package name
      const packageMap = {
        1024: 'Basic Bot Hosting',
        2048: 'Standard Bot Hosting',
        4096: 'Premium Bot Hosting',
        8192: 'Enterprise Bot Hosting'
      };

      const packageName = packageMap[memory] || 'Custom Bot Hosting';

      const response = await axios.post(
        `${this.baseUrl}/api/application/servers`,
        {
          name: serverName,
          user: userId,
          egg: this.eggId,
          docker_image: this.dockerImage,
          startup: 'npm start',
          environment: {
            NODE_ENV: 'production',
            ORDER_ID: orderId
          },
          limits: {
            memory: memory,
            swap: 0,
            disk: disk,
            io: 500,
            cpu: cpu
          },
          feature_limits: {
            databases: 1,
            backups: 1
          },
          allocation: {
            default: 1
          },
          deploy: {
            locations: [this.locationId],
            dedicated_ip: false,
            port_range: []
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      const serverData = response.data.attributes;
      
      return {
        server_id: serverData.id,
        identifier: serverData.identifier,
        name: serverData.name,
        package: packageName,
        memory: memory,
        disk: disk,
        cpu: cpu,
        connection: {
          ip: serverData.allocation,
          port: serverData.port
        },
        created_at: serverData.created_at
      };
    } catch (error) {
      console.error('Create server error:', error.response?.data || error.message);
      throw error;
    }
  }

  async provisionServer(order) {
    try {
      console.log(`Provisioning server for order: ${order.reff_id}`);
      
      // Create or get Pterodactyl user
      const user = await this.createUser(
        order.email,
        order.username,
        'Server',
        'Customer'
      );

      // Save user credentials
      await storage.saveUser({
        username: order.username,
        email: order.email,
        password: order.password,
        pterodactyl_id: user.id,
        created_at: new Date().toISOString()
      });

      // Determine server specs based on price
      const specs = this.mapPriceToSpecs(order.nominal);
      
      // Create server name
      const serverName = `bot-${order.username}-${Date.now().toString().slice(-6)}`;

      // Create server
      const server = await this.createServer(
        user.id,
        serverName,
        specs.memory,
        specs.disk,
        specs.cpu,
        order.reff_id
      );

      // Generate access URL
      const panelUrl = `${this.baseUrl}/server/${server.identifier}`;

      return {
        success: true,
        server_info: {
          ...server,
          panel_url: panelUrl,
          credentials: {
            username: order.username,
            email: order.email,
            password: order.password
          },
          created_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Provisioning failed:', error);
      throw new Error(`Server provisioning failed: ${error.message}`);
    }
  }

  mapPriceToSpecs(price) {
    // Price to specs mapping (adjust based on your pricing)
    if (price <= 25000) {
      return { memory: 1024, disk: 5120, cpu: 50 }; // 1GB RAM, 5GB Disk
    } else if (price <= 50000) {
      return { memory: 2048, disk: 10240, cpu: 100 }; // 2GB RAM, 10GB Disk
    } else if (price <= 100000) {
      return { memory: 4096, disk: 20480, cpu: 150 }; // 4GB RAM, 20GB Disk
    } else {
      return { memory: 8192, disk: 40960, cpu: 200 }; // 8GB RAM, 40GB Disk
    }
  }
}

module.exports = new PterodactylClient();