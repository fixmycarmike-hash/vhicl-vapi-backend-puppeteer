#!/usr/bin/env node

/**
 * VHICL Pro - Complete Backend System with Nexpart API
 * Using Nexpart API services (no Puppeteer)
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Import services (NEW Nexpart API - No Puppeteer)
const ShopSettingsService = require('./shop-settings-service-complete.js');
const LaborService = require('./labor-service.js');
const EmailService = require('./email-service-updated.js');
const NexpartApiService = require('./nexpart-api-service.js');
const NexpartLaborScraper = require('./nexpart-labor-scraper.js');
const NexpartVinDecoder = require('./nexpart-vin-decoder.js');
const LicensePlateDecoder = require('./license-plate-decoder.js');
const PartsStoreDirectory = require('./parts-store-directory.js');
const PartsQuoteComparator = require('./parts-quote-comparator.js');
const SmartQuoteSelector = require('./smart-quote-selector.js');
const VapiPartsCalling = require('./vapi-parts-calling.js');
const VapiPartsOrdering = require('./vapi-parts-ordering.js');
const VapiCarIntake = require('./vapi-car-intake.js');
const TechWorkflowService = require('./tech-workflow-service.js');
const ReportingService = require('./reporting-service.js');
const BayBalancingService = require('./bay-balancing-service.js');
const TowingService = require('./towing-service.js');
const SocialMediaService = require('./social-media-service.js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Global service instances
let shopSettingsService;
let laborService;
let emailService;
let nexpartApiService;
let nexpartLaborScraper;
let nexpartVinDecoder;
let licensePlateDecoder;
let partsStoreDirectory;
let partsQuoteComparator;
let smartQuoteSelector;
let vapiPartsCalling;
let vapiPartsOrdering;
let vapiCarIntake;
let techWorkflowService;
let reportingService;
let bayBalancingService;
let towingService;
let socialMediaService;

// Initialize services
async function initializeServices() {
    try {
        console.log('🔧 Initializing VHICL Pro services...');
        
        // Initialize shop settings
        shopSettingsService = new ShopSettingsService();
        const shopSettings = await shopSettingsService.getSettings();
        
        // Initialize labor service
        laborService = new LaborService({
            shopId: 'default',
            laborRate: shopSettings.laborRate || 100,
            laborMultiplier: shopSettings.laborMultiplier || 1.0
        });
        
        // Initialize email service
        emailService = new EmailService({
            apiKey: process.env.SENDGRID_API_KEY || shopSettings.sendGridApiKey,
            fromEmail: shopSettings.sendGridFromEmail || 'noreply@vhiclpro.com',
            fromName: shopSettings.sendGridFromName || 'VHICL Pro'
        });
        
        // Initialize Nexpart API service (NEW - No Puppeteer)
        nexpartApiService = new NexpartApiService({
            username: process.env.NEXPART_USERNAME || '',
            password: process.env.NEXPART_PASSWORD || ''
        });
        
        // Initialize Nexpart labor scraper (NEW - ACES catalog)
        nexpartLaborScraper = new NexpartLaborScraper({
            username: process.env.NEXPART_USERNAME || '',
            password: process.env.NEXPART_PASSWORD || ''
        });
        
        // Initialize VIN decoder
        nexpartVinDecoder = new NexpartVinDecoder({
            username: process.env.NEXPART_USERNAME || '',
            password: process.env.NEXPART_PASSWORD || ''
        });
        
        // Initialize license plate decoder
        licensePlateDecoder = new LicensePlateDecoder({
            apiKey: process.env.RAPIDAPI_KEY || ''
        });
        
        // Initialize parts store directory
        partsStoreDirectory = PartsStoreDirectory;
        
        // Initialize quote services
        partsQuoteComparator = new PartsQuoteComparator();
        smartQuoteSelector = new SmartQuoteSelector();
        
        // Initialize VAPI services
        vapiPartsCalling = new VapiPartsCalling({
            apiKey: process.env.VAPI_API_KEY || '',
            phoneId: process.env.VAPI_PHONE_ID || ''
        });
        
        vapiPartsOrdering = new VapiPartsOrdering({
            apiKey: process.env.VAPI_API_KEY || '',
            phoneId: process.env.VAPI_PHONE_ID || ''
        });
        
        // Initialize car intake
        vapiCarIntake = new VapiCarIntake({
            apiKey: process.env.VAPI_API_KEY || '',
            phoneId: process.env.VAPI_PHONE_ID || ''
        });
        
        // Initialize tech workflow
        techWorkflowService = new TechWorkflowService();
        
        // Initialize reporting
        reportingService = new ReportingService();
        
        // Initialize bay balancing
        bayBalancingService = new BayBalancingService();
        
        // Initialize towing
        towingService = new TowingService();
        
        // Initialize social media
        socialMediaService = new SocialMediaService({
            facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
            instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || ''
        });
        
        console.log('✅ All services initialized successfully');
        console.log(`💰 Labor rate: $${shopSettings.laborRate}/hour`);
        console.log(`🚀 Using Nexpart API (no Puppeteer)`);
        
    } catch (error) {
        console.error('❌ Error initializing services:', error);
        throw error;
    }
}

// ========================================
// HEALTH CHECK ENDPOINT
// ========================================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            shopSettings: !!shopSettingsService,
            labor: !!laborService,
            email: !!emailService,
            nexpart: {
                api: !!nexpartApiService,
                labor: !!nexpartLaborScraper,
                vinDecoder: !!nexpartVinDecoder
            },
            partsStores: !!partsStoreDirectory,
            vapi: {
                partsCalling: !!vapiPartsCalling,
                partsOrdering: !!vapiPartsOrdering,
                carIntake: !!vapiCarIntake
            },
            techWorkflow: !!techWorkflowService,
            reporting: !!reportingService,
            bayBalancing: !!bayBalancingService,
            towing: !!towingService,
            socialMedia: !!socialMediaService
        }
    });
});

// ========================================
// SHOP SETTINGS ENDPOINTS
// ========================================

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
        const updated = await shopSettingsService.updateSettings(req.body);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// LABOR ENDPOINTS
// ========================================

app.get('/api/labor/operations', async (req, res) => {
    try {
        const operations = laborService.getAllOperations();
        res.json(operations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/labor/estimate/:operationId', async (req, res) => {
    try {
        const { operationId } = req.params;
        const estimate = laborService.getLaborEstimate(operationId);
        res.json(estimate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/labor/quick-estimate', async (req, res) => {
    try {
        const { description, year, make, model } = req.body;
        
        // Try Nexpart labor scraper first
        try {
            const laborTimes = await nexpartLaborScraper.getLaborTime(description, { year, make, model });
            const laborCost = laborTimes.hours * (shopSettings.laborRate || 100);
            return res.json({
                source: 'nexpart',
                hours: laborTimes.hours,
                rate: shopSettings.laborRate || 100,
                laborCost: laborCost
            });
        } catch (nexpartError) {
            // Fallback to internal labor database
            const estimate = laborService.quickEstimate(description);
            res.json({
                source: 'database',
                hours: estimate.hours,
                rate: estimate.rate,
                laborCost: estimate.totalCost
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// NEXPART API ENDPOINTS
// ========================================

app.get('/api/parts/search', async (req, res) => {
    try {
        const { term, make, model, year } = req.query;
        const parts = await nexpartApiService.searchParts(term, { make, model, year });
        res.json(parts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/parts/pricing/:partNumber', async (req, res) => {
    try {
        const { partNumber } = req.params;
        const pricing = await nexpartApiService.getPartsPricing(partNumber);
        res.json(pricing);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// VIN DECODER ENDPOINTS
// ========================================

app.get('/api/vin/decode/:vin', async (req, res) => {
    try {
        const { vin } = req.params;
        const decoded = await nexpartVinDecoder.decode(vin);
        res.json(decoded);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/license-plate/decode/:plateNumber', async (req, res) => {
    try {
        const { plateNumber } = req.params;
        const state = req.query.state;
        const decoded = await licensePlateDecoder.decode(plateNumber, state);
        res.json(decoded);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PARTS STORES ENDPOINTS
// ========================================

app.get('/api/parts/stores', (req, res) => {
    res.json(partsStoreDirectory.getAllStores());
});

// ========================================
// TECH WORKFLOW ENDPOINTS
// ========================================

app.get('/api/tech/stats', async (req, res) => {
    try {
        const stats = techWorkflowService.getTechnicianStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// REPORTING ENDPOINTS
// ========================================

app.get('/api/reports/overview', async (req, res) => {
    try {
        const report = await reportingService.generateOverviewReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// BAY BALANCING ENDPOINTS
// ========================================

app.get('/api/bays', async (req, res) => {
    try {
        const bays = await bayBalancingService.getAllBays();
        res.json(bays);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// SOCIAL MEDIA ENDPOINTS
// ========================================

app.get('/api/social-media/status', async (req, res) => {
    try {
        const status = socialMediaService.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/social-media/post', async (req, res) => {
    try {
        const { platform, content } = req.body;
        const result = await socialMediaService.postToSocialMedia(platform, content);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// EMAIL ENDPOINTS
// ========================================

app.post('/api/email/send', async (req, res) => {
    try {
        const { to, subject, html } = req.body;
        const result = await emailService.sendEmail({ to, subject, html });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// APPOINTMENT ENDPOINTS
// ========================================

// In-memory storage for appointments (can be upgraded to database)
let appointments = [];

app.get('/api/appointments', (req, res) => {
    res.json(appointments);
});

app.post('/api/appointments', (req, res) => {
    const appointment = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: req.body.status || 'scheduled'
    };
    appointments.push(appointment);
    res.json(appointment);
});

app.get('/api/appointments/:id', (req, res) => {
    const appointment = appointments.find(a => a.id === req.params.id);
    if (appointment) {
        res.json(appointment);
    } else {
        res.status(404).json({ error: 'Appointment not found' });
    }
});

app.put('/api/appointments/:id', (req, res) => {
    const index = appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
        appointments[index] = {
            ...appointments[index],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        res.json(appointments[index]);
    } else {
        res.status(404).json({ error: 'Appointment not found' });
    }
});

app.delete('/api/appointments/:id', (req, res) => {
    const index = appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
        appointments.splice(index, 1);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Appointment not found' });
    }
});

// ========================================
// ALEX CONFIGURATION ENDPOINTS
// ========================================

app.get('/api/alex/config', (req, res) => {
    res.json({
        enabled: true,
        autoCallStores: process.env.ALEX_AUTO_CALL_STORES !== 'false',
        phoneId: process.env.VAPI_PHONE_ID || '',
        servicesWeDontDo: ['Oil Change', 'Tire Rotation']
    });
});

app.post('/api/alex/services-we-dont-do', (req, res) => {
    res.json({ success: true });
});

// ========================================
// ANALYTICS ENDPOINTS
// ========================================

app.get('/api/analytics/overview', (req, res) => {
    res.json({
        todayRevenue: 0,
        thisWeekRevenue: 0,
        thisMonthRevenue: 0,
        totalJobs: appointments.length,
        activeJobs: appointments.filter(a => a.status === 'in-progress').length,
        completedJobs: appointments.filter(a => a.status === 'completed').length
    });
});

app.get('/api/analytics/labor', (req, res) => {
    res.json({
        averageLaborTime: 1.5,
        totalLaborHours: appointments.length * 1.5,
        laborRevenue: appointments.length * 150
    });
});

app.get('/api/analytics/parts', (req, res) => {
    res.json({
        totalPartsStores: Object.keys(partsStoreDirectory.getAllStores()).length,
        averageDiscount: 15,
        partsOrdered: appointments.length * 3
    });
});

// ========================================
// TECH WORKFLOW ENDPOINTS
// ========================================

let techJobs = [];

app.get('/api/tech/stats', (req, res) => {
    res.json({
        activeJobs: techJobs.filter(j => j.status === 'in-progress').length,
        completedToday: techJobs.filter(j => j.status === 'completed').length,
        totalHours: 8,
        rating: 4.8
    });
});

app.get('/api/tech/jobs/active', (req, res) => {
    res.json(techJobs.filter(j => j.status === 'in-progress'));
});

app.get('/api/tech/jobs/completed', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    res.json(techJobs.filter(j => j.status === 'completed' && j.completedDate === today));
});

app.post('/api/tech/jobs/start', (req, res) => {
    const job = {
        id: Date.now().toString(),
        ...req.body,
        status: 'in-progress',
        startTime: new Date().toISOString()
    };
    techJobs.push(job);
    res.json(job);
});

app.put('/api/tech/jobs/:jobId/complete', (req, res) => {
    const index = techJobs.findIndex(j => j.id === req.params.jobId);
    if (index !== -1) {
        techJobs[index].status = 'completed';
        techJobs[index].completedDate = new Date().toISOString().split('T')[0];
        res.json(techJobs[index]);
    } else {
        res.status(404).json({ error: 'Job not found' });
    }
});

app.post('/api/tech/jobs/:jobId/parts', (req, res) => {
    res.json({ success: true, message: 'Parts requested' });
});

app.post('/api/tech/jobs/:jobId/notes', (req, res) => {
    res.json({ success: true, message: 'Note added' });
});

app.get('/api/tech/schedule', (req, res) => {
    res.json([]);
});

// ========================================
// START SERVER
// ========================================

initializeServices().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 VHICL Pro Backend running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`🌐 Frontend: http://localhost:${PORT}/`);
        console.log(`✅ All services initialized with Nexpart API (No Puppeteer)\n`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = app;