// VHICL Pro Server with VAPI Integration (NOT Google Cloud)
// NO Auto Labor - using Nexpart for labor
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const ShopSettingsService = require('./shop-settings-with-vapi.js');

const app = express();
const PORT = process.env.PORT || 3000;
const shopSettingsService = new ShopSettingsService();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize settings
async function initializeSettings() {
    await shopSettingsService.loadSettings();
    console.log('✅ Shop settings loaded');
}

// ============ VAPI ENDPOINTS ============
// VAPI Functions for ALEX Voice Assistant

// Check vehicle status
app.post('/api/vapi/check-vehicle-status', async (req, res) => {
    try {
        const { phone_number } = req.body;
        
        // Mock implementation - in production, query database
        const vehicles = [
            {
                phone: '555-123-4567',
                vehicle: '2018 Honda Accord',
                status: 'In Progress',
                progress: 'Brake pads and rotors being replaced',
                estimate: '$450.00',
                pendingPayment: false
            }
        ];
        
        const vehicle = vehicles.find(v => v.phone === phone_number);
        
        if (vehicle) {
            res.json({
                success: true,
                vehicle: vehicle.vehicle,
                status: vehicle.status,
                progress: vehicle.progress,
                estimate: vehicle.estimate,
                pendingPayment: vehicle.pendingPayment
            });
        } else {
            res.json({
                success: true,
                vehicle: null,
                message: 'No active service found for this phone number'
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Book appointment
app.post('/api/vapi/book-appointment', async (req, res) => {
    try {
        const { customer_name, phone_number, date, time, service_type, vehicle_info } = req.body;
        
        // Mock implementation - in production, save to database
        const appointment = {
            id: `APT-${Date.now()}`,
            customerName: customer_name,
            phone: phone_number,
            date,
            time,
            service: service_type,
            vehicle: vehicle_info,
            status: 'Scheduled',
            createdAt: new Date().toISOString()
        };
        
        console.log('Appointment booked:', appointment);
        
        res.json({
            success: true,
            appointment: {
                id: appointment.id,
                date: `${date} at ${time}`,
                service: service_type,
                vehicle: vehicle_info,
                confirmationNumber: appointment.id
            },
            message: `Your appointment has been scheduled for ${date} at ${time}. Confirmation number: ${appointment.id}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get estimate
app.post('/api/vapi/get-estimate', async (req, res) => {
    try {
        const { phone_number, job_id } = req.body;
        
        // Mock implementation - in production, query database
        const estimates = [
            {
                phone: '555-123-4567',
                jobId: 'JOB-001',
                vehicle: '2018 Honda Accord',
                description: 'Brake pads and rotors replacement',
                parts: [
                    { name: 'Front Brake Pads', price: 89.99 },
                    { name: 'Front Rotors (pair)', price: 159.99 }
                ],
                labor: { hours: 2, rate: 100, total: 200 },
                subtotal: 449.98,
                tax: 31.50,
                total: 481.48
            }
        ];
        
        const estimate = estimates.find(e => e.phone === phone_number && (!job_id || e.jobId === job_id));
        
        if (estimate) {
            res.json({
                success: true,
                estimate: estimate
            });
        } else {
            res.json({
                success: true,
                estimate: null,
                message: 'No estimate found. Please bring your vehicle in for inspection to get an accurate estimate.'
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Approve work
app.post('/api/vapi/approve-work', async (req, res) => {
    try {
        const { phone_number, job_id } = req.body;
        
        // Mock implementation - in production, update database
        console.log(`Work approved: Job ${job_id} by ${phone_number}`);
        
        res.json({
            success: true,
            jobId: job_id,
            message: 'Your approval has been recorded. We will begin work on your vehicle shortly.',
            nextSteps: 'We will notify you when parts arrive and work begins'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Take message
app.post('/api/vapi/take-message', async (req, res) => {
    try {
        const { customer_name, phone_number, message, callback_requested } = req.body;
        
        // Mock implementation - in production, save to database
        const msg = {
            id: `MSG-${Date.now()}`,
            customerName: customer_name,
            phone: phone_number,
            message: message,
            callbackRequested: callback_requested,
            createdAt: new Date().toISOString()
        };
        
        console.log('Message recorded:', msg);
        
        res.json({
            success: true,
            messageId: msg.id,
            message: callback_requested 
                ? 'Your message has been recorded and we will call you back shortly.'
                : 'Your message has been recorded. Thank you!'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get shop hours
app.post('/api/vapi/get-shop-hours', async (req, res) => {
    try {
        const settings = await shopSettingsService.getSettings(false);
        
        const hours = settings.shopInfo.businessHours;
        const shopName = settings.shopInfo.shopName;
        const shopPhone = settings.shopInfo.shopPhone;
        const shopAddress = settings.shopInfo.shopAddress;
        
        res.json({
            success: true,
            shopName,
            phone: shopPhone,
            address: shopAddress,
            hours: {
                monday: hours.monday.closed ? 'Closed' : `${hours.monday.open} - ${hours.monday.close}`,
                tuesday: hours.tuesday.closed ? 'Closed' : `${hours.tuesday.open} - ${hours.tuesday.close}`,
                wednesday: hours.wednesday.closed ? 'Closed' : `${hours.wednesday.open} - ${hours.wednesday.close}`,
                thursday: hours.thursday.closed ? 'Closed' : `${hours.thursday.open} - ${hours.thursday.close}`,
                friday: hours.friday.closed ? 'Closed' : `${hours.friday.open} - ${hours.friday.close}`,
                saturday: hours.saturday.closed ? 'Closed' : `${hours.saturday.open} - ${hours.saturday.close}`,
                sunday: 'Closed'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check parts availability (Nexpart integration)
app.post('/api/vapi/check-parts-availability', async (req, res) => {
    try {
        const { part_name, vehicle_info } = req.body;
        
        // Mock implementation - in production, call Nexpart API
        const parts = [
            {
                partNumber: 'BP-123',
                name: 'Front Brake Pads',
                price: 89.99,
                availability: 'In Stock',
                stores: ['OReilly', 'AutoZone', 'NAPA'],
                deliveryTime: '2 hours'
            },
            {
                partNumber: 'BR-456',
                name: 'Front Rotors (pair)',
                price: 159.99,
                availability: 'In Stock',
                stores: ['OReilly', 'NAPA'],
                deliveryTime: 'Same day'
            }
        ];
        
        res.json({
            success: true,
            parts: parts,
            message: `Found ${parts.length} parts for ${vehicle_info}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ NEXPART ENDPOINTS ============
// Nexpart for Parts & Labor (NO Auto Labor)

app.post('/api/parts/search', async (req, res) => {
    try {
        const { partName, vehicleInfo } = req.body;
        
        // Mock Nexpart response
        res.json({
            success: true,
            parts: [
                {
                    partNumber: 'BP-123',
                    name: partName,
                    description: 'High-quality replacement part',
                    price: 89.99,
                    availability: 'In Stock',
                    imageUrl: '',
                    supplier: 'OReilly'
                }
            ]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/labor/estimate', async (req, res) => {
    try {
        const { vehicleInfo, serviceType } = req.body;
        
        // Mock Nexpart labor response
        res.json({
            success: true,
            laborHours: 2.0,
            operation: serviceType,
            source: 'nexpart'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ VEHICLE ENDPOINTS ============

app.get('/api/vin/decode/:vin', async (req, res) => {
    try {
        const { vin } = req.params;
        
        // Mock Nexpart VIN decode
        res.json({
            success: true,
            vin,
            make: 'Honda',
            model: 'Accord',
            year: 2018,
            color: 'Silver',
            bodyType: 'Sedan',
            engine: '2.4L I4'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/license-plate/lookup/:plate/:state', async (req, res) => {
    try {
        const { plate, state } = req.params;
        
        // Mock license plate lookup
        res.json({
            success: true,
            plate,
            state,
            vin: '1HGCM82633A123456',
            make: 'Honda',
            model: 'Accord',
            year: 2018,
            color: 'Silver'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/vehicles/compatible/:year/:make/:model', async (req, res) => {
    try {
        const { year, make, model } = req.params;
        
        // Mock Nexpart vehicle compatibility
        res.json({
            success: true,
            vehicle: `${year} ${make} ${model}`,
            engines: [
                { code: 'K24', description: '2.4L I4', fuel: 'Gasoline' },
                { code: 'J35', description: '3.5L V6', fuel: 'Gasoline' }
            ],
            trims: ['LX', 'EX', 'EX-L', 'Touring']
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ TECH WORKFLOW ENDPOINTS ============

app.get('/api/tech/stats', async (req, res) => {
    try {
        res.json({
            success: true,
            stats: {
                activeJobs: 3,
                completedToday: 5,
                totalHours: 32,
                rating: 4.7
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/tech/jobs/active', async (req, res) => {
    try {
        res.json({
            success: true,
            jobs: [
                {
                    id: 'JOB-001',
                    vehicle: '2018 Honda Accord',
                    service: 'Brake pads and rotors',
                    status: 'In Progress',
                    technician: 'Mike',
                    startTime: '10:00 AM',
                    estimatedHours: 2,
                    hoursSpent: 1.5
                }
            ]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/tech/jobs/completed', async (req, res) => {
    try {
        res.json({
            success: true,
            jobs: [
                {
                    id: 'JOB-999',
                    vehicle: '2015 Toyota Camry',
                    service: 'Oil Change',
                    status: 'Completed',
                    technician: 'Mike',
                    completedAt: '2:30 PM',
                    hoursSpent: 0.5
                }
            ]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ANALYTICS ENDPOINTS ============

app.get('/api/analytics/overview', async (req, res) => {
    try {
        res.json({
            success: true,
            revenue: {
                today: 1250,
                thisWeek: 5840,
                thisMonth: 24500,
                thisYear: 287000
            },
            jobs: {
                total: 243,
                avgLaborTime: 2.3,
                customers: 187,
                avgJobValue: 215
            },
            parts: {
                stores: 5,
                avgDiscount: 12,
                partsOrdered: 1256,
                deliveries: 1198
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/analytics/labor', async (req, res) => {
    try {
        res.json({
            success: true,
            labor: {
                totalHours: 890,
                avgHoursPerJob: 2.3,
                totalRevenue: 89000,
                avgRevenuePerHour: 100
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/analytics/parts', async (req, res) => {
    try {
        res.json({
            success: true,
            parts: {
                stores: 5,
                avgDiscount: 12,
                partsOrdered: 1256,
                deliveries: 1198
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ALEX CONFIGURATION ENDPOINTS ============

app.get('/api/alex/config', async (req, res) => {
    try {
        const settings = await shopSettingsService.getSettings(false);
        
        res.json({
            success: true,
            config: {
                enabled: settings.alex.enabled,
                autoCallStores: settings.alex.autoCallStores,
                autoOrderParts: settings.alex.autoOrderParts,
                vapiEnabled: settings.vapi.enabled,
                vapiPhone: settings.vapi.phoneNumber,
                servicesWeDontDo: settings.alex.servicesWeDontDo
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/alex/services-we-dont-do', async (req, res) => {
    try {
        const { services } = req.body;
        
        await shopSettingsService.updateSettings({
            alex: { servicesWeDontDo: services }
        });
        
        res.json({
            success: true,
            services,
            message: 'Services we don\'t do updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ SHOP SETTINGS ENDPOINTS ============

app.get('/api/shop/settings', async (req, res) => {
    try {
        const settings = await shopSettingsService.getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/shop/settings', async (req, res) => {
    try {
        const updated = await shopSettingsService.updateSettings(req.body);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ PARTS STORES ENDPOINTS ============

app.get('/api/parts/stores', async (req, res) => {
    try {
        const settings = await shopSettingsService.getSettings(false);
        res.json(settings.partsStores);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/parts/stores', async (req, res) => {
    try {
        const settings = await shopSettingsService.getSettings(false);
        const newStore = {
            id: `store-${Date.now()}`,
            ...req.body
        };
        settings.partsStores.push(newStore);
        await shopSettingsService.saveSettings(settings);
        res.json(newStore);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ APPOINTMENTS ENDPOINTS ============

let appointments = [];

app.get('/api/appointments', (req, res) => {
    res.json(appointments);
});

app.post('/api/appointments', (req, res) => {
    const appointment = {
        id: `APT-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...req.body
    };
    appointments.push(appointment);
    res.json(appointment);
});

app.put('/api/appointments/:id', (req, res) => {
    const index = appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
        appointments[index] = { ...appointments[index], ...req.body };
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

// ============ HEALTH CHECK ============

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            vapi: true,
            nexpart: true,
            database: true
        }
    });
});

// Start server
app.listen(PORT, async () => {
    await initializeSettings();
    console.log(`🚀 VHICL Pro Backend with VAPI running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📞 ALEX VAPI phone system enabled`);
});
