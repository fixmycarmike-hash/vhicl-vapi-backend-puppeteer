const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Firebase integration
const { firebaseApp, db, auth, ShopRouter, ShopAuth } = require('./firebase-config.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Firebase check
if (!db) {
    console.log('⚠️  Firebase not configured - running in single-shop mode (localStorage only)');
}

// ==================== AUTHENTICATION MIDDLEWARE ====================

/**
 * Verify Firebase token and extract shop info
 */
async function authenticateShop(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        const userInfo = await ShopAuth.verifyToken(idToken);
        
        // Add shop info to request
        req.shopId = userInfo.shopId;
        req.userId = userInfo.uid;
        req.userRole = userInfo.role;
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Optional authentication - allows public access but adds shop info if token provided
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const userInfo = await ShopAuth.verifyToken(idToken);
            req.shopId = userInfo.shopId;
            req.userId = userInfo.uid;
            req.userRole = userInfo.role;
        }
        
        next();
    } catch (error) {
        // Continue without shop info for public endpoints
        next();
    }
}

// ==================== SHOP REGISTRATION & AUTH ====================

/**
 * Register a new shop
 * POST /api/shop/register
 */
app.post('/api/shop/register', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Firebase not configured' });
        }
        
        const { shopName, email, password, address, phone, shopDomain } = req.body;
        
        if (!shopName || !email || !password) {
            return res.status(400).json({ error: 'Shop name, email, and password are required' });
        }
        
        // Generate unique shop ID
        const shopId = `shop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create admin account for the shop
        const adminUser = await ShopAuth.createStaffAccount(
            email,
            password,
            shopId,
            'admin',
            { name: shopName, phone }
        );
        
        // Create shop document
        await db.collection('shops').doc(shopId).set({
            shopId,
            shopName,
            address: address || '',
            phone: phone || '',
            email: email,
            shopDomain: shopDomain || '',
            active: true,
            createdAt: new Date().toISOString(),
            createdBy: adminUser.uid,
            plan: 'trial', // trial, professional, enterprise
            planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            settings: {
                laborRate: 100,
                diagnosticFee: 50,
                taxRate: 7,
                partsMarkup: 30
            }
        });
        
        res.json({
            success: true,
            shopId,
            message: 'Shop registered successfully'
        });
    } catch (error) {
        console.error('Shop registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Login to shop
 * POST /api/shop/login
 */
app.post('/api/shop/login', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Firebase not configured' });
        }
        
        const { email, password } = req.body;
        
        // Use Firebase Auth REST API for login
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY || 'YOUR_API_KEY'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return res.status(401).json({ error: data.error?.message || 'Login failed' });
        }
        
        // Get shop info from custom claims
        const idToken = data.idToken;
        const decodedToken = await auth.verifyIdToken(idToken);
        
        // Get shop details
        const shopDoc = await db.collection('shops').doc(decodedToken.shopId).get();
        const shopData = shopDoc.data();
        
        res.json({
            success: true,
            token: idToken,
            refreshToken: data.refreshToken,
            shopId: decodedToken.shopId,
            shopName: shopData.shopName,
            role: decodedToken.role,
            shop: shopData
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get shop information
 * GET /api/shop/info
 */
app.get('/api/shop/info', optionalAuth, async (req, res) => {
    try {
        if (!db) {
            // Return default shop info for single-shop mode
            return res.json({
                shopId: 'default',
                shopName: 'VHICL Pro',
                active: true,
                mode: 'single-shop'
            });
        }
        
        const shopId = req.shopId || 'default';
        const shopDoc = await db.collection('shops').doc(shopId).get();
        
        if (!shopDoc.exists) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        
        res.json(shopDoc.data());
    } catch (error) {
        console.error('Error getting shop info:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== MULTI-SHOP DATA ENDPOINTS ====================

/**
 * Get appointments for a shop
 * GET /api/appointments
 */
app.get('/api/appointments', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            // Get from Firebase
            const appointmentsSnapshot = await ShopRouter.getShopCollection(shopId, 'appointments').get();
            const appointments = appointmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json(appointments);
        } else {
            // Return empty for now (localStorage used in frontend)
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting appointments:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create appointment for a shop
 * POST /api/appointments
 */
app.post('/api/appointments', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const appointmentData = {
            ...req.body,
            shopId,
            createdAt: new Date().toISOString(),
            status: 'scheduled'
        };
        
        if (db) {
            const docRef = await ShopRouter.getShopCollection(shopId, 'appointments').add(appointmentData);
            res.json({ id: docRef.id, ...appointmentData });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update appointment for a shop
 * PUT /api/appointments/:id
 */
app.put('/api/appointments/:id', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { id } = req.params;
        
        if (db) {
            await ShopRouter.getShopDocument(shopId, 'appointments', id).update({
                ...req.body,
                updatedAt: new Date().toISOString()
            });
            res.json({ success: true, id, ...req.body });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete appointment for a shop
 * DELETE /api/appointments/:id
 */
app.delete('/api/appointments/:id', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { id } = req.params;
        
        if (db) {
            await ShopRouter.getShopDocument(shopId, 'appointments', id).delete();
            res.json({ success: true, id });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get customers for a shop
 * GET /api/customers
 */
app.get('/api/customers', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            const customersSnapshot = await ShopRouter.getShopCollection(shopId, 'customers').get();
            const customers = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json(customers);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting customers:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create customer for a shop
 * POST /api/customers
 */
app.post('/api/customers', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const customerData = {
            ...req.body,
            shopId,
            createdAt: new Date().toISOString()
        };
        
        if (db) {
            const docRef = await ShopRouter.getShopCollection(shopId, 'customers').add(customerData);
            res.json({ id: docRef.id, ...customerData });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get vehicles for a shop
 * GET /api/vehicles
 */
app.get('/api/vehicles', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            const vehiclesSnapshot = await ShopRouter.getShopCollection(shopId, 'vehicles').get();
            const vehicles = vehiclesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json(vehicles);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting vehicles:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create vehicle for a shop
 * POST /api/vehicles
 */
app.post('/api/vehicles', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const vehicleData = {
            ...req.body,
            shopId,
            createdAt: new Date().toISOString()
        };
        
        if (db) {
            const docRef = await ShopRouter.getShopCollection(shopId, 'vehicles').add(vehicleData);
            res.json({ id: docRef.id, ...vehicleData });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error creating vehicle:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get shop settings
 * GET /api/shop/settings
 */
app.get('/api/shop/settings', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            const shopDoc = await db.collection('shops').doc(shopId).get();
            
            if (!shopDoc.exists) {
                return res.status(404).json({ error: 'Shop not found' });
            }
            
            const shopData = shopDoc.data();
            res.json(shopData.settings || {});
        } else {
            // Default settings for single-shop mode
            res.json({
                laborRate: 100,
                diagnosticFee: 50,
                taxRate: 7,
                partsMarkup: 30
            });
        }
    } catch (error) {
        console.error('Error getting shop settings:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update shop settings
 * POST /api/shop/settings
 */
app.post('/api/shop/settings', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            await db.collection('shops').doc(shopId).update({
                settings: req.body,
                updatedAt: new Date().toISOString()
            });
            res.json({ success: true, ...req.body });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error updating shop settings:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get maintenance jobs for a shop
 * GET /api/maintenance
 */
app.get('/api/maintenance', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            const maintenanceSnapshot = await ShopRouter.getShopCollection(shopId, 'maintenance').get();
            const maintenance = maintenanceSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json(maintenance);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting maintenance:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create maintenance job for a shop
 * POST /api/maintenance
 */
app.post('/api/maintenance', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const maintenanceData = {
            ...req.body,
            shopId,
            createdAt: new Date().toISOString(),
            status: 'in-progress'
        };
        
        if (db) {
            const docRef = await ShopRouter.getShopCollection(shopId, 'maintenance').add(maintenanceData);
            res.json({ id: docRef.id, ...maintenanceData });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error creating maintenance job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get inventory for a shop
 * GET /api/inventory
 */
app.get('/api/inventory', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            const inventorySnapshot = await ShopRouter.getShopCollection(shopId, 'inventory').get();
            const inventory = inventorySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json(inventory);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting inventory:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create inventory item for a shop
 * POST /api/inventory
 */
app.post('/api/inventory', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const inventoryData = {
            ...req.body,
            shopId,
            createdAt: new Date().toISOString()
        };
        
        if (db) {
            const docRef = await ShopRouter.getShopCollection(shopId, 'inventory').add(inventoryData);
            res.json({ id: docRef.id, ...inventoryData });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error creating inventory item:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get towing requests for a shop
 * GET /api/towing
 */
app.get('/api/towing', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            const towingSnapshot = await ShopRouter.getShopCollection(shopId, 'towing').get();
            const towing = towingSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json(towing);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting towing requests:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create towing request for a shop
 * POST /api/towing
 */
app.post('/api/towing', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const towingData = {
            ...req.body,
            shopId,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        if (db) {
            const docRef = await ShopRouter.getShopCollection(shopId, 'towing').add(towingData);
            res.json({ id: docRef.id, ...towingData });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error creating towing request:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEKFLOW ENDPOINTS ====================

/**
 * Get bays for a shop
 * GET /api/tekflow/bays
 */
app.get('/api/tekflow/bays', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        
        if (db) {
            const baysDoc = await db.collection('shops').doc(shopId).collection('settings').doc('bays').get();
            
            if (baysDoc.exists) {
                res.json(baysDoc.data());
            } else {
                // Default bays
                const defaultBays = Array.from({ length: 8 }, (_, i) => ({
                    id: i + 1,
                    status: 'available',
                    jobId: null
                }));
                res.json(defaultBays);
            }
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting bays:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update bay status
 * PUT /api/tekflow/bays/:bayId
 */
app.put('/api/tekflow/bays/:bayId', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { bayId } = req.params;
        const { status, jobId } = req.body;
        
        if (db) {
            const baysDoc = await db.collection('shops').doc(shopId).collection('settings').doc('bays').get();
            let bays = [];
            
            if (baysDoc.exists) {
                bays = baysDoc.data();
            } else {
                bays = Array.from({ length: 8 }, (_, i) => ({
                    id: i + 1,
                    status: 'available',
                    jobId: null
                }));
            }
            
            // Update the bay
            const bayIndex = bays.findIndex(b => b.id === parseInt(bayId));
            if (bayIndex !== -1) {
                bays[bayIndex] = {
                    ...bays[bayIndex],
                    status,
                    jobId: jobId || null
                };
                
                await db.collection('shops').doc(shopId).collection('settings').doc('bays').set(bays);
            }
            
            res.json(bays);
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error updating bay:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get TekFlow jobs for a shop
 * GET /api/tekflow/jobs
 */
app.get('/api/tekflow/jobs', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { status, technicianId } = req.query;
        
        if (db) {
            let query = ShopRouter.getShopCollection(shopId, 'jobs');
            
            if (status) {
                query = query.where('status', '==', status);
            }
            
            if (technicianId) {
                query = query.where('technicianId', '==', technicianId);
            }
            
            const jobsSnapshot = await query.get();
            const jobs = jobsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Sort by priority and time
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            jobs.sort((a, b) => {
                if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
                if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                return new Date(a.scheduledTime) - new Date(b.scheduledTime);
            });
            
            res.json(jobs);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting TekFlow jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create TekFlow job
 * POST /api/tekflow/jobs
 */
app.post('/api/tekflow/jobs', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const jobData = {
            ...req.body,
            shopId,
            status: 'waiting',
            progress: 0,
            createdAt: new Date().toISOString(),
            createdBy: req.userId || 'system'
        };
        
        if (db) {
            const docRef = await ShopRouter.getShopCollection(shopId, 'jobs').add(jobData);
            res.json({ id: docRef.id, ...jobData });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error creating TekFlow job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update TekFlow job
 * PUT /api/tekflow/jobs/:jobId
 */
app.put('/api/tekflow/jobs/:jobId', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { jobId } = req.params;
        const updates = req.body;
        
        if (db) {
            const jobRef = ShopRouter.getShopDocument(shopId, 'jobs', jobId);
            
            // Add updated timestamp
            updates.updatedAt = new Date().toISOString();
            updates.updatedBy = req.userId || 'system';
            
            await jobRef.update(updates);
            
            // Get updated document
            const updatedDoc = await jobRef.get();
            res.json({ id: jobId, ...updatedDoc.data() });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error updating TekFlow job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Start job (assign to bay and technician)
 * POST /api/tekflow/jobs/:jobId/start
 */
app.post('/api/tekflow/jobs/:jobId/start', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { jobId } = req.params;
        const { bayId, technicianId } = req.body;
        
        if (db) {
            const jobRef = ShopRouter.getShopDocument(shopId, 'jobs', jobId);
            
            await jobRef.update({
                status: 'in-progress',
                bayId: parseInt(bayId),
                technicianId: technicianId || req.userId,
                startedAt: new Date().toISOString(),
                progress: 0
            });
            
            // Update bay status
            const baysDoc = await db.collection('shops').doc(shopId).collection('settings').doc('bays').get();
            if (baysDoc.exists) {
                let bays = baysDoc.data();
                const bayIndex = bays.findIndex(b => b.id === parseInt(bayId));
                if (bayIndex !== -1) {
                    bays[bayIndex] = {
                        ...bays[bayIndex],
                        status: 'occupied',
                        jobId: jobId
                    };
                    await db.collection('shops').doc(shopId).collection('settings').doc('bays').set(bays);
                }
            }
            
            res.json({ success: true });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error starting job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update job progress
 * PUT /api/tekflow/jobs/:jobId/progress
 */
app.put('/api/tekflow/jobs/:jobId/progress', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { jobId } = req.params;
        const { progress } = req.body;
        
        if (db) {
            await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update({
                progress: parseInt(progress),
                progressUpdatedAt: new Date().toISOString()
            });
            
            res.json({ success: true, progress });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error updating job progress:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Complete job
 * POST /api/tekflow/jobs/:jobId/complete
 */
app.post('/api/tekflow/jobs/:jobId/complete', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { jobId } = req.params;
        const { notes, completedBy } = req.body;
        
        if (db) {
            const jobRef = ShopRouter.getShopDocument(shopId, 'jobs', jobId);
            const jobDoc = await jobRef.get();
            
            if (!jobDoc.exists) {
                return res.status(404).json({ error: 'Job not found' });
            }
            
            const jobData = jobDoc.data();
            
            // Update job status
            await jobRef.update({
                status: 'completed',
                progress: 100,
                completedAt: new Date().toISOString(),
                completedBy: completedBy || req.userId,
                notes: notes
            });
            
            // Free up the bay
            if (jobData.bayId) {
                const baysDoc = await db.collection('shops').doc(shopId).collection('settings').doc('bays').get();
                if (baysDoc.exists) {
                    let bays = baysDoc.data();
                    const bayIndex = bays.findIndex(b => b.id === jobData.bayId);
                    if (bayIndex !== -1) {
                        bays[bayIndex] = {
                            ...bays[bayIndex],
                            status: 'available',
                            jobId: null
                        };
                        await db.collection('shops').doc(shopId).collection('settings').doc('bays').set(bays);
                    }
                }
            }
            
            res.json({ success: true });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error completing job:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Request parts for a job
 * POST /api/tekflow/jobs/:jobId/parts
 */
app.post('/api/tekflow/jobs/:jobId/parts', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { jobId } = req.params;
        const { parts } = req.body; // Array of { partName, quantity, urgency, notes }
        
        if (db) {
            // Add parts request to job
            await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update({
                partsRequested: admin.firestore.FieldValue.arrayUnion(...parts),
                partsRequestedAt: new Date().toISOString()
            });
            
            // Create parts order record
            const partsOrderRef = await ShopRouter.getShopCollection(shopId, 'parts_orders').add({
                jobId,
                parts,
                requestedBy: req.userId,
                requestedAt: new Date().toISOString(),
                status: 'pending'
            });
            
            res.json({ success: true, partsOrderId: partsOrderRef.id });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error requesting parts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Add technician message
 * POST /api/tekflow/messages
 */
app.post('/api/tekflow/messages', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { type, text, jobId } = req.body; // type: 'technician', 'system', 'advisor'
        
        if (db) {
            const messageData = {
                type,
                text,
                shopId,
                jobId: jobId || null,
                userId: req.userId,
                createdAt: new Date().toISOString()
            };
            
            const docRef = await ShopRouter.getShopCollection(shopId, 'tekflow_messages').add(messageData);
            res.json({ id: docRef.id, ...messageData });
        } else {
            res.status(501).json({ error: 'Firebase not configured' });
        }
    } catch (error) {
        console.error('Error adding message:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get TekFlow messages
 * GET /api/tekflow/messages
 */
app.get('/api/tekflow/messages', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const { limit = 20 } = req.query;
        
        if (db) {
            const messagesSnapshot = await ShopRouter.getShopCollection(shopId, 'tekflow_messages')
                .orderBy('createdAt', 'desc')
                .limit(parseInt(limit))
                .get();
            
            const messages = messagesSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .reverse(); // Show oldest first
            
            res.json(messages);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get TekFlow stats
 * GET /api/tekflow/stats
 */
app.get('/api/tekflow/stats', optionalAuth, async (req, res) => {
    try {
        const shopId = req.shopId || 'default';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (db) {
            const jobsSnapshot = await ShopRouter.getShopCollection(shopId, 'jobs').get();
            const jobs = jobsSnapshot.docs.map(doc => doc.data());
            
            const stats = {
                waiting: jobs.filter(j => j.status === 'waiting').length,
                inProgress: jobs.filter(j => j.status === 'in-progress').length,
                completed: jobs.filter(j => {
                    if (j.status !== 'completed') return false;
                    const completedAt = new Date(j.completedAt);
                    return completedAt >= today;
                }).length,
                totalJobs: jobs.length
            };
            
            res.json(stats);
        } else {
            res.json({ waiting: 0, inProgress: 0, completed: 0, totalJobs: 0 });
        }
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        firebase: db ? 'connected' : 'not configured',
        mode: db ? 'multi-shop' : 'single-shop'
    });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`🚀 VHICL Pro Backend with Firebase running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔥 Firebase: ${db ? '✅ Connected' : '⚠️  Not configured (single-shop mode)'}`);
});
