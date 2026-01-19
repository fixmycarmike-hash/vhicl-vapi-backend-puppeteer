class ShopSettingsService {
  constructor() {
    this.settings = {
      shopName: 'VHICL Pro Demo Shop',
      shopPhone: '+1 (555) 123-4567',
      shopAddress: '123 Auto Street, Palo Alto, CA 94301',
      shopEmail: 'demo@vhiclpro.com',
      laborRate: 100,
      diagnosticFee: 50,
      taxRate: 0.08,
      workingHours: {
        monday: { open: '8:00 AM', close: '6:00 PM' },
        tuesday: { open: '8:00 AM', close: '6:00 PM' },
        wednesday: { open: '8:00 AM', close: '6:00 PM' },
        thursday: { open: '8:00 AM', close: '6:00 PM' },
        friday: { open: '8:00 AM', close: '6:00 PM' },
        saturday: { open: '9:00 AM', close: '4:00 PM' },
        sunday: { open: 'closed', close: 'closed' }
      },
      services: {
        oilChange: { enabled: true, price: 49.99, duration: 30 },
        brakeService: { enabled: true, price: 199.99, duration: 120 },
        diagnostic: { enabled: true, price: 89.99, duration: 60 },
        tireRotation: { enabled: true, price: 39.99, duration: 30 }
      },
      paymentMethods: ['cash', 'credit_card', 'debit_card', 'insurance'],
      warrantyPolicy: '90 days on labor, 1 year on parts',
      appointmentLeadTime: 2,
      maxAppointmentsPerDay: 20
    };
  }

  // Get all settings
  getAllSettings() {
    return this.settings;
  }

  // Get specific setting
  getSetting(key) {
    return this.settings[key] || null;
  }

  // Update setting
  updateSetting(key, value) {
    if (this.settings.hasOwnProperty(key)) {
      this.settings[key] = value;
      return { success: true, message: `${key} updated successfully` };
    }
    return { success: false, message: `Setting ${key} not found` };
  }

  // Update multiple settings
  updateMultipleSettings(updates) {
    const results = [];
    for (const [key, value] of Object.entries(updates)) {
      const result = this.updateSetting(key, value);
      results.push({ key, ...result });
    }
    return results;
  }

  // Reset settings to default
  resetToDefault() {
    this.settings = {
      shopName: 'VHICL Pro Demo Shop',
      shopPhone: '+1 (555) 123-4567',
      shopAddress: '123 Auto Street, Palo Alto, CA 94301',
      shopEmail: 'demo@vhiclpro.com',
      laborRate: 100,
      diagnosticFee: 50,
      taxRate: 0.08,
      workingHours: {
        monday: { open: '8:00 AM', close: '6:00 PM' },
        tuesday: { open: '8:00 AM', close: '6:00 PM' },
        wednesday: { open: '8:00 AM', close: '6:00 PM' },
        thursday: { open: '8:00 AM', close: '6:00 PM' },
        friday: { open: '8:00 AM', close: '6:00 PM' },
        saturday: { open: '9:00 AM', close: '4:00 PM' },
        sunday: { open: 'closed', close: 'closed' }
      },
      services: {
        oilChange: { enabled: true, price: 49.99, duration: 30 },
        brakeService: { enabled: true, price: 199.99, duration: 120 },
        diagnostic: { enabled: true, price: 89.99, duration: 60 },
        tireRotation: { enabled: true, price: 39.99, duration: 30 }
      },
      paymentMethods: ['cash', 'credit_card', 'debit_card', 'insurance'],
      warrantyPolicy: '90 days on labor, 1 year on parts',
      appointmentLeadTime: 2,
      maxAppointmentsPerDay: 20
    };
    return { success: true, message: 'Settings reset to default' };
  }

  // Get formatted shop info
  getShopInfo() {
    return {
      name: this.settings.shopName,
      phone: this.settings.shopPhone,
      address: this.settings.shopAddress,
      email: this.settings.shopEmail,
      laborRate: this.settings.laborRate,
      diagnosticFee: this.settings.diagnosticFee,
      taxRate: this.settings.taxRate
    };
  }

  // Get working hours
  getWorkingHours() {
    return this.settings.workingHours;
  }

  // Check if shop is open
  isOpen() {
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = dayNames[now.getDay()];
    const hours = this.settings.workingHours[today];
    
    if (hours.open === 'closed') return false;
    
    // Simple time comparison (you may want to enhance this)
    const currentTime = now.getHours();
    const openHour = parseInt(hours.open.split(':')[0]);
    const closeHour = parseInt(hours.close.split(':')[0]);
    
    return currentTime >= openHour && currentTime < closeHour;
  }

  // Get available services
  getServices() {
    return Object.entries(this.settings.services)
      .filter(([_, service]) => service.enabled)
      .map(([name, service]) => ({ name, ...service }));
  }
}

// Export the class
module.exports = ShopSettingsService;
