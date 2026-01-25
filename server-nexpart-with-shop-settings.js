const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const NexpartScraper = require('./nexpart-scraper.js');
const NexpartLaborScraper = require('./nexpart-labor-scraper.js');
const NexpartVINDecoder = require('./nexpart-vin-decoder.js');
const ShopSettingsService = require('./shop-settings-service-complete.js');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Services
let shopSettingsService;
let nexpartScraper;
let nexpartLaborScraper;
let nexpartVINDecoder;

// In-memory cache for labor data (24-hour expiration)
const laborCache = new Map();
const CACHE_DURATION_HOURS = 24;

/**
 * Initialize services
 */
async function initializeServices() {
    try {
        console.log('🔧 Initializing services...');
        
        // Initialize shop settings service
        shopSettingsService = new ShopSettingsService();
        console.log('✅ ShopSettingsService initialized');
        
        // Initialize scrapers when settings are loaded
        await initializeScrapers();
        
        console.log('✅ All services initialized');
    } catch (error) {
        console.error('❌ Error initializing services:', error);
    }
}

/**
 * Initialize scrapers based on shop settings
 */
async function initializeScrapers() {
    try {
        const settings = await shopSettingsService.getSettings();
        
        // Initialize Nexpart parts scraper
        if (settings.nexpart?.enabled && settings.nexpart?.username && settings.nexpart?.password) {
            nexpartScraper = new NexpartScraper(
                settings.nexpart.username,
                settings.nexpart.password
            );
            console.log('✅ Nexpart parts scraper initialized');
        } else {
            console.log('⚠️  Nexpart parts scraper not configured');
        }
        
        // Initialize Nexpart labor scraper
        if (settings.nexpart?.enabled && settings.nexpart?.username && settings.nexpart?.password) {
            nexpartLaborScraper = new NexpartLaborScraper(
                settings.nexpart.username,
                settings.nexpart.password
            );
            console.log('✅ Nexpart labor scraper initialized');
        } else {
            console.log('⚠️  Nexpart labor scraper not configured');
        }
        
        // Initialize Nexpart VIN decoder
        if (settings.nexpart?.enabled && settings.nexpart?.username && settings.nexpart?.password) {
            nexpartVINDecoder = new NexpartVINDecoder(
                settings.nexpart.username,
                settings.nexpart.password
            );
            console.log('✅ Nexpart VIN decoder initialized');
        } else {
            console.log('⚠️  Nexpart VIN decoder not configured');
        }
        
        // Reinitialize scrapers when settings change
        shopSettingsService.on('settingsUpdated', async () => {
            console.log('🔄 Settings updated, reinitializing scrapers...');
            await initializeScrapers();
        });
        
    } catch (error) {
        console.error('❌ Error initializing scrapers:', error);
    }
}

/**
 * Get cache key for labor lookup
 */
function getCacheKey(year, make, model, operation) {
    return `${year}-${make}-${model}-${operation.toLowerCase()}`;
}

/**
 * Check if cache entry is valid
 */
function isCacheValid(cacheEntry) {
    if (!cacheEntry) return false;
    const expiresAt = new Date(cacheEntry.expiresAt);
    return expiresAt > new Date();
}

/**
 * Save to cache
 */
function saveToCache(key, data) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION_HOURS);
    
    laborCache.set(key, {
        data: data,
        scrapedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        hitCount: 0
    });
}

/**
 * Get from cache
 */
function getFromCache(key) {
    const entry = laborCache.get(key);
    if (isCacheValid(entry)) {
        entry.hitCount++;
        return { cached: true, data: entry.data, age: calculateAge(entry.scrapedAt) };
    }
    return null;
}

/**
 * Calculate age of cached data
 */
function calculateAge(timestamp) {
    const scraped = new Date(timestamp);
    const now = new Date();
    const diff = now - scraped;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} hours ${minutes} minutes`;
}

// ==================== API ENDPOINTS ====================

/**
 * Health check
 */
app.get('/health', async (req, res) => {
    const settings = await shopSettingsService.getSettings();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            shopSettings: !!shopSettingsService,
            nexpartParts: !!nexpartScraper,
            nexpartLabor: !!nexpartLaborScraper,
            nexpartVINDecoder: !!nexpartVINDecoder,
            laborCacheSize: laborCache.size
        },
        settings: {
            laborRate: settings.laborRate,
            nexpartEnabled: settings.nexpart?.enabled,
            cacheDuration: `${CACHE_DURATION_HOURS} hours`
        }
    });
});

/**
 * Get shop settings
 */
app.get('/api/shop/settings', async (req, res) => {
    try {
        const settings = await shopSettingsService.getSettings();
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update shop settings
 */
app.post('/api/shop/settings', async (req, res) => {
    try {
        const settings = await shopSettingsService.updateSettings(req.body.settings);
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get labor time from Nexpart
 * Uses smart caching: first request scrapes, subsequent requests return cached data
 */
app.get('/api/labor/:year/:make/:model/:operation', async (req, res) => {
    try {
        const { year, make, model } = req.params;
        const operation = req.params.operation.replace(/-/g, ' ');
        
        const settings = await shopSettingsService.getSettings();
        
        if (!nexpartLaborScraper) {
            return res.status(503).json({
                success: false,
                error: 'Nexpart labor scraper not configured. Please configure Nexpart credentials in shop settings.',
                source: 'error'
            });
        }
        
        // Check cache first
        const cacheKey = getCacheKey(year, make, model, operation);
        const cachedResult = getFromCache(cacheKey);
        
        if (cachedResult) {
            const laborData = cachedResult.data;
            const calculatedCost = laborData.hours * settings.laborRate;
            
            return res.json({
                success: true,
                source: 'cache',
                cached: true,
                labor: {
                    ...laborData,
                    calculatedCost: calculatedCost,
                    laborRate: settings.laborRate,
                    source: 'Nexpart Official'
                },
                age: cachedResult.age
            });
        }
        
        // Not in cache - scrape from Nexpart
        console.log(`🔍 Scraping labor: ${operation} - ${year} ${make} ${model}`);
        
        const result = await nexpartLaborScraper.getLaborTime(year, make, model, operation);
        
        if (result.success && result.labor) {
            const laborData = result.labor;
            const calculatedCost = laborData.hours * settings.laborRate;
            
            // Save to cache
            saveToCache(cacheKey, {
                ...laborData,
                year,
                make,
                model
            });
            
            res.json({
                success: true,
                source: 'nexpart',
                cached: false,
                addedToCache: true,
                labor: {
                    ...laborData,
                    calculatedCost: calculatedCost,
                    laborRate: settings.laborRate,
                    source: 'Nexpart Official'
                },
                legalNotice: 'Labor times provided by Nexpart - industry standard data'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Labor operation not found',
                source: 'nexpart'
            });
        }
        
    } catch (error) {
        console.error('❌ Error getting labor time:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            source: 'error'
        });
    }
});

/**
 * Search parts from Nexpart
 * Always scrapes for real-time pricing and availability
 */
app.get('/api/parts/search', async (req, res) => {
    try {
        const { year, make, model, part } = req.query;
        
        const settings = await shopSettingsService.getSettings();
        
        if (!nexpartScraper) {
            return res.status(503).json({
                success: false,
                error: 'Nexpart parts scraper not configured. Please configure Nexpart credentials in shop settings.',
                source: 'error'
            });
        }
        
        console.log(`🔍 Searching parts: ${part} - ${year} ${make} ${model}`);
        
        const result = await nexpartScraper.searchParts(year, make, model, part);
        
        if (result.success) {
            // Apply parts markup
            const markup = settings.defaultMarkup / 100;
            const partsWithMarkup = result.parts.map(part => ({
                ...part,
                markedUpPrice: part.price ? part.price * (1 + markup) : part.price
            }));
            
            res.json({
                success: true,
                source: 'nexpart',
                parts: partsWithMarkup,
                vehicle: result.vehicle,
                partName: result.partName,
                markupPercentage: settings.defaultMarkup
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error,
                source: 'nexpart'
            });
        }
        
    } catch (error) {
        console.error('❌ Error searching parts:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            source: 'error'
        });
    }
});

/**
 * Get cache statistics
 */
app.get('/api/cache/stats', (req, res) => {
    const entries = Array.from(laborCache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    
    // Calculate hit rate (rough estimate)
    const hitRate = entries.length > 0 ? (totalHits / (totalHits + entries.length)) * 100 : 0;
    
    res.json({
        success: true,
        stats: {
            totalEntries: laborCache.size,
            hitRate: Math.round(hitRate * 10) / 10,
            totalHits: totalHits,
            totalMisses: entries.length,
            cacheDuration: `${CACHE_DURATION_HOURS} hours`,
            oldestEntry: entries.length > 0 ? 
                entries.reduce((oldest, entry) => 
                    entry.scrapedAt < oldest.scrapedAt ? entry : oldest
                ).scrapedAt : null,
            newestEntry: entries.length > 0 ? 
                entries.reduce((newest, entry) => 
                    entry.scrapedAt > newest.scrapedAt ? entry : newest
                ).scrapedAt : null
        }
    });
});

/**
 * Clear cache
 */
app.delete('/api/cache', (req, res) => {
    const count = laborCache.size;
    laborCache.clear();
    
    res.json({
        success: true,
        message: 'Cache cleared successfully',
        entriesCleared: count
    });
});

/**
 * Decode VIN using Nexpart
 */
app.get('/api/vin/decode/:vin', async (req, res) => {
    try {
        const { vin } = req.params;
        
        // Validate VIN format
        const validation = NexpartVINDecoder.validateVIN(vin);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error,
                vin: vin
            });
        }
        
        if (!nexpartVINDecoder) {
            return res.status(503).json({
                success: false,
                error: 'Nexpart VIN decoder not configured. Please configure Nexpart credentials in shop settings.',
                vin: vin,
                source: 'error'
            });
        }
        
        console.log(`🔍 Decoding VIN: ${vin}`);
        
        const result = await nexpartVINDecoder.decodeVIN(vin);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
        
    } catch (error) {
        console.error('❌ Error decoding VIN:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            vin: req.params.vin,
            source: 'error'
        });
    }
});

/**
 * Get basic VIN info (without API call)
 */
app.get('/api/vin/basic/:vin', (req, res) => {
    try {
        const { vin } = req.params;
        const info = NexpartVINDecoder.extractBasicInfo(vin);
        
        res.json({
            success: info.valid,
            vin: vin,
            info: info
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            vin: req.params.vin
        });
    }
});

/**
 * Get compatible vehicles for make/model/year
 */
app.get('/api/vehicles/compatible/:year/:make/:model', async (req, res) => {
    try {
        const { year, make, model } = req.params;
        
        if (!nexpartVINDecoder) {
            return res.status(503).json({
                success: false,
                error: 'Nexpart VIN decoder not configured. Please configure Nexpart credentials in shop settings.'
            });
        }
        
        const result = await nexpartVINDecoder.getCompatibleVehicles(
            parseInt(year),
            make,
            model
        );
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error getting compatible vehicles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== START SERVER ====================

// Start server and initialize services
app.listen(PORT, async () => {
    console.log('🚀 VHICL Pro Backend - Pure Nexpart Solution');
    console.log(`📊 Server running on port ${PORT}`);
    console.log(`🔧 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Labor API: http://localhost:${PORT}/api/labor/:year/:make/:model/:operation`);
    console.log(`🔧 Parts API: http://localhost:${PORT}/api/parts/search`);
    console.log(`🔧 VIN Decoder API: http://localhost:${PORT}/api/vin/decode/:vin`);
    console.log(`🔧 Basic VIN Info: http://localhost:${PORT}/api/vin/basic/:vin`);
    console.log(`🔧 Compatible Vehicles: http://localhost:${PORT}/api/vehicles/compatible/:year/:make/:model`);
    console.log(`🔧 Cache Stats: http://localhost:${PORT}/api/cache/stats`);
    console.log('');
    console.log('✅ Pure Nexpart - Legally defensible labor times');
    console.log('✅ Smart caching - 24-hour expiration');
    console.log('✅ VIN decoding - Automatic vehicle identification');
    console.log('✅ No environment variables - configured in shop settings');
    console.log('');
    
    // Initialize services
    await initializeServices();
});

// Export for testing
module.exports = app;
