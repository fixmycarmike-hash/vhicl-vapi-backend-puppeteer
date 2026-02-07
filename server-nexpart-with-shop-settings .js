#!/usr/bin/env node

/**
 * VHICL Pro - Complete Backend System with All Features
 * Multi-Shop Support • Firebase • Branding • Photos • Towing • Tech Workflow • Reports • Bay Balancing
 * 
 * Features:
 * - Multi-Shop Firebase Integration
 * - Shop Branding (logos, colors)
 * - Before/After Photos (Firebase Storage)
 * - Customer Contact Preferences
 * - Towing Integration
 * - Technician Workflow
 * - Comprehensive Reporting
 * - Bay Balancing System
 * - Nexpart Scraper (parts pricing)
 * - Nexpart Labor Scraper (labor times from Nexpart ACES catalog)
 * - ALEX Voice Assistant (VAPI)
 * - Labor Service (30+ operations)
 * - Email Service (SendGrid)
 * - Shop Settings (fully configurable)
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const admin = require('firebase-admin');

// Firebase Configuration
const firebaseServiceAccount = require('./firebase-service-account.json');

// Initialize Firebase Admin
let firebaseApp;
try {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(firebaseServiceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://vhicl-pro-default.firebaseio.com',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'vhicl-pro.appspot.com'
  }, 'vhicl-pro-backend');
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.log('⚠️ Firebase not initialized:', error.message);
}

// Import services
const NexpartScraper = require('./nexpart-scraper.js');
const NexpartLaborScraper = require('./nexpart-labor-scraper.js');
const LaborService = require('./labor-service.js');
const SocialMediaService = require('./social-media-service.js');
const registerSocialMediaEndpoints = require('./social-media-endpoints.js');
const EmailService = require('./email-service-updated.js');
const ShopSettingsService = require('./shop-settings-service.js');

// Import new services
const ShopAuth = require('./firebase-config').ShopAuth;
const ShopRouter = require('./firebase-config').ShopRouter;
const CloudStorageManager = require('./firebase-config').CloudStorageManager;
const ShopBrandingService = require('./shop-branding-service.js');
const PhotoManagementService = require('./photo-management-service.js');
const TowingService = require('./towing-service.js');
const TechWorkflowService = require('./tech-workflow-service.js');
const ReportingService = require('./reporting-service.js');
const BayBalancingService = require('./bay-balancing-service.js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize services
let laborService;
let emailService;
let shopSettingsService;
let shopBrandingService;
let photoManagementService;
let towingService;
let techWorkflowService;
let reportingService;
let bayBalancingService;
let socialMediaService;
let nexpartScraper;
let nexpartLaborScraper;

// Current shop ID (from auth)
let currentShopId = null;

async function initializeServices(shopId = 'default') {
    try {
        console.log('🔧 Initializing services...');
        
        // Set current shop ID
        currentShopId = shopId;
        
        // Load shop settings from Firebase or fallback to file
        let shopSettings;
        try {
            if (firebaseApp) {
                const shopDoc = await admin.firestore().collection('shops').doc(shopId).get();
                if (shopDoc.exists) {
                    shopSettings = shopDoc.data().settings || {};
                }
            }
        } catch (error) {
            console.log('⚠️ Could not load settings from Firebase, using file-based service');
        }
        
        if (!shopSettings) {
            shopSettingsService = new ShopSettingsService();
            shopSettings = await shopSettingsService.getSettings();
        }
        
        // Initialize labor service
        laborService = new LaborService({
            shopId: shopId,
            laborRate: shopSettings.laborRate || 100,
            laborMultiplier: shopSettings.laborMultiplier || 1.0
        });
        
        // Initialize email service
        emailService = new EmailService({
            apiKey: process.env.SENDGRID_API_KEY || shopSettings.sendGridApiKey,
            fromEmail: shopSettings.sendGridFromEmail || 'noreply@vhiclpro.com',
            fromName: shopSettings.sendGridFromName || 'VHICL Pro'
        });
        
        // Initialize new services
        shopBrandingService = new ShopBrandingService();
        photoManagementService = new PhotoManagementService();
        towingService = new TowingService();
        techWorkflowService = new TechWorkflowService();
        reportingService = new ReportingService();
        bayBalancingService = new BayBalancingService();
        
        // Initialize social media service
        socialMediaService = new SocialMediaService(shopSettings);
        
        // Register social media endpoints
        registerSocialMediaEndpoints(app, shopSettingsService);
        
        // Initialize scrapers
        nexpartScraper = new NexpartScraper({
            username: process.env.NEXPART_USERNAME || '',
            password: process.env.NEXPART_PASSWORD || '',
            headless: process.env.SCRAPER_HEADLESS !== 'false'
        });
        
        nexpartLaborScraper = new NexpartLaborScraper(
            process.env.NEXPART_USERNAME || '',
            process.env.NEXPART_PASSWORD || ''
        );
        
        console.log('✅ All services initialized successfully');
        console.log(`💰 Labor rate: $${shopSettings.laborRate || 100}/hour`);
        console.log(`🌐 Scrapers: ${process.env.SCRAPER_HEADLESS !== 'false' ? 'Headless' : 'Headed'}`);
        console.log(`🏪 Current shop: ${shopId}`);
        console.log(`ud83dudcde Social media: ${socialMediaService.validateConfiguration().valid ? 'Configured' : 'Not configured'}`);
        
    } catch (error) {
        console.error('❌ Error initializing services:', error);
        throw error;
    }
}

// ========================================
// MIDDLEWARE
// ========================================

/**
 * Authentication middleware
 * Verifies Firebase ID token and extracts shop ID
 */
async function authenticateRequest(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Allow public endpoints
            if (req.path === '/health' || req.path.startsWith('/public')) {
                return next();
            }
            return res.status(401).json({ error: 'No authorization token provided' });
        }
        
        const token = authHeader.split('Bearer ')[1];
        
        if (!firebaseApp) {
            return res.status(500).json({ error: 'Firebase not initialized' });
        }
        
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        if (!decodedToken.shopId || !decodedToken.role) {
            return res.status(403).json({ error: 'Invalid user claims' });
        }
        
        // Add user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            shopId: decodedToken.shopId,
            role: decodedToken.role
        };
        
        // Initialize services for this shop
        await initializeServices(decodedToken.shopId);
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Role-based access control middleware
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
}

// ========================================
// HEALTH CHECK ENDPOINT
// ========================================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        features: {
            firebase: !!firebaseApp,
            branding: !!shopBrandingService,
            photos: !!photoManagementService,
            towing: !!towingService,
            techWorkflow: !!techWorkflowService,
            reporting: !!reportingService,
            bayBalancing: !!bayBalancingService,
            scrapers: !!nexpartScraper && !!nexpartLaborScraper,
            email: !!emailService,
            labor: !!laborService
        },
        currentShop: currentShopId || 'not set'
    });
});

// ========================================
// AUTHENTICATION ENDPOINTS
// ========================================

/**
 * Register new staff member
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, role, shopId } = req.body;
        
        if (!email || !password || !role || !shopId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const userRecord = await ShopAuth.createStaffAccount(
            email,
            password,
            shopId,
            role,
            { name }
        );
        
        res.status(201).json({
            message: 'Staff member registered successfully',
            uid: userRecord.uid,
            email: userRecord.email
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Login (client creates token, server verifies)
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { idToken } = req.body;
        
        if (!idToken) {
            return res.status(400).json({ error: 'ID token required' });
        }
        
        const userInfo = await ShopAuth.verifyToken(idToken);
        
        // Initialize services for this shop
        await initializeServices(userInfo.shopId);
        
        res.json({
            message: 'Login successful',
            user: userInfo
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
});

/**
 * Verify token
 */
app.get('/api/auth/verify', authenticateRequest, (req, res) => {
    res.json({
        message: 'Token valid',
        user: req.user
    });
});

/**
 * Get all shop staff
 */
app.get('/api/auth/staff', authenticateRequest, requireRole('admin', 'service_advisor'), async (req, res) => {
    try {
        const staff = await ShopAuth.getShopStaff(req.user.shopId);
        res.json({ staff });
    } catch (error) {
        console.error('Error getting staff:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// BRANDING ENDPOINTS
// ========================================

/**
 * Get shop branding
 */
app.get('/api/branding', authenticateRequest, async (req, res) => {
    try {
        const branding = await shopBrandingService.getBranding(req.user.shopId);
        res.json({ branding });
    } catch (error) {
        console.error('Error getting branding:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update shop branding
 */
app.post('/api/branding', authenticateRequest, requireRole('admin'), async (req, res) => {
    try {
        await shopBrandingService.updateBranding(req.user.shopId, req.body);
        res.json({ message: 'Branding updated successfully' });
    } catch (error) {
        console.error('Error updating branding:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Upload shop logo
 */
app.post('/api/branding/logo', authenticateRequest, requireRole('admin'), upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const logoUrl = await shopBrandingService.uploadLogo(
            req.user.shopId,
            req.file.buffer,
            req.file.originalname
        );
        
        res.json({ 
            message: 'Logo uploaded successfully',
            logoUrl 
        });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get CSS variables
 */
app.get('/api/branding/css', authenticateRequest, async (req, res) => {
    try {
        const css = await shopBrandingService.generateCSSVariables(req.user.shopId);
        res.type('text/css').send(css);
    } catch (error) {
        console.error('Error generating CSS:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PHOTO MANAGEMENT ENDPOINTS
// ========================================

/**
 * Upload photo
 */
app.post('/api/photos/upload', authenticateRequest, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { vehicleId, photoType, technicianId, description } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({ error: 'Vehicle ID required' });
        }
        
        const photo = await photoManagementService.uploadPhoto(
            req.user.shopId,
            vehicleId,
            req.file.buffer,
            req.file.originalname,
            {
                photoType: photoType || 'general',
                technicianId: technicianId || req.user.uid,
                description: description || '',
                uploadedBy: req.user.uid,
                contentType: req.file.mimetype
            }
        );
        
        res.status(201).json({
            message: 'Photo uploaded successfully',
            photo
        });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get vehicle photos
 */
app.get('/api/photos/vehicle/:vehicleId', authenticateRequest, async (req, res) => {
    try {
        const photos = await photoManagementService.getVehiclePhotos(
            req.user.shopId,
            req.params.vehicleId
        );
        res.json({ photos });
    } catch (error) {
        console.error('Error getting photos:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get photos by type
 */
app.get('/api/photos/vehicle/:vehicleId/:type', authenticateRequest, async (req, res) => {
    try {
        const photos = await photoManagementService.getPhotosByType(
            req.user.shopId,
            req.params.vehicleId,
            req.params.type
        );
        res.json({ photos });
    } catch (error) {
        console.error('Error getting photos:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get before/after pairs
 */
app.get('/api/photos/before-after/:vehicleId', authenticateRequest, async (req, res) => {
    try {
        const pairs = await photoManagementService.getBeforeAfterPairs(
            req.user.shopId,
            req.params.vehicleId
        );
        res.json({ pairs });
    } catch (error) {
        console.error('Error getting before/after pairs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete photo
 */
app.delete('/api/photos/:photoId', authenticateRequest, async (req, res) => {
    try {
        await photoManagementService.deletePhoto(req.user.shopId, req.params.photoId);
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Attach photo to invoice
 */
app.post('/api/photos/:photoId/invoice/:invoiceId', authenticateRequest, async (req, res) => {
    try {
        await photoManagementService.attachToInvoice(
            req.user.shopId,
            req.params.invoiceId,
            req.params.photoId
        );
        res.json({ message: 'Photo attached to invoice successfully' });
    } catch (error) {
        console.error('Error attaching photo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// TOWING ENDPOINTS
// ========================================

/**
 * Add towing provider
 */
app.post('/api/towing/providers', authenticateRequest, requireRole('admin', 'service_advisor'), async (req, res) => {
    try {
        const provider = await towingService.addProvider(req.user.shopId, req.body);
        res.status(201).json({ provider });
    } catch (error) {
        console.error('Error adding provider:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all towing providers
 */
app.get('/api/towing/providers', authenticateRequest, async (req, res) => {
    try {
        const providers = await towingService.getProviders(req.user.shopId);
        res.json({ providers });
    } catch (error) {
        console.error('Error getting providers:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create towing request
 */
app.post('/api/towing/requests', authenticateRequest, async (req, res) => {
    try {
        const request = await towingService.createRequest(req.user.shopId, req.body);
        res.status(201).json({ request });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get towing request
 */
app.get('/api/towing/requests/:requestId', authenticateRequest, async (req, res) => {
    try {
        const request = await towingService.getRequest(req.user.shopId, req.params.requestId);
        res.json({ request });
    } catch (error) {
        console.error('Error getting request:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all towing requests
 */
app.get('/api/towing/requests', authenticateRequest, async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        
        const requests = await towingService.getRequests(req.user.shopId, filters);
        res.json({ requests });
    } catch (error) {
        console.error('Error getting requests:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update towing request status
 */
app.patch('/api/towing/requests/:requestId/status', authenticateRequest, async (req, res) => {
    try {
        const { status, ...updateData } = req.body;
        
        await towingService.updateRequestStatus(
            req.user.shopId,
            req.params.requestId,
            status,
            updateData
        );
        
        res.json({ message: 'Status updated successfully' });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get towing cost estimate
 */
app.get('/api/towing/estimate', authenticateRequest, async (req, res) => {
    try {
        const estimate = await towingService.calculateCostEstimate(
            req.user.shopId,
            req.query
        );
        res.json({ estimate });
    } catch (error) {
        console.error('Error calculating estimate:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get towing statistics
 */
app.get('/api/towing/statistics', authenticateRequest, async (req, res) => {
    try {
        const stats = await towingService.getStatistics(
            req.user.shopId,
            req.query.period || 'month'
        );
        res.json({ stats });
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// TECHNICIAN WORKFLOW ENDPOINTS
// ========================================

/**
 * Add technician
 */
app.post('/api/technicians', authenticateRequest, requireRole('admin'), async (req, res) => {
    try {
        const technician = await techWorkflowService.addTechnician(req.user.shopId, req.body);
        res.status(201).json({ technician });
    } catch (error) {
        console.error('Error adding technician:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all technicians
 */
app.get('/api/technicians', authenticateRequest, async (req, res) => {
    try {
        const technicians = await techWorkflowService.getTechnicians(req.user.shopId);
        res.json({ technicians });
    } catch (error) {
        console.error('Error getting technicians:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Assign job to technician
 */
app.post('/api/technicians/:techId/jobs/:jobId/assign', authenticateRequest, requireRole('admin', 'service_advisor'), async (req, res) => {
    try {
        await techWorkflowService.assignJob(req.user.shopId, req.params.jobId, req.params.techId);
        res.json({ message: 'Job assigned successfully' });
    } catch (error) {
        console.error('Error assigning job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Start job
 */
app.post('/api/technicians/:techId/jobs/:jobId/start', authenticateRequest, async (req, res) => {
    try {
        await techWorkflowService.startJob(req.user.shopId, req.params.jobId, req.params.techId);
        res.json({ message: 'Job started successfully' });
    } catch (error) {
        console.error('Error starting job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Complete job
 */
app.post('/api/technicians/:techId/jobs/:jobId/complete', authenticateRequest, async (req, res) => {
    try {
        await techWorkflowService.completeJob(req.user.shopId, req.params.jobId, {
            ...req.body,
            technicianId: req.params.techId
        });
        res.json({ message: 'Job completed successfully' });
    } catch (error) {
        console.error('Error completing job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get technician jobs
 */
app.get('/api/technicians/:techId/jobs', authenticateRequest, async (req, res) => {
    try {
        const jobs = await techWorkflowService.getTechnicianJobs(
            req.user.shopId,
            req.params.techId,
            req.query.status
        );
        res.json({ jobs });
    } catch (error) {
        console.error('Error getting jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create job checklist
 */
app.post('/api/jobs/:jobId/checklist', authenticateRequest, async (req, res) => {
    try {
        await techWorkflowService.createChecklist(req.user.shopId, req.params.jobId, req.body.checkItems);
        res.json({ message: 'Checklist created successfully' });
    } catch (error) {
        console.error('Error creating checklist:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update checklist item
 */
app.patch('/api/jobs/:jobId/checklist/:itemId', authenticateRequest, async (req, res) => {
    try {
        await techWorkflowService.updateChecklistItem(
            req.user.shopId,
            req.params.jobId,
            req.params.itemId,
            req.body.completed,
            req.user.uid
        );
        res.json({ message: 'Checklist item updated successfully' });
    } catch (error) {
        console.error('Error updating checklist:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Request parts for job
 */
app.post('/api/jobs/:jobId/parts/request', authenticateRequest, async (req, res) => {
    try {
        await techWorkflowService.requestParts(req.user.shopId, req.params.jobId, req.body.parts);
        res.json({ message: 'Parts requested successfully' });
    } catch (error) {
        console.error('Error requesting parts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Add technician note to job
 */
app.post('/api/jobs/:jobId/notes', authenticateRequest, async (req, res) => {
    try {
        await techWorkflowService.addTechnicianNote(
            req.user.shopId,
            req.params.jobId,
            req.body.note,
            req.user.uid
        );
        res.json({ message: 'Note added successfully' });
    } catch (error) {
        console.error('Error adding note:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get technician performance
 */
app.get('/api/technicians/:techId/performance', authenticateRequest, async (req, res) => {
    try {
        const performance = await techWorkflowService.getTechnicianPerformance(
            req.user.shopId,
            req.params.techId
        );
        res.json({ performance });
    } catch (error) {
        console.error('Error getting performance:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get technician dashboard data
 */
app.get('/api/technicians/:techId/dashboard', authenticateRequest, async (req, res) => {
    try {
        const dashboard = await techWorkflowService.getDashboardData(
            req.user.shopId,
            req.params.techId
        );
        res.json({ dashboard });
    } catch (error) {
        console.error('Error getting dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// REPORTING ENDPOINTS
// ========================================

/**
 * Generate sales report
 */
app.get('/api/reports/sales', authenticateRequest, async (req, res) => {
    try {
        const report = await reportingService.generateSalesReport(
            req.user.shopId,
            req.query.period || 'month',
            req.query.startDate && req.query.endDate ? {
                startDate: req.query.startDate,
                endDate: req.query.endDate
            } : null
        );
        res.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate technician performance report
 */
app.get('/api/reports/technician-performance', authenticateRequest, async (req, res) => {
    try {
        const report = await reportingService.generateTechnicianPerformanceReport(
            req.user.shopId,
            req.query.period || 'month'
        );
        res.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate parts inventory report
 */
app.get('/api/reports/inventory', authenticateRequest, async (req, res) => {
    try {
        const report = await reportingService.generatePartsInventoryReport(req.user.shopId);
        res.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate customer analysis report
 */
app.get('/api/reports/customers', authenticateRequest, async (req, res) => {
    try {
        const report = await reportingService.generateCustomerAnalysisReport(
            req.user.shopId,
            req.query.period || 'month'
        );
        res.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate profit/loss report
 */
app.get('/api/reports/profit-loss', authenticateRequest, async (req, res) => {
    try {
        const report = await reportingService.generateProfitLossReport(
            req.user.shopId,
            req.query.period || 'month'
        );
        res.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate bay utilization report
 */
app.get('/api/reports/bay-utilization', authenticateRequest, async (req, res) => {
    try {
        const report = await reportingService.generateBayUtilizationReport(
            req.user.shopId,
            req.query.period || 'month'
        );
        res.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate trend analysis report
 */
app.get('/api/reports/trends', authenticateRequest, async (req, res) => {
    try {
        const report = await reportingService.generateTrendAnalysisReport(
            req.user.shopId,
            req.query.period || 'month'
        );
        res.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate all reports summary
 */
app.get('/api/reports/all', authenticateRequest, async (req, res) => {
    try {
        const reports = await reportingService.generateAllReportsSummary(
            req.user.shopId,
            req.query.period || 'month'
        );
        res.json({ reports });
    } catch (error) {
        console.error('Error generating reports:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Export report to CSV
 */
app.get('/api/reports/:type/export/csv', authenticateRequest, async (req, res) => {
    try {
        // Get report data based on type
        let reportData;
        switch (req.params.type) {
            case 'sales':
                reportData = await reportingService.generateSalesReport(req.user.shopId, req.query.period || 'month');
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }
        
        const csv = reportingService.exportToCSV(reportData, req.params.type);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-report.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// BAY BALANCING ENDPOINTS
// ========================================

/**
 * Add service bay
 */
app.post('/api/bays', authenticateRequest, requireRole('admin'), async (req, res) => {
    try {
        const bay = await bayBalancingService.addBay(req.user.shopId, req.body);
        res.status(201).json({ bay });
    } catch (error) {
        console.error('Error adding bay:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all service bays
 */
app.get('/api/bays', authenticateRequest, async (req, res) => {
    try {
        const bays = await bayBalancingService.getBays(req.user.shopId);
        res.json({ bays });
    } catch (error) {
        console.error('Error getting bays:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get bay status
 */
app.get('/api/bays/:bayId/status', authenticateRequest, async (req, res) => {
    try {
        const status = await bayBalancingService.getBayStatus(req.user.shopId, req.params.bayId);
        res.json({ status });
    } catch (error) {
        console.error('Error getting bay status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all bay statuses
 */
app.get('/api/bays/status/all', authenticateRequest, async (req, res) => {
    try {
        const statuses = await bayBalancingService.getAllBayStatuses(req.user.shopId);
        res.json({ statuses });
    } catch (error) {
        console.error('Error getting bay statuses:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Assign job to bay
 */
app.post('/api/bays/:bayId/jobs/:jobId/assign', authenticateRequest, requireRole('admin', 'service_advisor'), async (req, res) => {
    try {
        await bayBalancingService.assignJobToBay(req.user.shopId, req.params.jobId, req.params.bayId);
        res.json({ message: 'Job assigned to bay successfully' });
    } catch (error) {
        console.error('Error assigning job to bay:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Release bay
 */
app.post('/api/bays/:bayId/release', authenticateRequest, async (req, res) => {
    try {
        await bayBalancingService.releaseBay(req.user.shopId, req.params.bayId);
        res.json({ message: 'Bay released successfully' });
    } catch (error) {
        console.error('Error releasing bay:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Find available bay
 */
app.get('/api/bays/available', authenticateRequest, async (req, res) => {
    try {
        const bay = await bayBalancingService.findAvailableBay(req.user.shopId, req.query.jobType);
        res.json({ bay });
    } catch (error) {
        console.error('Error finding available bay:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Schedule bay for job
 */
app.post('/api/bays/:bayId/schedule', authenticateRequest, requireRole('admin', 'service_advisor'), async (req, res) => {
    try {
        await bayBalancingService.scheduleBay(
            req.user.shopId,
            req.body.jobId,
            req.params.bayId,
            new Date(req.body.scheduledTime)
        );
        res.json({ message: 'Bay scheduled successfully' });
    } catch (error) {
        console.error('Error scheduling bay:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Check for bay conflicts
 */
app.get('/api/bays/:bayId/conflicts', authenticateRequest, async (req, res) => {
    try {
        const conflicts = await bayBalancingService.checkBayConflicts(
            req.user.shopId,
            req.params.bayId,
            new Date(req.query.startTime),
            new Date(req.query.endTime)
        );
        res.json({ conflicts });
    } catch (error) {
        console.error('Error checking conflicts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Calculate bay efficiency
 */
app.get('/api/bays/:bayId/efficiency', authenticateRequest, async (req, res) => {
    try {
        const efficiency = await bayBalancingService.calculateBayEfficiency(
            req.user.shopId,
            req.params.bayId,
            req.query.period || 'month'
        );
        res.json({ efficiency });
    } catch (error) {
        console.error('Error calculating efficiency:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get bay balancing recommendations
 */
app.get('/api/bays/recommendations', authenticateRequest, requireRole('admin', 'service_advisor'), async (req, res) => {
    try {
        const recommendations = await bayBalancingService.getBalancingRecommendations(req.user.shopId);
        res.json({ recommendations });
    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get real-time bay board
 */
app.get('/api/bays/board', authenticateRequest, async (req, res) => {
    try {
        const board = await bayBalancingService.getRealTimeBayBoard(req.user.shopId);
        res.json({ board });
    } catch (error) {
        console.error('Error getting bay board:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// LABOR SERVICE ENDPOINTS
// ========================================

/**
 * Get all labor operations
 */
app.get('/api/labor/operations', async (req, res) => {
    try {
        const operations = laborService.getAllOperations();
        res.json({ operations });
    } catch (error) {
        console.error('Error getting operations:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get specific labor operation
 */
app.get('/api/labor/operations/:operationId', async (req, res) => {
    try {
        const operation = laborService.getOperation(req.params.operationId);
        if (!operation) {
            return res.status(404).json({ error: 'Operation not found' });
        }
        res.json({ operation });
    } catch (error) {
        console.error('Error getting operation:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Search labor operations
 */
app.get('/api/labor/search', async (req, res) => {
    try {
        const results = laborService.searchOperations(req.query.q);
        res.json({ results });
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get labor estimate
 */
app.get('/api/labor/estimate/:operationId', async (req, res) => {
    try {
        const estimate = laborService.getLaborEstimate(req.params.operationId);
        res.json({ estimate });
    } catch (error) {
        console.error('Error getting estimate:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Quick estimate
 */
app.post('/api/labor/quick-estimate', async (req, res) => {
    try {
        const { description, useScraper = false } = req.body;
        
        let estimate;
        if (useScraper && nexpartLaborScraper) {
            // Try Nexpart scraper first
            try {
                const scraped = await nexpartLaborScraper.getLaborTime(
                    req.body.year || '2020',
                    req.body.make || 'Toyota',
                    req.body.model || 'Camry',
                    description
                );
                estimate = {
                    description,
                    hours: scraped.hours,
                    source: 'nexpart-aces',
                    confidence: scraped.confidence || 0.9
                };
            } catch (scraperError) {
                console.log('Nexpart scraper failed, using database:', scraperError.message);
                // Fall back to database
                estimate = laborService.getQuickEstimate(description);
                estimate.source = 'database';
            }
        } else {
            estimate = laborService.getQuickEstimate(description);
            estimate.source = 'database';
        }
        
        // Calculate cost
        const shopSettings = shopSettingsService ? await shopSettingsService.getSettings() : {};
        estimate.cost = estimate.hours * (shopSettings.laborRate || 100);
        
        res.json({ estimate });
    } catch (error) {
        console.error('Error getting quick estimate:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PARTS SCRAPER ENDPOINTS
// ========================================

/**
 * Search parts using Nexpart
 */
app.get('/api/parts/search', async (req, res) => {
    try {
        if (!nexpartScraper) {
            return res.status(503).json({ error: 'Nexpart scraper not available' });
        }
        
        const results = await nexpartScraper.searchParts({
            partNumber: req.query.partNumber,
            description: req.query.description
        });
        
        res.json({ results });
    } catch (error) {
        console.error('Error searching parts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Check parts availability
 */
app.post('/api/parts/check-availability', async (req, res) => {
    try {
        if (!nexpartScraper) {
            return res.status(503).json({ error: 'Nexpart scraper not available' });
        }
        
        const results = await nexpartScraper.checkAvailability(req.body);
        res.json({ results });
    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// EMAIL ENDPOINTS
// ========================================

/**
 * Send email
 */
app.post('/api/email/send', async (req, res) => {
    try {
        const { to, subject, html } = req.body;
        
        const result = await emailService.sendEmail({
            to,
            subject,
            html
        });
        
        res.json({ message: 'Email sent successfully', result });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Send work order email
 */
app.post('/api/email/work-order', async (req, res) => {
    try {
        const { workOrderData, branding } = req.body;
        
        const html = await shopBrandingService.generateBrandedEmail(
            currentShopId || 'default',
            'Work Order',
            req.body.html || 'Your work order is ready'
        );
        
        const result = await emailService.sendEmail({
            to: workOrderData.customerEmail,
            subject: `Work Order - ${workOrderData.workOrderNumber}`,
            html
        });
        
        res.json({ message: 'Work order email sent successfully', result });
    } catch (error) {
        console.error('Error sending work order email:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// SHOP SETTINGS ENDPOINTS
// ========================================

/**
 * Get shop settings
 */
   app.get('/api/shop/settings', async (req, res) => {
       try {
           let settings = {};
           
           // Try to load from local file first
           const fs = require('fs');
           const path = require('path');
           const settingsFile = path.join(__dirname, 'shop-settings.json');
           
           if (fs.existsSync(settingsFile)) {
               try {
                   const fileContent = fs.readFileSync(settingsFile, 'utf8');
                   settings = JSON.parse(fileContent);
                   console.log('Loaded settings from local file');
               } catch (fileError) {
                   console.log('Error reading settings file:', fileError.message);
               }
           }
           
           // Try Firebase if available
           if ((!settings || Object.keys(settings).length === 0) && firebaseApp && req.user) {
               try {
                   const shopDoc = await admin.firestore().collection('shops').doc(req.user.shopId).get();
                   if (shopDoc.exists) {
                       settings = shopDoc.data().settings || {};
                       console.log('Loaded settings from Firebase');
                   }
               } catch (firebaseError) {
                   console.log('Firebase load failed:', firebaseError.message);
               }
           }
           
           // Fallback to shopSettingsService
           if ((!settings || Object.keys(settings).length === 0) && shopSettingsService) {
               settings = await shopSettingsService.getSettings();
               console.log('Loaded settings from shopSettingsService');
           }
           
           console.log('Returning settings:', JSON.stringify(settings, null, 2));
           res.json({ settings });
       } catch (error) {
           console.error('Error getting settings:', error);
           res.status(500).json({ error: error.message });
       }
   });
   app.post('/api/shop/settings', async (req, res) => {
       try {
           console.log('Saving settings:', JSON.stringify(req.body, null, 2));
           
           // Save to local file (no Firebase required)
           const fs = require('fs');
           const path = require('path');
           const settingsFile = path.join(__dirname, 'shop-settings.json');
           
           // Write settings to file
           fs.writeFileSync(settingsFile, JSON.stringify(req.body, null, 2));
           
           // Also try Firebase if available
           if (firebaseApp && req.user) {
               try {
                   await admin.firestore().collection('shops').doc(req.user.shopId).set({
                       settings: req.body,
                       updatedAt: admin.firestore.FieldValue.serverTimestamp()
                   }, { merge: true });
                   console.log('Settings also saved to Firebase');
               } catch (firebaseError) {
                   console.log('Firebase save failed (using local file):', firebaseError.message);
               }
           }
           
           res.json({ 
               message: 'Settings updated successfully',
               saved: 'local-file',
               settings: req.body
           });
       } catch (error) {
           console.error('Error updating settings:', error);
           res.status(500).json({ error: error.message, details: error.toString() });
       }
   });

// ========================================
// ERROR HANDLING
// ========================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
});

// ========================================
// START SERVER
// ========================================

async function startServer() {
    try {
        // Initialize services
        await initializeServices();
        
        // Start listening
        app.listen(PORT, () => {
            console.log('='.repeat(60));
            console.log('🚀 VHICL Pro Backend with ALL Features running');
            console.log('='.repeat(60));
            console.log(`📡 Server running on port ${PORT}`);
            console.log(`🌐 Health check: http://localhost:${PORT}/health`);
            console.log(`📊 API endpoints: http://localhost:${PORT}/api/`);
            console.log('');
            console.log('✅ Features:');
            console.log('  • Multi-Shop Firebase Integration');
            console.log('  • Shop Branding (logos, colors)');
            console.log('  • Before/After Photos');
            console.log('  • Customer Contact Preferences');
            console.log('  • Towing Integration');
            console.log('  • Technician Workflow');
            console.log('  • Comprehensive Reporting');
            console.log('  • Bay Balancing System');
            console.log('  • Nexpart Scraper');
            console.log('  • Nexpart Labor Scraper (ACES catalog)');
            console.log('  • ALEX Voice Assistant');
            console.log('  • Labor Service');
            console.log('  • Email Service');
            console.log('  • Shop Settings');
            console.log('='.repeat(60));
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();