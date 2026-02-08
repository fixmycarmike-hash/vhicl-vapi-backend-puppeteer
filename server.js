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

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
