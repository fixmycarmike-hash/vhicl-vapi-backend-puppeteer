
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ==================== IN-MEMORY STORAGE (For Testing) ====================

// Local storage for single-shop mode
const localStorage = {
    vehicles: [],
    customers: [],
    quotes: [],
    jobs: [],
    parts: [],
    staff: [],
    photos: []
};

// ==================== AUTHENTICATION (Simplified for Testing) ====================

// Simple authentication - no Firebase required
function authenticateRequest(req, res, next) {
    // For now, skip authentication for testing
    // You can add simple password auth later if needed
    next();
}

// ==================== VEHICLES ====================

// Get all vehicles
app.get('/api/vehicles', authenticateRequest, (req, res) => {
    res.json(localStorage.vehicles);
});

// Get single vehicle
app.get('/api/vehicles/:id', authenticateRequest, (req, res) => {
    const vehicle = localStorage.vehicles.find(v => v.id === req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
});

// Add vehicle
app.post('/api/vehicles', authenticateRequest, (req, res) => {
    const vehicle = {
        id: req.body.id || `veh_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    localStorage.vehicles.push(vehicle);
    res.json(vehicle);
});

// Update vehicle
app.put('/api/vehicles/:id', authenticateRequest, (req, res) => {
    const index = localStorage.vehicles.findIndex(v => v.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Vehicle not found' });
    localStorage.vehicles[index] = { ...localStorage.vehicles[index], ...req.body };
    res.json(localStorage.vehicles[index]);
});

// Delete vehicle
app.delete('/api/vehicles/:id', authenticateRequest, (req, res) => {
    const index = localStorage.vehicles.findIndex(v => v.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Vehicle not found' });
    localStorage.vehicles.splice(index, 1);
    res.json({ success: true });
});

// ==================== CUSTOMERS ====================

// Get all customers
app.get('/api/customers', authenticateRequest, (req, res) => {
    res.json(localStorage.customers);
});

// Get single customer
app.get('/api/customers/:id', authenticateRequest, (req, res) => {
    const customer = localStorage.customers.find(c => c.id === req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
});

// Add customer
app.post('/api/customers', authenticateRequest, (req, res) => {
    const customer = {
        id: req.body.id || `cust_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    localStorage.customers.push(customer);
    res.json(customer);
});

// Update customer
app.put('/api/customers/:id', authenticateRequest, (req, res) => {
    const index = localStorage.customers.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Customer not found' });
    localStorage.customers[index] = { ...localStorage.customers[index], ...req.body };
    res.json(localStorage.customers[index]);
});

// ==================== QUOTES ====================

// Get all quotes
app.get('/api/quotes', authenticateRequest, (req, res) => {
    res.json(localStorage.quotes);
});

// Get single quote
app.get('/api/quotes/:id', authenticateRequest, (req, res) => {
    const quote = localStorage.quotes.find(q => q.id === req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    res.json(quote);
});

// Add quote
app.post('/api/quotes', authenticateRequest, (req, res) => {
    const quote = {
        id: req.body.id || `quote_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString(),
        status: req.body.status || 'draft'
    };
    localStorage.quotes.push(quote);
    res.json(quote);
});

// Update quote
app.put('/api/quotes/:id', authenticateRequest, (req, res) => {
    const index = localStorage.quotes.findIndex(q => q.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Quote not found' });
    localStorage.quotes[index] = { ...localStorage.quotes[index], ...req.body };
    res.json(localStorage.quotes[index]);
});

// ==================== JOBS ====================

// Get all jobs
app.get('/api/jobs', authenticateRequest, (req, res) => {
    res.json(localStorage.jobs);
});

// Get single job
app.get('/api/jobs/:id', authenticateRequest, (req, res) => {
    const job = localStorage.jobs.find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

// Add job
app.post('/api/jobs', authenticateRequest, (req, res) => {
    const job = {
        id: req.body.id || `job_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString(),
        status: req.body.status || 'pending'
    };
    localStorage.jobs.push(job);
    res.json(job);
});

// Update job
app.put('/api/jobs/:id', authenticateRequest, (req, res) => {
    const index = localStorage.jobs.findIndex(j => j.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Job not found' });
    localStorage.jobs[index] = { ...localStorage.jobs[index], ...req.body };
    res.json(localStorage.jobs[index]);
});

// ==================== PARTS ====================

// Get all parts
app.get('/api/parts', authenticateRequest, (req, res) => {
    res.json(localStorage.parts);
});

// Add part
app.post('/api/parts', authenticateRequest, (req, res) => {
    const part = {
        id: req.body.id || `part_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    localStorage.parts.push(part);
    res.json(part);
});

// ==================== STAFF ====================

// Get all staff
app.get('/api/staff', authenticateRequest, (req, res) => {
    res.json(localStorage.staff);
});

// Add staff
app.post('/api/staff', authenticateRequest, (req, res) => {
    const staff = {
        id: req.body.id || `staff_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    localStorage.staff.push(staff);
    res.json(staff);
});

// ==================== PHOTOS ====================

// Get all photos
app.get('/api/photos', authenticateRequest, (req, res) => {
    res.json(localStorage.photos);
});

// Add photo
app.post('/api/photos', authenticateRequest, (req, res) => {
    const photo = {
        id: req.body.id || `photo_${Date.now()}`,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    localStorage.photos.push(photo);
    res.json(photo);
});

// ==================== SYSTEM STATUS ====================

// Get system status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        mode: 'single-shop (no Firebase)',
        database: 'in-memory',
        counts: {
            vehicles: localStorage.vehicles.length,
            customers: localStorage.customers.length,
            quotes: localStorage.quotes.length,
            jobs: localStorage.jobs.length,
            parts: localStorage.parts.length
        }
    });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log('\ud83d\ude80 Server running on port', PORT);
    console.log('\ud83d\udcdd Mode: Single-shop (no Firebase)');
    console.log('\ud83d\udcbe Storage: In-memory (data will reset on restart)');
    console.log('');
    console.log('\u2705 Ready for testing!');
});
