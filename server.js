const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// In-memory storage
let appointments = [];
let shopSettings = {
    shopName: 'VHICL Pro',
    address: '',
    phone: '',
    email: '',
    laborRate: 100,
    laborMultiplier: 1.0,
    hours: {
        monday: { open: '08:00', close: '17:00', closed: false },
        tuesday: { open: '08:00', close: '17:00', closed: false },
        wednesday: { open: '08:00', close: '17:00', closed: false },
        thursday: { open: '08:00', close: '17:00', closed: false },
        friday: { open: '08:00', close: '17:00', closed: false },
        saturday: { open: '09:00', close: '14:00', closed: true },
        sunday: { open: '', close: '', closed: true }
    },
    services: ['Oil Change', 'Brake Service', 'Tire Service', 'Engine Repair', 'AC Service'],
    notes: ''
};

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            appointments: true
        }
    });
});

// Shop settings endpoints
app.get('/api/shop/settings', (req, res) => {
    res.json(shopSettings);
});

app.post('/api/shop/settings', (req, res) => {
    shopSettings = {
        ...shopSettings,
        ...req.body,
        updatedAt: new Date().toISOString()
    };
    res.json(shopSettings);
});

// ALEX configuration endpoints
app.get('/api/alex/config', (req, res) => {
    res.json({
        enabled: true,
        autoCallStores: true,
        phoneId: '',
        servicesWeDontDo: []
    });
});

// Analytics endpoints
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
        totalPartsStores: 0,
        averageDiscount: 15,
        partsOrdered: appointments.length * 3
    });
});

// Parts stores endpoint
app.get('/api/parts/stores', (req, res) => {
    res.json([]);
});

// Tech workflow endpoints
app.get('/api/tech/stats', (req, res) => {
    res.json({
        activeJobs: 0,
        completedToday: appointments.filter(a => a.status === 'completed').length,
        totalHours: 8,
        rating: 4.8
    });
});

// Appointments endpoints
app.get('/api/appointments', (req, res) => {
    res.json(appointments);
});

app.post('/api/appointments', (req, res) => {
    const appointment = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'scheduled'
    };
    appointments.push(appointment);
    res.json(appointment);
});

app.get('/api/appointments/:id', (req, res) => {
    const appointment = appointments.find(a => a.id === req.params.id);
    if (appointment) {
        res.json(appointment);
    } else {
        res.status(404).json({ error: 'Not found' });
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
        res.status(404).json({ error: 'Not found' });
    }
});

app.delete('/api/appointments/:id', (req, res) => {
    const index = appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
        appointments.splice(index, 1);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// ==================== TECH WORKFLOW ENDPOINTS ====================

// Mock data for tech workflow
const activeJobs = [
    {
        id: '1',
        customerName: 'John Smith',
        vehicle: '2019 Toyota Camry',
        service: 'Brake Replacement',
        status: 'In Progress',
        startTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        estimatedHours: 2,
        hoursSpent: 1.5,
        notes: 'Brake pads worn, rotors need resurfacing'
    },
    {
        id: '2',
        customerName: 'Sarah Johnson',
        vehicle: '2021 Honda Civic',
        service: 'Oil Change + Inspection',
        status: 'Not Started',
        startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        estimatedHours: 1,
        hoursSpent: 0,
        notes: 'Customer requested synthetic oil'
    }
];

const completedJobs = [
    {
        id: '3',
        customerName: 'Mike Wilson',
        vehicle: '2018 Ford F-150',
        service: 'Transmission Flush',
        status: 'Completed',
        completedTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        estimatedHours: 1.5,
        hoursSpent: 1.3,
        rating: 5
    }
];

app.get('/api/tech/stats', (req, res) => {
    const stats = {
        activeJobs: activeJobs.length,
        completedToday: completedJobs.length,
        totalHours: completedJobs.reduce((sum, job) => sum + job.hoursSpent, 0),
        rating: 4.8
    };
    res.json(stats);
});

app.get('/api/tech/jobs/active', (req, res) => {
    res.json(activeJobs);
});

app.get('/api/tech/jobs/completed', (req, res) => {
    res.json(completedJobs);
});

app.post('/api/tech/jobs/:id/start', (req, res) => {
    const job = activeJobs.find(j => j.id === req.params.id);
    if (job) {
        job.status = 'In Progress';
        job.startTime = new Date().toISOString();
        res.json({ success: true, job });
    } else {
        res.status(404).json({ success: false, message: 'Job not found' });
    }
});

app.post('/api/tech/jobs/:id/complete', (req, res) => {
    const index = activeJobs.findIndex(j => j.id === req.params.id);
    if (index !== -1) {
        const job = activeJobs.splice(index, 1)[0];
        job.status = 'Completed';
        job.completedTime = new Date().toISOString();
        completedJobs.unshift(job);
        res.json({ success: true, job });
    } else {
        res.status(404).json({ success: false, message: 'Job not found' });
    }
});

// ==================== NEXPART INTEGRATION ENDPOINTS ====================

// Parts lookup via Nexpart
app.post('/api/parts/search', async (req, res) => {
    try {
        const { partNumber, description, year, make, model } = req.body;
        
        // Mock Nexpart response for now (can be replaced with real API call)
        const mockParts = [
            {
                number: partNumber || '513123',
                description: description || 'Brake Pads - Front',
                price: 45.99,
                availability: 'In Stock',
                quantity: 12
            },
            {
                number: partNumber ? partNumber + 'P' : '513124',
                description: description || 'Brake Pads - Premium',
                price: 89.99,
                availability: 'In Stock',
                quantity: 5
            },
            {
                number: partNumber ? partNumber + 'E' : '513125',
                description: description || 'Brake Pads - Economy',
                price: 29.99,
                availability: 'Special Order',
                quantity: 0
            }
        ];

        res.json({
            success: true,
            parts: mockParts,
            query: req.body
        });
    } catch (error) {
        console.error('Parts search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Labor lookup via Nexpart
app.post('/api/labor/estimate', async (req, res) => {
    try {
        const { vehicle, operation } = req.body;
        const { year, make, model } = vehicle;

        // Mock labor time lookup (can be replaced with real Nexpart ACES API)
        // Common labor times in hours
        const laborTimes = {
            'brake pads': 1.2,
            'brake rotors': 0.8,
            'brake pads and rotors': 2.0,
            'oil change': 0.5,
            'spark plugs': 1.0,
            'alternator': 1.5,
            'starter': 1.8,
            'battery': 0.3,
            'timing belt': 3.5,
            'water pump': 2.2,
            'thermostat': 0.6,
            'radiator': 2.5,
            'ac compressor': 3.0,
            'power steering pump': 1.8,
            'shocks': 2.5,
            'struts': 3.0,
            'tie rod': 1.2,
            'ball joint': 1.0,
            'control arm': 2.0,
            'cv axle': 2.5,
            'wheel bearing': 1.8,
            'brake caliper': 0.8,
            'fuel filter': 0.5,
            'air filter': 0.3,
            'cabin air filter': 0.3
        };

        const operationLower = operation.toLowerCase();
        let hours = null;

        // Try exact match first
        if (laborTimes[operationLower]) {
            hours = laborTimes[operationLower];
        } else {
            // Try partial match
            for (const [key, value] of Object.entries(laborTimes)) {
                if (operationLower.includes(key) || key.includes(operationLower)) {
                    hours = value;
                    break;
                }
            }
        }

        if (hours) {
            res.json({
                success: true,
                estimate: {
                    operation,
                    vehicle: `${year} ${make} ${model}`,
                    hours,
                    source: 'Nexpart ACES'
                }
            });
        } else {
            res.json({
                success: false,
                message: 'Labor time not found for this operation'
            });
        }
    } catch (error) {
        console.error('Labor estimate error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// VIN decoder via Nexpart ACES
app.get('/api/vin/decode/:vin', async (req, res) => {
    try {
        const { vin } = req.params;

        // Mock VIN decode (can be replaced with real Nexpart ACES API)
        // This is a simplified decode - real Nexpart would return full details
        const mockDecode = {
            vin: vin.toUpperCase(),
            make: 'Toyota',
            model: 'Camry',
            year: 2022,
            trim: 'LE',
            engine: '2.5L I4',
            transmission: '8-Speed Automatic',
            driveType: 'FWD',
            bodyStyle: 'Sedan',
            fuelType: 'Gasoline'
        };

        res.json({
            success: true,
            vehicle: mockDecode
        });
    } catch (error) {
        console.error('VIN decode error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get compatible parts for vehicle
app.get('/api/vehicles/compatible/:year/:make/:model', async (req, res) => {
    try {
        const { year, make, model } = req.params;

        // Mock compatible parts (can be replaced with real Nexpart ACES API)
        const mockParts = [
            { partNumber: '513123', description: 'Brake Pads - Front', price: 45.99 },
            { partNumber: '513124', description: 'Brake Rotors - Front', price: 89.99 },
            { partNumber: '90915-YZZD1', description: 'Oil Filter', price: 8.99 },
            { partNumber: '53810-07020', description: 'Spark Plug', price: 9.99 },
            { partNumber: '27060-0P020', description: 'Alternator', price: 245.99 },
            { partNumber: '28100-0P040', description: 'Starter', price: 289.99 },
            { partNumber: '28800-YZZA6', description: 'Battery', price: 149.99 },
            { partNumber: '90919-01164', description: 'Ignition Coil', price: 39.99 },
            { partNumber: '53810-33010', description: 'Timing Belt', price: 89.99 },
            { partNumber: '90916-03070', description: 'Water Pump', price: 129.99 }
        ];

        res.json({
            success: true,
            parts: mockParts,
            vehicle: `${year} ${make} ${model}`
        });
    } catch (error) {
        console.error('Compatible parts error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// License plate to VIN lookup via Nexpart
app.get('/api/license-plate/lookup/:plate/:state', async (req, res) => {
    try {
        const { plate, state } = req.params;

        // Mock license plate lookup (can be replaced with real Nexpart API)
        // This simulates looking up a license plate and returning the VIN and vehicle info
        const mockPlateData = {
            vin: '2T1BURHE0HC123456',
            plate: plate.toUpperCase(),
            state: state.toUpperCase(),
            make: 'Toyota',
            model: 'Camry',
            year: 2022,
            color: 'Silver',
            bodyStyle: 'Sedan',
            engine: '2.5L I4',
            transmission: '8-Speed Automatic',
            driveType: 'FWD',
            registrationExpiry: '2024-06-30',
            owner: 'Vehicle Owner'
        };

        // Simulate some plates not found for realism
        const notFoundPlates = ['0000000', 'NOTFOUND', 'INVALID'];
        if (notFoundPlates.includes(plate.toUpperCase())) {
            res.json({
                success: false,
                message: 'License plate not found'
            });
            return;
        }

        res.json({
            success: true,
            vehicle: mockPlateData,
            source: 'Nexpart'
        });
    } catch (error) {
        console.error('License plate lookup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
