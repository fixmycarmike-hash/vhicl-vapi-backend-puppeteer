/**
 * Complete Shop Settings Service
 * Handles all shop configuration including:
 * - Shop information
 * - Labor rates and multipliers
 * - Parts markup and matrix
 * - API credentials (PayPal, SendGrid, VAPI, Nexpart, Auto Labor)
 * - Parts store directory
 * - Quote and invoice settings
 * - System configuration
 */

class ShopSettingsService {
    constructor(options = {}) {
        this.settings = options.settings || null;
        this.storage = options.storage || null;
        this.defaults = this.getDefaultSettings();
        this.loadSettings();
    }

    /**
     * Get default settings
     */
    getDefaultSettings() {
        return {
            // Shop Information
            shopName: '',
            shopPhone: '',
            shopEmail: '',
            shopAddress: '',
            shopWebsite: '',
            
            // Business Hours
            businessHours: {
                monday: { open: '8:00 AM', close: '5:00 PM', closed: false },
                tuesday: { open: '8:00 AM', close: '5:00 PM', closed: false },
                wednesday: { open: '8:00 AM', close: '5:00 PM', closed: false },
                thursday: { open: '8:00 AM', close: '5:00 PM', closed: false },
                friday: { open: '8:00 AM', close: '5:00 PM', closed: false },
                saturday: { open: '9:00 AM', close: '2:00 PM', closed: false },
                sunday: { closed: true }
            },
            
            // Tax & Fees
            taxRate: 0.08,
            shopSuppliesFee: 2.50,
            disposalFee: 5.00,
            diagnosticFee: 50.00,
            
            // Labor Configuration
            laborRate: 100.00,
            diagnosticRate: 125.00,
            laborMultiplier: 1.0,
            laborTimeMultiplier: 1.0,
            
            // Parts Markup
            partsMarkupStrategy: 'percentage',
            defaultMarkup: 30.00,
            partsMarkupMatrix: this.getDefaultPartsMarkupMatrix(),
            partsPricingTiers: [
                { minPrice: 0, maxPrice: 10, markup: 50.00 },
                { minPrice: 10, maxPrice: 50, markup: 40.00 },
                { minPrice: 50, maxPrice: 100, markup: 35.00 },
                { minPrice: 100, maxPrice: 250, markup: 30.00 },
                { minPrice: 250, maxPrice: 500, markup: 25.00 },
                { minPrice: 500, maxPrice: 9999, markup: 20.00 }
            ],
            
            // API Credentials (all initially disabled)
            nexpart: { enabled: false, username: '', password: '' },
            autoLabor: { enabled: false, username: '', password: '' },
            sendgrid: { enabled: false, apiKey: '', fromEmail: '', fromName: '' },
            vapi: { enabled: false, apiKey: '', phoneId: '', phoneNumber: '' },
            paypal: { enabled: false, mode: 'sandbox', clientId: '', clientSecret: '', webHookId: '' },
            
            // Parts Store Directory
            partsStores: [],
            
            // Quote & Invoice Settings
            quote: {
                autoIncludeDiagnosticFee: true,
                autoIncludeShopSuppliesFee: true,
                autoIncludeDisposalFee: true,
                quoteExpirationDays: 30,
                requireCustomerApproval: false
            },
            
            invoice: {
                autoGenerateInvoice: true,
                invoiceNumberPrefix: 'INV-',
                invoiceNumberStart: 1001,
                paymentTerms: 'Net 30',
                lateFeePercentage: 5.00,
                lateFeeDays: 30
            },
            
            // System Configuration
            system: {
                timezone: 'America/New_York',
                dateFormat: 'MM/DD/YYYY',
                timeFormat: '12h',
                currency: 'USD',
                language: 'en'
            },
            
            // Feature Flags
            features: {
                partsScraping: false,
                laborScraping: false,
                voiceCalling: false,
                emailNotifications: false,
                paymentProcessing: false
            }
        };
    }

    /**
     * Get default parts markup matrix
     */
    getDefaultPartsMarkupMatrix() {
        return {
            // Electrical Parts
            'alternators': { markup: 35.00, minMarkup: 20.00, maxMarkup: 50.00 },
            'starters': { markup: 35.00, minMarkup: 20.00, maxMarkup: 50.00 },
            'batteries': { markup: 25.00, minMarkup: 15.00, maxMarkup: 40.00 },
            'spark plugs': { markup: 40.00, minMarkup: 25.00, maxMarkup: 60.00 },
            'ignition coils': { markup: 40.00, minMarkup: 30.00, maxMarkup: 55.00 },
            
            // Brakes
            'brake pads': { markup: 30.00, minMarkup: 20.00, maxMarkup: 45.00 },
            'brake rotors': { markup: 30.00, minMarkup: 20.00, maxMarkup: 45.00 },
            'brake calipers': { markup: 35.00, minMarkup: 25.00, maxMarkup: 50.00 },
            'brake shoes': { markup: 30.00, minMarkup: 20.00, maxMarkup: 45.00 },
            
            // Filters
            'oil filter': { markup: 35.00, minMarkup: 25.00, maxMarkup: 50.00 },
            'air filter': { markup: 40.00, minMarkup: 30.00, maxMarkup: 55.00 },
            'fuel filter': { markup: 35.00, minMarkup: 25.00, maxMarkup: 50.00 },
            'cabin air filter': { markup: 40.00, minMarkup: 30.00, maxMarkup: 55.00 },
            
            // Fluids
            'motor oil': { markup: 25.00, minMarkup: 15.00, maxMarkup: 40.00 },
            'transmission fluid': { markup: 30.00, minMarkup: 20.00, maxMarkup: 45.00 },
            'brake fluid': { markup: 30.00, minMarkup: 20.00, maxMarkup: 45.00 },
            'coolant': { markup: 30.00, minMarkup: 20.00, maxMarkup: 45.00 },
            'power steering fluid': { markup: 30.00, minMarkup: 20.00, maxMarkup: 45.00 },
            
            // Suspension
            'shocks': { markup: 35.00, minMarkup: 25.00, maxMarkup: 50.00 },
            'struts': { markup: 35.00, minMarkup: 25.00, maxMarkup: 50.00 },
            'ball joints': { markup: 40.00, minMarkup: 30.00, maxMarkup: 55.00 },
            'control arms': { markup: 35.00, minMarkup: 25.00, maxMarkup: 50.00 },
            'tie rod ends': { markup: 35.00, minMarkup: 25.00, maxMarkup: 50.00 },
            
            // Tires
            'tires': { markup: 20.00, minMarkup: 15.00, maxMarkup: 30.00 },
            'wheels': { markup: 25.00, minMarkup: 20.00, maxMarkup: 40.00 },
            
            // Other
            'default': { markup: 30.00, minMarkup: 20.00, maxMarkup: 45.00 }
        };
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            if (this.storage) {
                const data = await this.storage.get('shopSettings');
                if (data) {
                    this.settings = { ...this.defaults, ...data };
                } else {
                    this.settings = { ...this.defaults };
                }
            } else {
                this.settings = { ...this.defaults };
            }
            return this.settings;
        } catch (error) {
            console.error('Error loading shop settings:', error);
            this.settings = { ...this.defaults };
            return this.settings;
        }
    }

    /**
     * Save settings to storage
     */
    async saveSettings(settings) {
        try {
            this.settings = { ...this.settings, ...settings };
            
            if (this.storage) {
                await this.storage.set('shopSettings', this.settings);
            }
            
            return { success: true, settings: this.settings };
        } catch (error) {
            console.error('Error saving shop settings:', error);
            throw error;
        }
    }

    /**
     * Get all settings (with credentials masked)
     */
    getSettings() {
        const maskedSettings = { ...this.settings };
        
        // Mask sensitive data
        if (maskedSettings.nexpart?.password) {
            maskedSettings.nexpart.password = '******';
        }
        if (maskedSettings.autoLabor?.password) {
            maskedSettings.autoLabor.password = '******';
        }
        if (maskedSettings.sendgrid?.apiKey) {
            maskedSettings.sendgrid.apiKey = this.maskApiKey(maskedSettings.sendgrid.apiKey);
        }
        if (maskedSettings.vapi?.apiKey) {
            maskedSettings.vapi.apiKey = this.maskApiKey(maskedSettings.vapi.apiKey);
        }
        if (maskedSettings.paypal?.clientSecret) {
            maskedSettings.paypal.clientSecret = '******';
        }
        
        return maskedSettings;
    }

    /**
     * Mask API key for display
     */
    maskApiKey(apiKey) {
        if (!apiKey || apiKey.length < 10) return '******';
        return apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
    }

    /**
     * Calculate parts markup based on strategy
     */
    calculatePartsMarkup(part) {
        const basePrice = part.cost || part.price || 0;
        const strategy = this.settings.partsMarkupStrategy || 'percentage';
        
        let markup = 0;
        
        if (strategy === 'percentage') {
            markup = this.settings.defaultMarkup || 30.00;
        } else if (strategy === 'matrix') {
            markup = this.getMarkupFromMatrix(part);
        } else if (strategy === 'tiers') {
            markup = this.getMarkupFromTiers(basePrice);
        }
        
        const markedUpPrice = basePrice * (1 + markup / 100);
        
        return {
            originalPrice: basePrice,
            markupPercentage: markup,
            markedUpPrice: markedUpPrice,
            markupAmount: markedUpPrice - basePrice
        };
    }

    /**
     * Get markup from parts matrix
     */
    getMarkupFromMatrix(part) {
        const matrix = this.settings.partsMarkupMatrix || {};
        const partName = (part.name || part.description || '').toLowerCase();
        
        // Search for matching category
        for (const [category, config] of Object.entries(matrix)) {
            if (category !== 'default' && partName.includes(category)) {
                return config.markup || 30.00;
            }
        }
        
        // Use default
        return matrix.default?.markup || 30.00;
    }

    /**
     * Get markup from price tiers
     */
    getMarkupFromTiers(price) {
        const tiers = this.settings.partsPricingTiers || [];
        
        for (const tier of tiers) {
            if (price >= tier.minPrice && price < tier.maxPrice) {
                return tier.markup || 30.00;
            }
        }
        
        return this.settings.defaultMarkup || 30.00;
    }

    /**
     * Calculate labor cost with multipliers
     */
    calculateLaborCost(hours) {
        const baseRate = this.settings.laborRate || 100.00;
        const multiplier = this.settings.laborMultiplier || 1.0;
        const timeMultiplier = this.settings.laborTimeMultiplier || 1.0;
        
        const adjustedHours = hours * timeMultiplier;
        const effectiveRate = baseRate * multiplier;
        const totalCost = adjustedHours * effectiveRate;
        
        return {
            originalHours: hours,
            adjustedHours: adjustedHours,
            baseRate: baseRate,
            effectiveRate: effectiveRate,
            totalCost: totalCost
        };
    }

    /**
     * Get parts stores by priority
     */
    getPartsStores() {
        return (this.settings.partsStores || [])
            .sort((a, b) => (a.priority || 999) - (b.priority || 999));
    }

    /**
     * Add parts store
     */
    addPartsStore(store) {
        const stores = this.settings.partsStores || [];
        store.id = store.id || `store_${Date.now()}`;
        store.priority = store.priority || 999;
        
        this.settings.partsStores.push(store);
        
        return store;
    }

    /**
     * Update parts store
     */
    updatePartsStore(storeId, updates) {
        const stores = this.settings.partsStores || [];
        const index = stores.findIndex(s => s.id === storeId);
        
        if (index !== -1) {
            stores[index] = { ...stores[index], ...updates };
            return stores[index];
        }
        
        return null;
    }

    /**
     * Delete parts store
     */
    deletePartsStore(storeId) {
        this.settings.partsStores = (this.settings.partsStores || [])
            .filter(s => s.id !== storeId);
        
        return true;
    }

    /**
     * Get credentials (only return if provided)
     */
    getCredentials(service) {
        const serviceSettings = this.settings[service];
        
        if (!serviceSettings || !serviceSettings.enabled) {
            return null;
        }
        
        return {
            enabled: serviceSettings.enabled,
            ...serviceSettings
        };
    }

    /**
     * Update parts markup matrix
     */
    updatePartsMarkupMatrix(category, config) {
        if (!this.settings.partsMarkupMatrix) {
            this.settings.partsMarkupMatrix = {};
        }
        
        this.settings.partsMarkupMatrix[category] = config;
        
        return this.settings.partsMarkupMatrix[category];
    }

    /**
     * Export settings (for backup)
     */
    exportSettings() {
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            settings: this.settings
        };
    }

    /**
     * Import settings (for restore)
     */
    importSettings(importedData) {
        try {
            if (!importedData || !importedData.settings) {
                throw new Error('Invalid import data');
            }
            
            this.settings = { ...this.defaults, ...importedData.settings };
            
            return { success: true, settings: this.settings };
        } catch (error) {
            console.error('Error importing settings:', error);
            throw error;
        }
    }

    /**
     * Validate settings
     */
    validateSettings(settings) {
        const errors = [];
        
        // Validate shop info
        if (!settings.shopName) errors.push('Shop name is required');
        if (!settings.shopPhone) errors.push('Shop phone is required');
        if (!settings.shopEmail) errors.push('Shop email is required');
        
        // Validate rates
        if (settings.laborRate < 0) errors.push('Labor rate must be positive');
        if (settings.taxRate < 0 || settings.taxRate > 1) errors.push('Tax rate must be between 0 and 1');
        
        // Validate markup
        if (settings.defaultMarkup < 0 || settings.defaultMarkup > 100) {
            errors.push('Default markup must be between 0 and 100');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = ShopSettingsService;