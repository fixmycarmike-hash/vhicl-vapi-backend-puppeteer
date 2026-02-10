// VHICL Pro Server with VAPI Integration (NOT Google Cloud)
// NO Auto Labor - using Nexpart for labor
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Try to load shop settings service
let ShopSettingsService;
try {
  ShopSettingsService = require('./shop-settings-service-complete.js');
} catch (error) {
  console.log('Shop settings service not found, using in-memory settings');
  ShopSettingsService = null;
}

const app = express();
const PORT = process.env.PORT || 3000;
const shopSettingsService = ShopSettingsService ? new ShopSettingsService() : null;

// Default shop settings (fallback)
const defaultSettings = {
    shopInfo: {
        shopName: process.env.SHOP_NAME || 'VHICL Pro Shop',
        shopPhone: process.env.SHOP_PHONE || '(555) 123-4567',
        shopEmail: process.env.SHOP_EMAIL || 'info@vhiclpro.com',
        shopAddress: process.env.SHOP_ADDRESS || '123 Main St, Anytown, USA',
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
    vapi: {
        enabled: true,
        apiKey: process.env.VAPI_API_KEY || '',
        phoneId: process.env.VAPI_PHONE_ID || '',
        phoneNumber: process.env.VAPI_PHONE_NUMBER || '',
        assistantId: process.env.VAPI_ASSISTANT_ID || ''
    },
    pricing: {
        laborRate: parseInt(process.env.LABOR_RATE) || 100,
        taxRate: parseInt(process.env.TAX_RATE) || 7
    },
    alex: {
        enabled: true,
        servicesWeDontDo: []
    }
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize settings
async function initializeSettings() {
    if (shopSettingsService) {
        await shopSettingsService.loadSettings();
        console.log('✅ Shop settings loaded');
    } else {
        console.log('✅ Using default shop settings');
    }
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
        const settings = shopSettingsService ? await shopSettingsService.getSettings(false) : defaultSettings;
        
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

// Tech jobs queue
let techJobsQueue = [
    {
        id: 'JOB-001',
        vehicleInfo: '2018 Honda Accord LX',
        customerId: 'CUST-001',
        customerName: 'John Smith',
        customerPhone: '555-123-4567',
        customerEmail: 'john@email.com',
        serviceType: 'Water Pump Replacement',
        originalEstimate: {
            id: 'EST-001',
            parts: [
                { name: 'Water Pump', quantity: 1, cost: 120, price: 156 },
                { name: 'Coolant', quantity: 1, cost: 25, price: 32.50 }
            ],
            laborHours: 2.0,
            laborCost: 200,
            total: 388.50
        },
        status: 'in_progress',
        technician: 'Mike',
        startTime: '10:00 AM',
        estimatedCompletion: '12:00 PM',
        priority: 'normal',
        additionalParts: [],
        additionalNotes: [],
        maintenanceRecommendations: [],
        inspectionResults: null
    },
    {
        id: 'JOB-002',
        vehicleInfo: '2015 Toyota Camry',
        customerId: 'CUST-002',
        customerName: 'Jane Doe',
        customerPhone: '555-987-6543',
        customerEmail: 'jane@email.com',
        serviceType: 'Brake Service',
        originalEstimate: {
            id: 'EST-002',
            parts: [
                { name: 'Brake Pads (Front)', quantity: 1, cost: 45, price: 58.50 },
                { name: 'Rotors (Front Pair)', quantity: 1, cost: 80, price: 104 }
            ],
            laborHours: 2.0,
            laborCost: 200,
            total: 362.50
        },
        status: 'queued',
        technician: null,
        startTime: null,
        estimatedCompletion: '2:00 PM',
        priority: 'normal',
        additionalParts: [],
        additionalNotes: [],
        maintenanceRecommendations: [],
        inspectionResults: null
    },
    {
        id: 'JOB-003',
        vehicleInfo: '2020 Ford F-150',
        customerId: 'CUST-003',
        customerName: 'Bob Johnson',
        customerPhone: '555-456-7890',
        customerEmail: 'bob@email.com',
        serviceType: 'Oil Change',
        originalEstimate: {
            id: 'EST-003',
            parts: [
                { name: 'Oil Filter', quantity: 1, cost: 12, price: 15.60 },
                { name: 'Synthetic Oil (5W-30, 5qt)', quantity: 1, cost: 35, price: 45.50 }
            ],
            laborHours: 0.5,
            laborCost: 50,
            total: 111.10
        },
        status: 'queued',
        technician: null,
        startTime: null,
        estimatedCompletion: '3:00 PM',
        priority: 'normal',
        additionalParts: [],
        additionalNotes: [],
        maintenanceRecommendations: [],
        inspectionResults: null
    }
];

// Maintenance recommendations database
const maintenanceRecommendationsDB = {
    '2018 Honda Accord': {
        mileageIntervals: [
            { mileage: 30000, services: ['Oil Change', 'Tire Rotation', 'Brake Inspection', 'Fluid Top-Off'] },
            { mileage: 60000, services: ['Oil Change', 'Tire Rotation', 'Brake Service', 'Coolant Flush', 'Transmission Service'] },
            { mileage: 90000, services: ['Oil Change', 'Tire Rotation', 'Brake Inspection', 'Timing Belt Inspection', 'Spark Plugs'] }
        ],
        commonIssues: [
            { issue: 'AC Compressor', description: 'Common failure around 80,000 miles', estimatedCost: '$800-1200' },
            { issue: 'Power Steering Pump', description: 'Leak may develop around 70,000 miles', estimatedCost: '$400-600' }
        ]
    }
};

// Get tech stats
app.get('/api/tech/stats', async (req, res) => {
    try {
        const activeJobs = techJobsQueue.filter(j => j.status === 'in_progress').length;
        const queuedJobs = techJobsQueue.filter(j => j.status === 'queued').length;
        
        res.json({
            success: true,
            stats: {
                activeJobs,
                queuedJobs,
                completedToday: 5,
                totalHours: 32,
                rating: 4.7
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get next vehicle in queue
app.get('/api/tech/next-vehicle', (req, res) => {
    try {
        const nextJob = techJobsQueue.find(j => j.status === 'queued');
        
        if (nextJob) {
            res.json({
                success: true,
                nextVehicle: {
                    id: nextJob.id,
                    vehicleInfo: nextJob.vehicleInfo,
                    customerName: nextJob.customerName,
                    customerPhone: nextJob.customerPhone,
                    customerEmail: nextJob.customerEmail,
                    serviceType: nextJob.serviceType,
                    originalEstimate: nextJob.originalEstimate,
                    priority: nextJob.priority,
                    estimatedCompletion: nextJob.estimatedCompletion,
                    positionInQueue: techJobsQueue.filter(j => j.status === 'queued').indexOf(nextJob) + 1
                }
            });
        } else {
            res.json({
                success: true,
                nextVehicle: null,
                message: 'No vehicles in queue'
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all tech jobs (active and queued)
app.get('/api/tech/jobs', (req, res) => {
    try {
        res.json({
            success: true,
            jobs: techJobsQueue
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get active jobs
app.get('/api/tech/jobs/active', (req, res) => {
    try {
        const activeJobs = techJobsQueue.filter(j => j.status === 'in_progress');
        res.json({
            success: true,
            jobs: activeJobs
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get specific job details
app.get('/api/tech/jobs/:id', (req, res) => {
    try {
        const job = techJobsQueue.find(j => j.id === req.params.id);
        if (job) {
            res.json({ success: true, job });
        } else {
            res.status(404).json({ success: false, error: 'Job not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add additional parts to job
app.post('/api/tech/jobs/:id/additional-parts', (req, res) => {
    try {
        const { parts, notes, notifyCustomer } = req.body;
        const jobIndex = techJobsQueue.findIndex(j => j.id === req.params.id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        
        const additionalPart = {
            id: `PART-${Date.now()}`,
            addedAt: new Date().toISOString(),
            addedBy: 'Technician',
            parts,
            notes,
            notifyCustomer: notifyCustomer || false,
            customerNotified: false,
            approved: false,
            estimatedAdditionalCost: parts.reduce((sum, p) => sum + (p.cost * 1.3), 0)
        };
        
        techJobsQueue[jobIndex].additionalParts.push(additionalPart);
        techJobsQueue[jobIndex].updatedAt = new Date().toISOString();
        
        res.json({
            success: true,
            additionalPart,
            job: techJobsQueue[jobIndex],
            message: 'Additional parts added to job'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add maintenance recommendations
app.post('/api/tech/jobs/:id/maintenance-recommendations', (req, res) => {
    try {
        const { recommendations } = req.body;
        const jobIndex = techJobsQueue.findIndex(j => j.id === req.params.id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        
        const recs = recommendations.map(rec => ({
            id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            addedAt: new Date().toISOString(),
            addedBy: 'Technician',
            ...rec
        }));
        
        techJobsQueue[jobIndex].maintenanceRecommendations.push(...recs);
        techJobsQueue[jobIndex].updatedAt = new Date().toISOString();
        
        res.json({
            success: true,
            recommendations: recs,
            job: techJobsQueue[jobIndex],
            message: 'Maintenance recommendations added'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit maintenance inspection form
app.post('/api/tech/jobs/:id/inspection', (req, res) => {
    try {
        const { inspectionResults } = req.body;
        const jobIndex = techJobsQueue.findIndex(j => j.id === req.params.id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        
        const inspection = {
            id: `INS-${Date.now()}`,
            completedAt: new Date().toISOString(),
            technician: inspectionResults.technician || 'Unknown',
            vehicleMileage: inspectionResults.vehicleMileage,
            passedInspection: inspectionResults.passedInspection,
            findings: inspectionResults.findings || [],
            recommendedActions: inspectionResults.recommendedActions || [],
            overallCondition: inspectionResults.overallCondition || 'good',
            photos: inspectionResults.photos || []
        };
        
        techJobsQueue[jobIndex].inspectionResults = inspection;
        techJobsQueue[jobIndex].updatedAt = new Date().toISOString();
        
        res.json({
            success: true,
            inspection,
            job: techJobsQueue[jobIndex],
            message: 'Inspection completed'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Notify customer of additional repairs
app.post('/api/tech/jobs/:id/notify-customer', (req, res) => {
    try {
        const { additionalPartsId, message, method } = req.body;
        const jobIndex = techJobsQueue.findIndex(j => j.id === req.params.id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        
        const job = techJobsQueue[jobIndex];
        
        // Mark as notified
        if (additionalPartsId) {
            const partIndex = job.additionalParts.findIndex(p => p.id === additionalPartsId);
            if (partIndex !== -1) {
                job.additionalParts[partIndex].customerNotified = true;
                job.additionalParts[partIndex].notificationMethod = method;
                job.additionalParts[partIndex].notificationMessage = message;
                job.additionalParts[partIndex].notifiedAt = new Date().toISOString();
            }
        }
        
        // In production, this would send actual email/SMS/call
        res.json({
            success: true,
            notified: true,
            customer: {
                name: job.customerName,
                phone: job.customerPhone,
                email: job.customerEmail
            },
            message: `Customer notified via ${method}`,
            job
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get maintenance suggestions for vehicle
app.get('/api/tech/maintenance-suggestions/:vehicle', (req, res) => {
    try {
        const vehicle = req.params.vehicle;
        const mileage = parseInt(req.query.mileage) || 0;
        
        // Get recommendations from database or generate generic ones
        let suggestions = maintenanceRecommendationsDB[vehicle] || {
            mileageIntervals: [
                { mileage: 30000, services: ['Oil Change', 'Tire Rotation', 'Brake Inspection'] },
                { mileage: 60000, services: ['Oil Change', 'Tire Rotation', 'Brake Service', 'Coolant Flush'] },
                { mileage: 90000, services: ['Oil Change', 'Tire Rotation', 'Brake Inspection', 'Spark Plugs'] }
            ],
            commonIssues: []
        };
        
        // Find relevant recommendations based on mileage
        const relevantRecommendations = suggestions.mileageIntervals
            .filter(interval => Math.abs(mileage - interval.mileage) < 5000)
            .map(interval => ({
                ...interval,
                priority: 'medium',
                reason: `Vehicle is at or approaching ${interval.mileage} miles maintenance interval`
            }));
        
        res.json({
            success: true,
            vehicle,
            currentMileage: mileage,
            suggestions: relevantRecommendations,
            commonIssues: suggestions.commonIssues
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start next job
app.post('/api/tech/jobs/:id/start', (req, res) => {
    try {
        const jobIndex = techJobsQueue.findIndex(j => j.id === req.params.id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        
        const technician = req.body.technician || 'Unknown';
        
        techJobsQueue[jobIndex].status = 'in_progress';
        techJobsQueue[jobIndex].technician = technician;
        techJobsQueue[jobIndex].startTime = new Date().toISOString();
        
        res.json({
            success: true,
            job: techJobsQueue[jobIndex],
            message: `Job started by ${technician}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete job
app.post('/api/tech/jobs/:id/complete', (req, res) => {
    try {
        const { notes, hoursWorked } = req.body;
        const jobIndex = techJobsQueue.findIndex(j => j.id === req.params.id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }
        
        techJobsQueue[jobIndex].status = 'completed';
        techJobsQueue[jobIndex].completedAt = new Date().toISOString();
        techJobsQueue[jobIndex].completionNotes = notes;
        techJobsQueue[jobIndex].hoursWorked = hoursWorked;
        
        res.json({
            success: true,
            job: techJobsQueue[jobIndex],
            message: 'Job completed successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get completed jobs
app.get('/api/tech/jobs/completed', (req, res) => {
    try {
        const completedJobs = techJobsQueue.filter(j => j.status === 'completed');
        res.json({
            success: true,
            jobs: completedJobs
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
        const settings = shopSettingsService ? await shopSettingsService.getSettings(false) : defaultSettings;
        
        res.json({
            success: true,
            config: {
                enabled: settings.alex.enabled,
                autoCallStores: settings.alex.autoCallStores || false,
                autoOrderParts: settings.alex.autoOrderParts || false,
                vapiEnabled: settings.vapi.enabled,
                vapiPhone: settings.vapi.phoneNumber,
                servicesWeDontDo: settings.alex.servicesWeDontDo || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/alex/services-we-dont-do', async (req, res) => {
    try {
        const { services } = req.body;
        
        if (shopSettingsService) {
            await shopSettingsService.updateSettings({
                alex: { servicesWeDontDo: services }
            });
        } else {
            defaultSettings.alex.servicesWeDontDo = services;
        }
        
        res.json({
            success: true,
            services,
            message: 'Services we don\'t do updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ALEX ESTIMATE GENERATOR ENDPOINTS ============

// Store for ALEX-generated estimates
let alexEstimates = [];

// Generate estimate via ALEX (for system users)
app.post('/api/alex/generate-estimate', async (req, res) => {
    try {
        const { 
            vehicleInfo, 
            serviceType, 
            customerConcern, 
            partsNeeded,
            priority 
        } = req.body;
        
        const settings = shopSettingsService ? await shopSettingsService.getSettings(false) : defaultSettings;
        
        // Simulate ALEX estimate generation (in production, this would use VAPI AI)
        const laborHours = estimateLaborHours(serviceType);
        const laborCost = laborHours * settings.pricing.laborRate;
        
        // Process parts
        const parts = partsNeeded.map(part => ({
            ...part,
            markup: part.cost * (settings.pricing.partsMarkup / 100),
            price: part.cost * (1 + settings.pricing.partsMarkup / 100)
        }));
        
        const partsCost = parts.reduce((sum, p) => sum + p.cost, 0);
        const partsTotal = parts.reduce((sum, p) => sum + p.price, 0);
        
        const subtotal = laborCost + partsTotal;
        const taxAmount = subtotal * (settings.pricing.taxRate / 100);
        const total = subtotal + taxAmount + settings.pricing.shopSuppliesFee;
        
        // Generate estimate ID
        const estimateId = `EST-${Date.now()}`;
        
        // Create estimate object
        const estimate = {
            id: estimateId,
            customerName: 'System User',
            vehicleInfo,
            serviceType,
            customerConcern,
            priority: priority || 'normal',
            laborHours,
            laborRate: settings.pricing.laborRate,
            laborCost,
            parts,
            partsCost,
            partsTotal,
            subtotal,
            taxRate: settings.pricing.taxRate,
            taxAmount,
            shopSuppliesFee: settings.pricing.shopSuppliesFee,
            disposalFee: settings.pricing.disposalFee,
            total,
            createdAt: new Date().toISOString(),
            status: 'draft',
            generatedBy: 'ALEX'
        };
        
        // Add ALEX's recommendations
        estimate.recommendations = generateALEXRecommendations(serviceType, vehicleInfo, parts);
        
        // Store estimate
        alexEstimates.push(estimate);
        
        res.json({
            success: true,
            estimate,
            message: 'ALEX has generated your estimate'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all ALEX-generated estimates
app.get('/api/alex/estimates', (req, res) => {
    res.json({
        success: true,
        estimates: alexEstimates,
        total: alexEstimates.length
    });
});

// Get specific ALEX estimate
app.get('/api/alex/estimates/:id', (req, res) => {
    const estimate = alexEstimates.find(e => e.id === req.params.id);
    if (estimate) {
        res.json({ success: true, estimate });
    } else {
        res.status(404).json({ success: false, error: 'Estimate not found' });
    }
});

// Update ALEX estimate
app.put('/api/alex/estimates/:id', (req, res) => {
    const index = alexEstimates.findIndex(e => e.id === req.params.id);
    if (index !== -1) {
        alexEstimates[index] = {
            ...alexEstimates[index],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        res.json({ success: true, estimate: alexEstimates[index] });
    } else {
        res.status(404).json({ success: false, error: 'Estimate not found' });
    }
});

// Delete ALEX estimate
app.delete('/api/alex/estimates/:id', (req, res) => {
    const index = alexEstimates.findIndex(e => e.id === req.params.id);
    if (index !== -1) {
        const deleted = alexEstimates.splice(index, 1)[0];
        res.json({ success: true, estimate: deleted });
    } else {
        res.status(404).json({ success: false, error: 'Estimate not found' });
    }
});

// Get estimate templates from ALEX
app.get('/api/alex/estimate-templates', (req, res) => {
    const templates = [
        {
            id: 'tmpl-001',
            name: 'Brake Service - Front',
            serviceType: 'Brake Service',
            description: 'Front brake pads and rotor replacement',
            typicalParts: ['Brake Pads (Front)', 'Rotors (Front Pair)', 'Brake Fluid'],
            typicalLaborHours: 2.0
        },
        {
            id: 'tmpl-002',
            name: 'Oil Change - Standard',
            serviceType: 'Oil Change',
            description: 'Full synthetic oil change with filter',
            typicalParts: ['Oil Filter', 'Synthetic Oil (5W-30, 5qt)'],
            typicalLaborHours: 0.5
        },
        {
            id: 'tmpl-003',
            name: 'Suspension Repair',
            serviceType: 'Suspension',
            description: 'Shock/strut replacement',
            typicalParts: ['Strut Assembly', 'Mount', 'Bolts'],
            typicalLaborHours: 2.5
        },
        {
            id: 'tmpl-004',
            name: 'Battery Replacement',
            serviceType: 'Battery',
            description: 'Battery replacement and terminal cleaning',
            typicalParts: ['Car Battery', 'Terminal Cleaner'],
            typicalLaborHours: 0.3
        },
        {
            id: 'tmpl-005',
            name: 'AC Service',
            serviceType: 'Air Conditioning',
            description: 'AC diagnostics and recharge',
            typicalParts: ['Refrigerant (R134a)', 'AC Oil'],
            typicalLaborHours: 1.5
        }
    ];
    
    res.json({
        success: true,
        templates
    });
});

// Helper function: Estimate labor hours
function estimateLaborHours(serviceType) {
    const laborMap = {
        'oil change': 0.5,
        'brake service': 2.0,
        'brake pads': 1.5,
        'brake rotors': 1.5,
        'suspension': 2.5,
        'alignment': 1.0,
        'battery': 0.3,
        'air conditioning': 1.5,
        'diagnostics': 1.0,
        'timing belt': 3.0,
        'water pump': 2.0,
        'alternator': 1.5,
        'starter': 1.5,
        'transmission service': 2.0,
        'tire rotation': 0.5,
        'tire replacement': 1.0,
        'exhaust': 1.5,
        'default': 1.0
    };
    
    const type = serviceType.toLowerCase();
    for (const [key, hours] of Object.entries(laborMap)) {
        if (type.includes(key)) {
            return hours;
        }
    }
    return laborMap.default;
}

// Helper function: Generate ALEX recommendations
function generateALEXRecommendations(serviceType, vehicleInfo, parts) {
    const recommendations = [];
    
    // General recommendations
    recommendations.push({
        type: 'info',
        text: `Based on the ${serviceType} service for this ${vehicleInfo}, ALEX recommends:`
    });
    
    // Service-specific recommendations
    if (serviceType.toLowerCase().includes('brake')) {
        recommendations.push({
            type: 'warning',
            text: 'Check brake lines and calipers for wear'
        });
        recommendations.push({
            type: 'info',
            text: 'Resurface rotors if thickness is within specs'
        });
    }
    
    if (serviceType.toLowerCase().includes('oil')) {
        recommendations.push({
            type: 'info',
            text: 'Check oil filter housing for leaks'
        });
        recommendations.push({
            type: 'info',
            text: 'Top off other fluids as needed'
        });
    }
    
    if (serviceType.toLowerCase().includes('suspension')) {
        recommendations.push({
            type: 'warning',
            text: 'Inspect all bushings and ball joints'
        });
        recommendations.push({
            type: 'info',
            text: 'Perform alignment after replacement'
        });
    }
    
    // Parts availability
    if (parts && parts.length > 0) {
        recommendations.push({
            type: 'success',
            text: `All ${parts.length} parts are available from preferred suppliers`
        });
    }
    
    return recommendations;
}

// ============ SHOP SETTINGS ENDPOINTS ============

app.get('/api/shop/settings', async (req, res) => {
    try {
        const settings = shopSettingsService ? await shopSettingsService.getSettings() : defaultSettings;
        res.json(settings);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/shop/settings', async (req, res) => {
    try {
        let updated;
        if (shopSettingsService) {
            updated = await shopSettingsService.updateSettings(req.body);
        } else {
            // Update in-memory settings
            Object.assign(defaultSettings, req.body);
            updated = defaultSettings;
        }
        res.json(updated);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ PARTS STORES ENDPOINTS ============

app.get('/api/parts/stores', async (req, res) => {
    try {
        const settings = shopSettingsService ? await shopSettingsService.getSettings(false) : defaultSettings;
        res.json(settings.partsStores || []);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/parts/stores', async (req, res) => {
    try {
        const settings = shopSettingsService ? await shopSettingsService.getSettings(false) : defaultSettings;
        const newStore = {
            id: `store-${Date.now()}`,
            ...req.body
        };
        if (!settings.partsStores) settings.partsStores = [];
        settings.partsStores.push(newStore);
        if (shopSettingsService) {
            await shopSettingsService.saveSettings(settings);
        }
        res.json(newStore);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ INVENTORY ENDPOINTS ============

// In-memory inventory storage (in production, use a database)
let inventory = [];

// Get all inventory items
app.get('/api/inventory', (req, res) => {
    res.json({
        success: true,
        items: inventory,
        total: inventory.length
    });
});

// Get inventory item by ID
app.get('/api/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (item) {
        res.json({ success: true, item });
    } else {
        res.status(404).json({ success: false, error: 'Item not found' });
    }
});

// Add new inventory item
app.post('/api/inventory', (req, res) => {
    const newItem = {
        id: `INV-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageHistory: [],
        ...req.body
    };
    inventory.push(newItem);
    res.json({ success: true, item: newItem });
});

// Update inventory item
app.put('/api/inventory/:id', (req, res) => {
    const index = inventory.findIndex(i => i.id === req.params.id);
    if (index !== -1) {
        inventory[index] = {
            ...inventory[index],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        res.json({ success: true, item: inventory[index] });
    } else {
        res.status(404).json({ success: false, error: 'Item not found' });
    }
});

// Delete inventory item
app.delete('/api/inventory/:id', (req, res) => {
    const index = inventory.findIndex(i => i.id === req.params.id);
    if (index !== -1) {
        const deleted = inventory.splice(index, 1)[0];
        res.json({ success: true, item: deleted });
    } else {
        res.status(404).json({ success: false, error: 'Item not found' });
    }
});

// Search inventory
app.get('/api/inventory/search/:query', (req, res) => {
    const query = req.params.query.toLowerCase();
    const results = inventory.filter(item => 
        item.name?.toLowerCase().includes(query) ||
        item.partNumber?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
    );
    res.json({
        success: true,
        items: results,
        total: results.length
    });
});

// Get inventory by category
app.get('/api/inventory/category/:category', (req, res) => {
    const category = req.params.category.toLowerCase();
    const results = inventory.filter(item => 
        item.category?.toLowerCase() === category
    );
    res.json({
        success: true,
        items: results,
        total: results.length
    });
});

// Get low stock items
app.get('/api/inventory/low-stock/:threshold', (req, res) => {
    const threshold = parseInt(req.params.threshold) || 10;
    const results = inventory.filter(item => 
        item.quantity !== undefined && item.quantity <= threshold
    );
    res.json({
        success: true,
        items: results,
        total: results.length
    });
});

// Update inventory quantity (add or subtract)
app.post('/api/inventory/:id/quantity', (req, res) => {
    const { action, quantity, reason } = req.body; // action: 'add' or 'subtract'
    const index = inventory.findIndex(i => i.id === req.params.id);
    
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    const item = inventory[index];
    const qty = parseInt(quantity);
    
    if (action === 'add') {
        item.quantity = (item.quantity || 0) + qty;
    } else if (action === 'subtract') {
        item.quantity = Math.max(0, (item.quantity || 0) - qty);
    } else {
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    // Add to usage history
    if (reason) {
        if (!item.usageHistory) item.usageHistory = [];
        item.usageHistory.push({
            action,
            quantity: qty,
            reason,
            timestamp: new Date().toISOString()
        });
    }
    
    item.updatedAt = new Date().toISOString();
    
    res.json({ success: true, item });
});

// Export inventory
app.get('/api/inventory/export', (req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
    
    const headers = ['ID', 'Name', 'Part Number', 'Category', 'Quantity', 'Unit', 'Location', 'Cost', 'Price'];
    const csv = [
        headers.join(','),
        ...inventory.map(item => [
            item.id,
            item.name,
            item.partNumber || '',
            item.category || '',
            item.quantity || 0,
            item.unit || 'ea',
            item.location || '',
            item.cost || 0,
            item.price || 0
        ].join(','))
    ].join('\n');
    
    res.send(csv);
});

// Import inventory
app.post('/api/inventory/import', (req, res) => {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Invalid data format' });
    }
    
    const imported = items.map(item => ({
        id: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageHistory: [],
        ...item
    }));
    
    inventory.push(...imported);
    
    res.json({
        success: true,
        imported: imported.length,
        items: imported
    });
});

// Get inventory statistics
app.get('/api/inventory/stats', (req, res) => {
    const totalItems = inventory.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalValue = inventory.reduce((sum, item) => sum + ((item.quantity || 0) * (item.cost || 0)), 0);
    const lowStockCount = inventory.filter(item => (item.quantity || 0) <= 10).length;
    
    // Items by category
    const byCategory = {};
    inventory.forEach(item => {
        const cat = item.category || 'Uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
    
    res.json({
        success: true,
        stats: {
            totalItems,
            totalQuantity,
            totalValue,
            lowStockCount,
            byCategory
        }
    });
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
