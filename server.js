const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory data storage
let appointments = [];
let shopSettings = {
    shopName: 'VHICL Pro Auto Shop',
    phone: '(555) 123-4567',
    email: 'info@vhiclpro.com',
    address: '123 Main Street',
    laborRate: 100,
    taxRate: 0.08,
    diagnosticFee: 50
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Shop settings endpoints
app.get('/api/shop/settings', (req, res) => {
    try {
        res.json(shopSettings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/shop/settings', (req, res) => {
    try {
        shopSettings = { ...shopSettings, ...req.body };
        res.json({ success: true, settings: shopSettings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ALEX configuration
app.get('/api/alex/config', (req, res) => {
    try {
        const config = {
            enabled: true,
            voiceEnabled: true,
            autoCallStores: true,
            servicesWeDontDo: [],
            phoneNumber: '(555) 999-0000'
        };
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Analytics endpoints
app.get('/api/analytics/overview', (req, res) => {
    try {
        const overview = {
            revenueToday: 1250,
            revenueThisWeek: 5800,
            revenueThisMonth: 24500,
            totalJobs: 156,
            activeJobs: 8,
            pendingApprovals: 3
        };
        res.json(overview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/labor', (req, res) => {
    try {
        const laborStats = {
            avgLaborTime: 2.3,
            totalLaborHours: 358,
            laborRevenue: 35800,
            productiveHours: 320,
            efficiency: 89
        };
        res.json(laborStats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/parts', (req, res) => {
    try {
        const partsStats = {
            totalPartsStores: 5,
            avgDiscountRate: 15,
            partsOrdered: 342,
            deliveriesToday: 12,
            avgDeliveryTime: 45
        };
        res.json(partsStats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Parts stores
app.get('/api/parts/stores', (req, res) => {
    try {
        const stores = [
            {
                id: 1,
                name: "O'Reilly Auto Parts",
                phone: '(555) 111-2222',
                discountRate: 10,
                deliveryTime: 30,
                priority: 1
            },
            {
                id: 2,
                name: 'AutoZone',
                phone: '(555) 333-4444',
                discountRate: 8,
                deliveryTime: 45,
                priority: 2
            },
            {
                id: 3,
                name: 'NAPA Auto Parts',
                phone: '(555) 555-6666',
                discountRate: 15,
                deliveryTime: 60,
                priority: 3
            }
        ];
        res.json(stores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tech workflow endpoints
app.get('/api/tech/stats', (req, res) => {
    try {
        const stats = {
            activeJobs: 2,
            completedToday: 5,
            totalHours: 18.5,
            rating: 4.8
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tech/jobs/active', (req, res) => {
    try {
        const activeJobs = [
            {
                id: 1,
                customerName: 'John Smith',
                vehicle: '2019 Toyota Camry',
                service: 'Brake Pad Replacement',
                status: 'In Progress',
                startTime: '2024-02-07T09:30:00',
                technician: 'Mike Johnson',
                bay: 2
            },
            {
                id: 2,
                customerName: 'Sarah Davis',
                vehicle: '2021 Honda CR-V',
                service: 'Oil Change + Inspection',
                status: 'Pending',
                startTime: '2024-02-07T10:00:00',
                technician: 'Pending Assignment',
                bay: null
            }
        ];
        res.json(activeJobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tech/jobs/completed', (req, res) => {
    try {
        const completedJobs = [
            {
                id: 101,
                customerName: 'Robert Brown',
                vehicle: '2018 Ford F-150',
                service: 'Battery Replacement',
                status: 'Completed',
                completedAt: '2024-02-07T08:45:00',
                technician: 'Mike Johnson',
                hoursSpent: 0.75
            },
            {
                id: 102,
                customerName: 'Emily Wilson',
                vehicle: '2020 Chevrolet Equinox',
                service: 'Tire Rotation',
                status: 'Completed',
                completedAt: '2024-02-07T08:00:00',
                technician: 'John Smith',
                hoursSpent: 0.5
            },
            {
                id: 103,
                customerName: 'Michael Lee',
                vehicle: '2017 Nissan Altima',
                service: 'AC Repair',
                status: 'Completed',
                completedAt: '2024-02-06T16:30:00',
                technician: 'Mike Johnson',
                hoursSpent: 2.5
            }
        ];
        res.json(completedJobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Appointments CRUD
app.get('/api/appointments', (req, res) => {
    try {
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/appointments', (req, res) => {
    try {
        const appointment = {
            id: appointments.length + 1,
            ...req.body,
            createdAt: new Date().toISOString()
        };
        appointments.push(appointment);
        res.json(appointment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/appointments/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const index = appointments.findIndex(a => a.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        appointments[index] = { ...appointments[index], ...req.body };
        res.json(appointments[index]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/appointments/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const index = appointments.findIndex(a => a.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        appointments.splice(index, 1);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve static files from public directory
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
