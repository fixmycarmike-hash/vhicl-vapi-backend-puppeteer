const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Import all services
const ShopSettingsService = require('./shop-settings-service.js');
const LaborService = require('./labor-service.js');
const EmailService = require('./email-service-updated.js');
const NexpartScraper = require('./nexpart-scraper.js');
const AutoLaborScraper = require('./auto-labor-scraper.js');
const VapiPartsCalling = require('./vapi-parts-calling.js');
const VapiPartsOrdering = require('./vapi-parts-ordering.js');
const VapiCarIntake = require('./vapi-car-intake.js');
const IntakeEndpoints = require('./intake-endpoints.js');
const PartsQuoteComparator = require('./parts-quote-comparator.js');
const SmartQuoteSelector = require('./smart-quote-selector.js');
const PartsStoreDirectory = require('./parts-store-directory.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize services
let shopSettingsService;
let laborService;
let emailService;
let partsStoreDirectory;
let nexpartScraper;
let autoLaborScraper;

// ALEX Configuration
let alexConfig = {
    servicesWeDontDo: [], // Services ALEX shouldn't book
    autoCallEnabled: true,
    autoOrderEnabled: true,
    appointmentConfirmationEnabled: true
};

// Initialize all services
async function initializeServices() {
    try {
        console.log('🔧 Initializing VHICL Pro services...');
        
        // Initialize shop settings
        shopSettingsService = require('./shop-settings-service.js');
        const settings = await shopSettingsService.getSettings();
        
        // Initialize labor service
        laborService = new LaborService({
            shopId: 'default',
            laborRate: settings.labor?.laborRate || 100,
            laborMultiplier: settings.labor?.laborMultiplier || 1.0
        });
        
        // Initialize email service
        emailService = new EmailService({
            apiKey: settings.email?.sendgridApiKey || '',
            fromEmail: settings.email?.sendgridFromEmail || '',
            fromName: settings.email?.sendgridFromName || 'VHICL Pro'
        });
        
        // Initialize parts store directory
        partsStoreDirectory = new PartsStoreDirectory();
        
        // Initialize scrapers if credentials exist
        if (settings.scrapers?.enableNexpartScraper && 
            settings.scrapers?.nexpartUsername && 
            settings.scrapers?.nexpartPassword) {
            nexpartScraper = new NexpartScraper({
                username: settings.scrapers.nexpartUsername,
                password: settings.scrapers.nexpartPassword,
                accountNumber: settings.scrapers.nexpartAccountNumber
            });
            console.log('✅ Nexpart scraper initialized');
        }
        
        if (settings.scrapers?.enableAutoLaborScraper && 
            settings.scrapers?.autoLaborUsername && 
            settings.scrapers?.autoLaborPassword) {
            autoLaborScraper = new AutoLaborScraper({
                username: settings.scrapers.autoLaborUsername,
                password: settings.scrapers.autoLaborPassword
            });
            console.log('✅ Auto Labor scraper initialized');
        }
        
        // Load ALEX configuration
        alexConfig.servicesWeDontDo = settings.alex?.servicesWeDontDo || [];
        alexConfig.autoCallEnabled = settings.alex?.autoCallEnabled !== false;
        alexConfig.autoOrderEnabled = settings.alex?.autoOrderEnabled !== false;
        alexConfig.appointmentConfirmationEnabled = settings.alex?.appointmentConfirmationEnabled !== false;
        
        console.log('✅ All services initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing services:', error);
        // Continue anyway with default settings
    }
}

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            shopSettings: !!shopSettingsService,
            laborService: !!laborService,
            emailService: !!emailService,
            partsStoreDirectory: !!partsStoreDirectory,
            nexpartScraper: !!nexpartScraper,
            autoLaborScraper: !!autoLaborScraper
        }
    });
});

// ==================== SHOP SETTINGS ====================

app.get('/api/shop/settings', async (req, res) => {
    try {
        const settings = await shopSettingsService.getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/shop/settings', async (req, res) => {
    try {
        const settings = await shopSettingsService.updateSettings(req.body);
        
        // Update ALEX configuration
        if (settings.alex) {
            alexConfig.servicesWeDontDo = settings.alex.servicesWeDontDo || [];
            alexConfig.autoCallEnabled = settings.alex.autoCallEnabled !== false;
            alexConfig.autoOrderEnabled = settings.alex.autoOrderEnabled !== false;
        }
        
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ALEX CONFIGURATION ====================

app.get('/api/alex/config', (req, res) => {
    res.json({
        servicesWeDontDo: alexConfig.servicesWeDontDo,
        autoCallEnabled: alexConfig.autoCallEnabled,
        autoOrderEnabled: alexConfig.autoOrderEnabled,
        appointmentConfirmationEnabled: alexConfig.appointmentConfirmationEnabled
    });
});

app.post('/api/alex/services-we-dont-do', (req, res) => {
    try {
        const { services } = req.body;
        alexConfig.servicesWeDontDo = services || [];
        
        // Save to shop settings
        shopSettingsService.updateSettings({
            alex: alexConfig
        });
        
        res.json({ success: true, servicesWeDontDo: alexConfig.servicesWeDontDo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/alex/check-service', (req, res) => {
    const { service } = req.body;
    const isNotAllowed = alexConfig.servicesWeDontDo.some(
        s => s.toLowerCase().includes(service.toLowerCase())
    );
    res.json({ allowed: !isNotAllowed, reason: isNotAllowed ? 'Service not offered' : null });
});

// ==================== LABOR SERVICE ====================

app.get('/api/labor/operations', (req, res) => {
    try {
        const operations = laborService.getAllOperations();
        res.json(operations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/labor/operations/:id', (req, res) => {
    try {
        const operation = laborService.getOperationById(req.params.id);
        if (!operation) {
            return res.status(404).json({ error: 'Operation not found' });
        }
        res.json(operation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/labor/categories', (req, res) => {
    try {
        const categories = laborService.getCategories();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/labor/search', (req, res) => {
    try {
        const results = laborService.searchOperations(req.query.q);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/labor/estimate/:operationId', async (req, res) => {
    try {
        const estimate = await laborService.getLaborEstimate(req.params.operationId);
        res.json(estimate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/labor/quick-estimate', async (req, res) => {
    try {
        const { description } = req.body;
        
        // Try scraper first if enabled
        let laborTime = null;
        if (autoLaborScraper) {
            try {
                laborTime = await autoLaborScraper.scrapeLaborTime(description);
            } catch (scraperError) {
                console.log('Scraper failed, using database:', scraperError.message);
            }
        }
        
        // Fallback to database
        if (!laborTime) {
            laborTime = await laborService.quickEstimate(description);
        }
        
        const settings = await shopSettingsService.getSettings();
        const laborRate = settings.labor?.laborRate || 100;
        const multiplier = settings.labor?.laborMultiplier || 1.0;
        
        const estimate = {
            description,
            hours: laborTime.hours,
            laborRate,
            multiplier,
            laborCost: laborTime.hours * laborRate * multiplier
        };
        
        res.json(estimate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== PARTS PRICING ====================

app.get('/api/parts/search', async (req, res) => {
    try {
        const { partNumber, description } = req.query;
        
        let prices = [];
        
        // Try Nexpart scraper if enabled
        if (nexpartScraper) {
            try {
                const nexpartResult = await nexpartScraper.searchParts({
                    partNumber,
                    description
                });
                prices = prices.concat(nexpartResult);
            } catch (error) {
                console.log('Nexpart scraper error:', error.message);
            }
        }
        
        // Apply markup from settings
        const settings = await shopSettingsService.getSettings();
        const partsPricing = settings.partsPricing || {};
        
        prices = prices.map(price => {
            let markup = partsPricing.defaultPartsMarkup || 40;
            
            // Use matrix if enabled
            if (partsPricing.partsMarkupStrategy === 'matrix') {
                const category = categorizePart(price.description);
                markup = partsPricing.markupMatrix?.[category] || markup;
            }
            
            // Use tiers if enabled
            if (partsPricing.partsMarkupStrategy === 'tiers') {
                markup = getMarkupForPriceRange(price.cost, partsPricing.pricingTiers);
            }
            
            return {
                ...price,
                markup: markup,
                sellingPrice: price.cost * (1 + markup / 100)
            };
        });
        
        res.json(prices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/parts/check-availability', async (req, res) => {
    try {
        const { parts } = req.body;
        const availability = [];
        
        for (const part of parts) {
            // Try Nexpart scraper
            if (nexpartScraper) {
                try {
                    const result = await nexpartScraper.checkAvailability(part);
                    availability.push(result);
                } catch (error) {
                    availability.push({ part, available: false, error: error.message });
                }
            } else {
                availability.push({ part, available: false, message: 'Nexpart not configured' });
            }
        }
        
        res.json(availability);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to categorize parts
function categorizePart(description) {
    const desc = description.toLowerCase();
    
    if (desc.includes('alternator')) return 'alternators';
    if (desc.includes('starter')) return 'starters';
    if (desc.includes('battery')) return 'batteries';
    if (desc.includes('spark plug')) return 'sparkPlugs';
    if (desc.includes('ignition coil')) return 'ignitionCoils';
    if (desc.includes('brake pad')) return 'brakePads';
    if (desc.includes('rotor')) return 'rotors';
    if (desc.includes('caliper')) return 'calipers';
    if (desc.includes('brake shoe')) return 'brakeShoes';
    if (desc.includes('oil filter')) return 'oilFilter';
    if (desc.includes('air filter')) return 'airFilter';
    if (desc.includes('fuel filter')) return 'fuelFilter';
    if (desc.includes('cabin')) return 'cabinAirFilter';
    if (desc.includes('motor oil')) return 'motorOil';
    if (desc.includes('transmission fluid')) return 'transmissionFluid';
    if (desc.includes('brake fluid')) return 'brakeFluid';
    if (desc.includes('coolant')) return 'coolant';
    if (desc.includes('power steering')) return 'powerSteering';
    if (desc.includes('shock')) return 'shocks';
    if (desc.includes('strut')) return 'struts';
    if (desc.includes('ball joint')) return 'ballJoints';
    if (desc.includes('control arm')) return 'controlArms';
    if (desc.includes('tie rod')) return 'tieRodEnds';
    if (desc.includes('tire')) return 'tires';
    if (desc.includes('wheel')) return 'wheels';
    
    return 'default';
}

// Helper function to get markup for price range
function getMarkupForPriceRange(cost, tiers) {
    if (!tiers) return 40;
    
    if (cost < 25) return tiers.under25 || 50;
    if (cost < 50) return tiers['25to50'] || 45;
    if (cost < 100) return tiers['50to100'] || 40;
    if (cost < 250) return tiers['100to250'] || 35;
    if (cost < 500) return tiers['250to500'] || 30;
    return tiers.over500 || 25;
}

// ==================== PARTS STORES ====================

app.get('/api/parts/stores', (req, res) => {
    try {
        const stores = partsStoreDirectory.getAllStores();
        res.json(stores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/parts/stores/:storeId', (req, res) => {
    try {
        const store = partsStoreDirectory.getStoreById(req.params.storeId);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json(store);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/parts/stores', (req, res) => {
    try {
        const store = partsStoreDirectory.addStore(req.body);
        res.json(store);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/parts/stores/:storeId', (req, res) => {
    try {
        const store = partsStoreDirectory.updateStore(req.params.storeId, req.body);
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json(store);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/parts/stores/:storeId', (req, res) => {
    try {
        const success = partsStoreDirectory.deleteStore(req.params.storeId);
        if (!success) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ALEX VOICE CALLING ====================

app.post('/api/alex/call-stores', async (req, res) => {
    try {
        if (!alexConfig.autoCallEnabled) {
            return res.status(400).json({ error: 'ALEX auto-calling is disabled' });
        }
        
        const { parts } = req.body;
        const vapi = new VapiPartsCalling({
            apiKey: (await shopSettingsService.getSettings()).voice?.vapiApiKey
        });
        
        const results = await vapi.callMultipleStores(parts);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/alex/order-parts', async (req, res) => {
    try {
        if (!alexConfig.autoOrderEnabled) {
            return res.status(400).json({ error: 'ALEX auto-ordering is disabled' });
        }
        
        const { storeId, parts } = req.body;
        const vapi = new VapiPartsOrdering({
            apiKey: (await shopSettingsService.getSettings()).voice?.vapiApiKey
        });
        
        const result = await vapi.orderParts(storeId, parts);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CAR INTAKE ====================

app.post('/api/intake/start', async (req, res) => {
    try {
        const vapi = new VapiCarIntake({
            apiKey: (await shopSettingsService.getSettings()).voice?.vapiApiKey,
            servicesWeDontDo: alexConfig.servicesWeDontDo
        });
        
        const intake = await vapi.startIntake(req.body);
        res.json(intake);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/intake/complete', async (req, res) => {
    try {
        const intake = new IntakeEndpoints();
        const result = await intake.completeIntake(req.body);
        
        // Send confirmation email if enabled
        if (alexConfig.appointmentConfirmationEnabled && emailService) {
            await emailService.sendAppointmentConfirmation(req.body);
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== EMAIL SERVICE ====================

app.post('/api/email/send', async (req, res) => {
    try {
        const { to, subject, html } = req.body;
        const result = await emailService.sendEmail(to, subject, html);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/email/work-order', async (req, res) => {
    try {
        const result = await emailService.sendWorkOrder(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/email/appointment-confirmation', async (req, res) => {
    try {
        const result = await emailService.sendAppointmentConfirmation(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ANALYTICS ====================

app.get('/api/analytics/overview', async (req, res) => {
    try {
        const settings = await shopSettingsService.getSettings();
        
        // In production, this would query a database
        // For now, return placeholder data structure
        res.json({
            today: {
                revenue: 0,
                jobs: 0,
                appointments: 0,
                walkIns: 0
            },
            thisWeek: {
                revenue: 0,
                jobs: 0,
                appointments: 0,
                walkIns: 0
            },
            thisMonth: {
                revenue: 0,
                jobs: 0,
                appointments: 0,
                walkIns: 0
            },
            thisYear: {
                revenue: 0,
                jobs: 0,
                appointments: 0,
                walkIns: 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/labor', async (req, res) => {
    try {
        const operations = laborService.getAllOperations();
        res.json({
            totalOperations: operations.length,
            categories: laborService.getCategories(),
            averageLaborTime: operations.reduce((sum, op) => sum + op.hours, 0) / operations.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/parts', async (req, res) => {
    try {
        const stores = partsStoreDirectory.getAllStores();
        res.json({
            totalStores: stores.length,
            activeStores: stores.filter(s => s.active).length,
            averageDiscount: stores.reduce((sum, s) => sum + (s.discountRate || 0), 0) / stores.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== START SERVER ====================

async function startServer() {
    await initializeServices();
    
    app.listen(PORT, () => {
        console.log('🚀 VHICL Pro Production Backend running on port', PORT);
        console.log('📊 Health check: http://localhost:' + PORT + '/health');
        console.log('📞 ALEX voice assistant: ' + (alexConfig.autoCallEnabled ? 'ENABLED' : 'DISABLED'));
        console.log('⚙️ Nexpart scraper: ' + (nexpartScraper ? 'ENABLED' : 'DISABLED'));
        console.log('⏱️  Auto Labor scraper: ' + (autoLaborScraper ? 'ENABLED' : 'DISABLED'));
    });
}

startServer();
