<![CDATA[
// Shop Settings Service - Updated for VAPI (NOT Google Cloud)
// NO Auto Labor - using Nexpart for labor times
const fs = require('fs').promises;
const path = require('path');

class ShopSettingsService {
    constructor(settingsFile = './shop-settings.json') {
        this.settingsFile = settingsFile;
        this.settings = null;
    }

    async loadSettings() {
        try {
            const data = await fs.readFile(this.settingsFile, 'utf8');
            this.settings = JSON.parse(data);
        } catch (error) {
            // Create default settings if file doesn't exist
            this.settings = this.getDefaultSettings();
            await this.saveSettings();
        }
        return this.settings;
    }

    getDefaultSettings() {
        return {
            shopInfo: {
                shopName: 'VHICL Pro Shop',
                shopPhone: '(555) 123-4567',
                shopEmail: 'info@vhiclpro.com',
                shopAddress: '123 Main St, Anytown, USA',
                shopWebsite: '',
                businessHours: {
                    monday: { open: '08:00', close: '17:00', closed: false },
                    tuesday: { open: '08:00', close: '17:00', closed: false },
                    wednesday: { open: '08:00', close: '17:00', closed: false },
                    thursday: { open: '08:00', close: '17:00', closed: false },
                    friday: { open: '08:00', close: '17:00', closed: false },
                    saturday: { open: '08:00', close: '12:00', closed: false },
                    sunday: { closed: true }
                }
            },
            // VAPI for ALEX (NOT Google Cloud)
            vapi: {
                enabled: true,
                apiKey: '',
                phoneId: '',
                phoneNumber: '',
                assistantId: ''
            },
            // Nexpart for Parts & Labor (NO Auto Labor)
            nexpart: {
                enabled: false,
                username: '',
                password: '',
                accountNumber: '',
                customerId: '',
                useForLabor: true,
                useForParts: true,
                useForVIN: true
            },
            // License Plate Lookup (RapidAPI)
            licensePlate: {
                enabled: false,
                apiKey: '',
                provider: 'plaque' // or rapidapi
            },
            // Email (SendGrid)
            email: {
                enabled: false,
                provider: 'sendgrid',
                sendgridApiKey: '',
                fromEmail: '',
                fromName: 'VHICL Pro'
            },
            // Payment Providers
            payment: {
                primaryProvider: 'paypal', // paypal, stripe, square, etc.
                paypal: {
                    enabled: false,
                    mode: 'sandbox', // sandbox or live
                    clientId: '',
                    clientSecret: '',
                    webhookId: ''
                },
                stripe: {
                    enabled: false,
                    publishableKey: '',
                    secretKey: '',
                    webhookSecret: ''
                },
                square: {
                    enabled: false,
                    accessToken: '',
                    locationId: '',
                    environment: 'sandbox' // sandbox or production
                }
            },
            // Pricing
            pricing: {
                laborRate: 100,
                diagnosticRate: 120,
                diagnosticFee: 50,
                laborMultiplier: 1.0,
                taxRate: 7, // Percentage (7% = 0.07 in calculations)
                shopSuppliesFee: 0,
                disposalFee: 0,
                partsMarkup: 30, // Percentage
                partsMarkupStrategy: 'percentage', // percentage, matrix, tiers
                partsMarkupMatrix: {
                    'Electrical': 40,
                    'Brakes': 35,
                    'Filters': 25,
                    'Fluids': 20,
                    'Suspension': 45,
                    'Tires': 25,
                    'Default': 30
                }
            },
            // Labor - Nexpart only (NO Auto Labor)
            labor: {
                source: 'nexpart', // nexpart ONLY (removed auto-labor-experts)
                nexpartEnabled: false
            },
            // Quotes & Invoices
            quotesInvoices: {
                autoIncludeFees: true,
                quoteExpirationDays: 30,
                requireApproval: false,
                invoiceTerms: 'Net 30',
                lateFeePercent: 5,
                lateFeeDays: 30
            },
            // System Configuration
            system: {
                timezone: 'America/New_York',
                dateFormat: 'MM/DD/YYYY',
                timeFormat: '12h',
                currency: 'USD'
            },
            // Feature Flags
            features: {
                partsScraping: true,
                laborScraping: true,
                voiceCalling: true,
                emailNotifications: false,
                paymentProcessing: false,
                socialMediaAutoPost: false,
                inventoryManagement: true
            },
            // Social Media
            socialMedia: {
                autoPostWeekly: false,
                postDay: 'monday',
                postTime: '10:00',
                facebook: { enabled: false, pageId: '', accessToken: '' },
                instagram: { enabled: false, businessAccountId: '', accessToken: '' },
                twitter: { enabled: false, apiKey: '', apiSecret: '', accessToken: '' },
                linkedin: { enabled: false, accessToken: '' },
                tiktok: { enabled: false, accessToken: '' },
                googleBusiness: { enabled: false, apiKey: '' },
                yelp: { enabled: false, apiKey: '' }
            },
            // Parts Stores
            partsStores: [
                {
                    id: 'store-1',
                    name: "O'Reilly Auto Parts",
                    type: 'chain',
                    city: 'Anytown',
                    state: 'US',
                    phone: '(555) 111-2222',
                    distance: 2.5,
                    contact: 'John',
                    rating: 4.5,
                    discountRate: 10,
                    deliveryTime: '2 hours',
                    ordersThisWeek: 12
                }
            ],
            // ALEX Configuration
            alex: {
                enabled: true,
                autoCallStores: false,
                autoOrderParts: false,
                checkVehicleStatus: true,
                bookAppointments: true,
                provideEstimates: true,
                approveWork: true,
                checkPartsAvailability: true,
                getShopHours: true,
                takeMessages: true,
                panicMode: true,
                servicesWeDontDo: []
            }
        };
    }

    async saveSettings(settings = this.settings) {
        this.settings = settings;
        await fs.writeFile(this.settingsFile, JSON.stringify(settings, null, 2));
        return this.settings;
    }

    async updateSettings(updates) {
        if (!this.settings) {
            await this.loadSettings();
        }
        
        // Deep merge updates
        this.settings = this.deepMerge(this.settings, updates);
        await this.saveSettings();
        return this.settings;
    }

    deepMerge(target, source) {
        const output = { ...target };
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    async getSettings(maskSecrets = true) {
        if (!this.settings) {
            await this.loadSettings();
        }
        
        if (maskSecrets) {
            return this.maskSecrets(this.settings);
        }
        return this.settings;
    }

    maskSecrets(settings) {
        const masked = JSON.parse(JSON.stringify(settings));
        
        // Mask VAPI keys
        if (masked.vapi?.apiKey) {
            masked.vapi.apiKey = this.maskApiKey(masked.vapi.apiKey);
        }
        if (masked.vapi?.phoneId) {
            masked.vapi.phoneId = this.maskApiKey(masked.vapi.phoneId);
        }
        
        // Mask Nexpart credentials
        if (masked.nexpart?.password) {
            masked.nexpart.password = this.maskApiKey(masked.nexpart.password);
        }
        
        // Mask license plate API key
        if (masked.licensePlate?.apiKey) {
            masked.licensePlate.apiKey = this.maskApiKey(masked.licensePlate.apiKey);
        }
        
        // Mask SendGrid API key
        if (masked.email?.sendgridApiKey) {
            masked.email.sendgridApiKey = this.maskApiKey(masked.email.sendgridApiKey);
        }
        
        // Mask PayPal client secret
        if (masked.payment?.paypal?.clientSecret) {
            masked.payment.paypal.clientSecret = this.maskApiKey(masked.payment.paypal.clientSecret);
        }
        
        // Mask Stripe secret key
        if (masked.payment?.stripe?.secretKey) {
            masked.payment.stripe.secretKey = this.maskApiKey(masked.payment.stripe.secretKey);
        }
        
        // Mask Square access token
        if (masked.payment?.square?.accessToken) {
            masked.payment.square.accessToken = this.maskApiKey(masked.payment.square.accessToken);
        }
        
        // Mask social media tokens
        Object.values(masked.socialMedia).forEach(platform => {
            if (platform.accessToken) {
                platform.accessToken = this.maskApiKey(platform.accessToken);
            }
            if (platform.apiKey) {
                platform.apiKey = this.maskApiKey(platform.apiKey);
            }
            if (platform.apiSecret) {
                platform.apiSecret = this.maskApiKey(platform.apiSecret);
            }
        });
        
        return masked;
    }

    maskApiKey(key) {
        if (!key || key.length < 8) return '****';
        return key.substring(0, 4) + '****' + key.substring(key.length - 4);
    }
}

module.exports = ShopSettingsService; < 8) return '••••••••';
        const start = key.substring(0, 4);
        const end = key.substring(key.length - 4);
        return `${start}${'•'.repeat(Math.min(key.length - 8, 20))}${end}`;
    }

    // ALEX-specific methods
    async getALEXConfig() {
        const settings = await this.getSettings();
        return {
            enabled: settings.alex.enabled,
            shopName: settings.shopInfo.shopName,
            shopPhone: settings.shopInfo.shopPhone,
            shopAddress: settings.shopInfo.shopAddress,
            shopEmail: settings.shopInfo.shopEmail,
            businessHours: settings.shopInfo.businessHours,
            vapiKey: settings.vapi.apiKey,
            phoneId: settings.vapi.phoneId,
            phoneNumber: settings.vapi.phoneNumber,
            assistantId: settings.vapi.assistantId,
            servicesWeDontDo: settings.alex.servicesWeDontDo,
            nexpartEnabled: settings.nexpart.enabled
        };
    }

    async updateALEXConfig(config) {
        return await this.updateSettings({
            alex: config,
            vapi: config.vapi || {}
        });
    }

    async updateALEXServicesWeDontDo(services) {
        return await this.updateSettings({
            alex: {
                servicesWeDontDo: services
            }
        });
    }

    async checkALEXService(serviceType) {
        const settings = await this.getSettings();
        const servicesWeDontDo = settings.alex.servicesWeDontDo || [];
        return !servicesWeDontDo.includes(serviceType);
    }
}

module.exports = ShopSettingsService;
]]>
