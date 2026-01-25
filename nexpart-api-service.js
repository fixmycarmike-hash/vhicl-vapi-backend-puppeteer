const soap = require('soap');
const axios = require('axios');

/**
 * Nexpart API Service - Uses Official SOAP APIs (No Puppeteer)
 * Fast (1-2 seconds), Reliable, Professional
 * 
 * Nexpart APIs:
 * - ORDERLINK: Real-time pricing, availability, ordering
 * - CATLINK: Vehicle catalog, parts lookup, labor guide
 * - ACES: Enhanced catalog with VIN decoding
 */

class NexpartApiService {
  constructor(credentials = {}) {
    this.orderlinkUrl = 'https://api.nexpart.com/orderlink.asmx?wsdl';
    this.catlinkUrl = 'https://api.nexpart.com/catlink.asmx?wsdl';
    this.acesUrl = 'https://api.nexpart.com/aces.asmx?wsdl';
    
    this.credentials = {
      account: credentials.account || process.env.NEXPART_ACCOUNT,
      password: credentials.password || process.env.NEXPART_PASSWORD,
      customerId: credentials.customerId || process.env.NEXPART_CUSTOMER_ID,
      accountNumber: credentials.accountNumber || process.env.NEXPART_ACCOUNT_NUMBER
    };
    
    // Cache SOAP clients to avoid reconnecting
    this.clients = {};
  }

  /**
   * Get or create SOAP client for a service
   */
  async getClient(service) {
    if (!this.clients[service]) {
      const urls = {
        orderlink: this.orderlinkUrl,
        catlink: this.catlinkUrl,
        aces: this.acesUrl
      };
      
      const url = urls[service];
      if (!url) {
        throw new Error(`Unknown Nexpart service: ${service}`);
      }
      
      console.log(`Creating SOAP client for ${service}...`);
      this.clients[service] = await soap.createClientAsync(url);
      console.log(`SOAP client for ${service} created successfully`);
    }
    
    return this.clients[service];
  }

  /**
   * Get Parts Pricing and Availability (ORDERLINK)
   * @param {string} partNumber - Part number to search
   * @param {object} options - Additional options
   * @returns {object} Pricing and availability data
   */
  async getPartsPricing(partNumber, options = {}) {
    try {
      const client = await this.getClient('orderlink');
      
      const request = {
        Account: this.credentials.account,
        Password: this.credentials.password,
        CustomerId: this.credentials.customerId,
        PartNumber: partNumber,
        AccountNumber: this.credentials.accountNumber,
        ...options
      };
      
      console.log(`Requesting pricing for part: ${partNumber}`);
      const [result] = await client.GetPricingAsync(request);
      
      const pricingData = {
        partNumber: result.PartNumber,
        price: parseFloat(result.Price || 0),
        availability: result.Availability || 'Unknown',
        quantity: parseInt(result.Quantity || 0),
        description: result.Description || '',
        manufacturer: result.Manufacturer || '',
        listPrice: parseFloat(result.ListPrice || 0),
        coreCharge: parseFloat(result.CoreCharge || 0),
        msrp: parseFloat(result.MSRP || 0),
        inStock: (result.Availability || '').toLowerCase().includes('stock'),
        timestamp: new Date().toISOString()
      };
      
      console.log(`Pricing received: ${JSON.stringify(pricingData)}`);
      return pricingData;
    } catch (error) {
      console.error(`Error getting parts pricing: ${error.message}`);
      throw new Error(`Failed to get pricing for part ${partNumber}: ${error.message}`);
    }
  }

  /**
   * Search Parts by Description (ORDERLINK)
   * @param {string} searchTerm - Search term (e.g., "brake pads")
   * @param {object} options - Search options (make, model, year)
   * @returns {array} List of matching parts
   */
  async searchParts(searchTerm, options = {}) {
    try {
      const client = await this.getClient('orderlink');
      
      const request = {
        Account: this.credentials.account,
        Password: this.credentials.password,
        CustomerId: this.credentials.customerId,
        SearchTerm: searchTerm,
        Make: options.make || '',
        Model: options.model || '',
        Year: options.year || '',
        AccountNumber: this.credentials.accountNumber
      };
      
      console.log(`Searching parts for: ${searchTerm}`);
      const [result] = await client.SearchPartsAsync(request);
      
      const parts = result.Parts && result.Parts.Part ? 
        (Array.isArray(result.Parts.Part) ? result.Parts.Part : [result.Parts.Part]) : [];
      
      const formattedParts = parts.map(part => ({
        partNumber: part.PartNumber,
        description: part.Description,
        manufacturer: part.Manufacturer,
        price: parseFloat(part.Price || 0),
        availability: part.Availability || 'Unknown',
        quantity: parseInt(part.Quantity || 0),
        image: part.ImageUrl || ''
      }));
      
      console.log(`Found ${formattedParts.length} parts`);
      return formattedParts;
    } catch (error) {
      console.error(`Error searching parts: ${error.message}`);
      throw new Error(`Failed to search parts: ${error.message}`);
    }
  }

  /**
   * Get Vehicle Information from VIN (ACES)
   * @param {string} vin - 17-character VIN
   * @returns {object} Vehicle information
   */
  async decodeVIN(vin) {
    try {
      const client = await this.getClient('aces');
      
      const request = {
        Account: this.credentials.account,
        Password: this.credentials.password,
        VIN: vin
      };
      
      console.log(`Decoding VIN: ${vin}`);
      const [result] = await client.DecodeVINAsync(request);
      
      const vehicleData = {
        vin: result.VIN,
        year: parseInt(result.Year || 0),
        make: result.Make || '',
        model: result.Model || '',
        trim: result.Trim || '',
        bodyType: result.BodyType || '',
        engine: result.Engine || '',
        transmission: result.Transmission || '',
        driveType: result.DriveType || '',
        fuelType: result.FuelType || '',
        color: result.ExteriorColor || '',
        timestamp: new Date().toISOString()
      };
      
      console.log(`VIN decoded: ${JSON.stringify(vehicleData)}`);
      return vehicleData;
    } catch (error) {
      console.error(`Error decoding VIN: ${error.message}`);
      throw new Error(`Failed to decode VIN ${vin}: ${error.message}`);
    }
  }

  /**
   * Get Labor Times for Vehicle (CATLINK/ACES)
   * @param {string} year - Vehicle year
   * @param {string} make - Vehicle make
   * @param {string} model - Vehicle model
   * @param {string} operation - Operation name (e.g., "Brake Pad Replacement")
   * @returns {object} Labor time information
   */
  async getLaborTime(year, make, model, operation) {
    try {
      const client = await this.getClient('aces');
      
      const request = {
        Account: this.credentials.account,
        Password: this.credentials.password,
        Year: year,
        Make: make,
        Model: model,
        Operation: operation
      };
      
      console.log(`Getting labor time for ${year} ${make} ${model} - ${operation}`);
      const [result] = await client.GetLaborTimeAsync(request);
      
      const laborData = {
        operation: result.Operation || operation,
        hours: parseFloat(result.Hours || 0),
        minutes: parseFloat(result.Hours || 0) * 60,
        category: result.Category || '',
        skillLevel: result.SkillLevel || 'Standard',
        notes: result.Notes || '',
        timestamp: new Date().toISOString()
      };
      
      console.log(`Labor time received: ${JSON.stringify(laborData)}`);
      return laborData;
    } catch (error) {
      console.error(`Error getting labor time: ${error.message}`);
      throw new Error(`Failed to get labor time: ${error.message}`);
    }
  }

  /**
   * Get All Labor Operations for Vehicle (CATLINK/ACES)
   * @param {string} year - Vehicle year
   * @param {string} make - Vehicle make
   * @param {string} model - Vehicle model
   * @returns {array} List of labor operations
   */
  async getLaborOperations(year, make, model) {
    try {
      const client = await this.getClient('aces');
      
      const request = {
        Account: this.credentials.account,
        Password: this.credentials.password,
        Year: year,
        Make: make,
        Model: model
      };
      
      console.log(`Getting labor operations for ${year} ${make} ${model}`);
      const [result] = await client.GetLaborOperationsAsync(request);
      
      const operations = result.Operations && result.Operations.Operation ?
        (Array.isArray(result.Operations.Operation) ? result.Operations.Operation : [result.Operations.Operation]) : [];
      
      const formattedOperations = operations.map(op => ({
        operation: op.Operation || '',
        hours: parseFloat(op.Hours || 0),
        minutes: parseFloat(op.Hours || 0) * 60,
        category: op.Category || '',
        skillLevel: op.SkillLevel || 'Standard'
      }));
      
      console.log(`Found ${formattedOperations.length} labor operations`);
      return formattedOperations;
    } catch (error) {
      console.error(`Error getting labor operations: ${error.message}`);
      throw new Error(`Failed to get labor operations: ${error.message}`);
    }
  }

  /**
   * Place Order (ORDERLINK)
   * @param {object} orderData - Order details
   * @returns {object} Order confirmation
   */
  async placeOrder(orderData) {
    try {
      const client = await this.getClient('orderlink');
      
      const request = {
        Account: this.credentials.account,
        Password: this.credentials.password,
        CustomerId: this.credentials.customerId,
        AccountNumber: this.credentials.accountNumber,
        OrderNumber: orderData.orderNumber || '',
        PartNumber: orderData.partNumber,
        Quantity: orderData.quantity,
        CustomerPO: orderData.customerPO || '',
        Notes: orderData.notes || ''
      };
      
      console.log(`Placing order for part: ${orderData.partNumber}`);
      const [result] = await client.PlaceOrderAsync(request);
      
      const orderConfirmation = {
        orderNumber: result.OrderNumber || '',
        partNumber: result.PartNumber || orderData.partNumber,
        quantity: parseInt(result.Quantity || orderData.quantity),
        status: result.Status || 'Pending',
        estimatedDelivery: result.EstimatedDelivery || '',
        confirmationNumber: result.ConfirmationNumber || '',
        timestamp: new Date().toISOString()
      };
      
      console.log(`Order placed: ${JSON.stringify(orderConfirmation)}`);
      return orderConfirmation;
    } catch (error) {
      console.error(`Error placing order: ${error.message}`);
      throw new Error(`Failed to place order: ${error.message}`);
    }
  }

  /**
   * Check Order Status (ORDERLINK)
   * @param {string} orderNumber - Order number to check
   * @returns {object} Order status
   */
  async checkOrderStatus(orderNumber) {
    try {
      const client = await this.getClient('orderlink');
      
      const request = {
        Account: this.credentials.account,
        Password: this.credentials.password,
        CustomerId: this.credentials.customerId,
        OrderNumber: orderNumber
      };
      
      console.log(`Checking order status: ${orderNumber}`);
      const [result] = await client.CheckOrderStatusAsync(request);
      
      const orderStatus = {
        orderNumber: result.OrderNumber || orderNumber,
        status: result.Status || 'Unknown',
        quantity: parseInt(result.Quantity || 0),
        shipped: parseInt(result.Shipped || 0),
        trackingNumber: result.TrackingNumber || '',
        estimatedDelivery: result.EstimatedDelivery || '',
        timestamp: new Date().toISOString()
      };
      
      console.log(`Order status: ${JSON.stringify(orderStatus)}`);
      return orderStatus;
    } catch (error) {
      console.error(`Error checking order status: ${error.message}`);
      throw new Error(`Failed to check order status: ${error.message}`);
    }
  }

  /**
   * Test Connection to Nexpart APIs
   * @returns {object} Connection status
   */
  async testConnection() {
    try {
      // Try to connect to ORDERLINK
      await this.getClient('orderlink');
      
      return {
        success: true,
        message: 'Successfully connected to Nexpart APIs',
        services: ['ORDERLINK', 'CATLINK', 'ACES'],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Nexpart APIs: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = NexpartApiService;