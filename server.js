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

// ==================== IN-MEMORY DATABASE ====================
// Using in-memory storage since we're not using Firebase

const technicians = [];
const dropoffs = [];
const appointments = [];
const estimates = [];

// ==================== TECHNICIAN MANAGEMENT ENDPOINTS ====================

// Get all technicians
app.get('/api/technicians', (req, res) => {
    res.json({ technicians });
});

// Add technician
app.post('/api/technicians', (req, res) => {
    const tech = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    technicians.push(tech);
    res.json({ success: true, technician: tech });
});

// Update technician
app.put('/api/technicians/:id', (req, res) => {
    const index = technicians.findIndex(t => t.id === req.params.id);
    if (index !== -1) {
        technicians[index] = { ...technicians[index], ...req.body };
        res.json({ success: true, technician: technicians[index] });
    } else {
        res.status(404).json({ error: 'Technician not found' });
    }
});

// Delete technician
app.delete('/api/technicians/:id', (req, res) => {
    const index = technicians.findIndex(t => t.id === req.params.id);
    if (index !== -1) {
        technicians.splice(index, 1);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Technician not found' });
    }
});

// ==================== VEHICLE DROP-OFF ENDPOINTS ====================

// Get all drop-offs
app.get('/api/dropoffs', (req, res) => {
    res.json({ dropoffs });
});

// Add drop-off
app.post('/api/dropoffs', (req, res) => {
    const dropoff = {
        id: Date.now().toString(),
        ...req.body,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    dropoffs.push(dropoff);
    res.json({ success: true, dropoff });
});

// Update drop-off
app.put('/api/dropoffs/:id', (req, res) => {
    const index = dropoffs.findIndex(d => d.id === req.params.id);
    if (index !== -1) {
        dropoffs[index] = { ...dropoffs[index], ...req.body };
        res.json({ success: true, dropoff: dropoffs[index] });
    } else {
        res.status(404).json({ error: 'Drop-off not found' });
    }
});

// Delete drop-off
app.delete('/api/dropoffs/:id', (req, res) => {
    const index = dropoffs.findIndex(d => d.id === req.params.id);
    if (index !== -1) {
        dropoffs.splice(index, 1);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Drop-off not found' });
    }
});

// ==================== JOB ASSIGNMENT ENDPOINTS ====================

// Assign technician to job
app.post('/api/jobs/assign', (req, res) => {
    const { jobId, technicianId } = req.body;
    
    // Update drop-off if jobId is a drop-off
    const dropoffIndex = dropoffs.findIndex(d => d.id === jobId);
    if (dropoffIndex !== -1) {
        dropoffs[dropoffIndex].assignedTechnicianId = technicianId;
        dropoffs[dropoffIndex].status = 'assigned';
        return res.json({ success: true, dropoff: dropoffs[dropoffIndex] });
    }
    
    res.status(404).json({ error: 'Job not found' });
});

// ==================== APPOINTMENT ENDPOINTS ====================

// Get all appointments
app.get('/api/appointments', (req, res) => {
    res.json({ appointments });
});

// Add appointment
app.post('/api/appointments', (req, res) => {
    const appointment = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    appointments.push(appointment);
    res.json({ success: true, appointment });
});

// Update appointment
app.put('/api/appointments/:id', (req, res) => {
    const index = appointments.findIndex(a => a.id === req.params.id);
    if (index !== -1) {
        appointments[index] = { ...appointments[index], ...req.body };
        res.json({ success: true, appointment: appointments[index] });
    } else {
        res.status(404).json({ error: 'Appointment not found' });
    }
});

// ==================== ESTIMATE ENDPOINTS ====================

// Get all estimates
app.get('/api/estimates', (req, res) => {
    res.json({ estimates });
});

// Add estimate
app.post('/api/estimates', (req, res) => {
    const estimate = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    estimates.push(estimate);
    res.json({ success: true, estimate });
});

// Update estimate
app.put('/api/estimates/:id', (req, res) => {
    const index = estimates.findIndex(e => e.id === req.params.id);
    if (index !== -1) {
        estimates[index] = { ...estimates[index], ...req.body };
        res.json({ success: true, estimate: estimates[index] });
    } else {
        res.status(404).json({ error: 'Estimate not found' });
    }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        message: 'VHICL Pro Backend Running',
        data: {
            technicians: technicians.length,
            dropoffs: dropoffs.length,
            appointments: appointments.length,
            estimates: estimates.length
        }
    });
});

// ==================== SPA ROUTING ====================

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    // Don't rewrite if it's a file request
    if (path.extname(req.path).length > 0) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`\n🚀 VHICL Pro Backend Running on port ${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
    console.log(`📱 Dashboard: http://localhost:${PORT}`);
    console.log(`👨‍🔧 Tech Management: http://localhost:${PORT}/tech-management.html`);
    console.log(`🚗 Drop-offs: http://localhost:${PORT}/vehicle-dropoff-manager.html`);
    console.log(`\n📊 Data stored in memory (no database required)\n`);
});
