const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const shopSettingsService = require('./shop-settings-service-complete');
const emailService = require('./email-service-updated');
const NexpartScraper = require('./nexpart-scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes

// Sync Data
app.post('/api/sync', (req, res) => {
  try {
    const { customers, vehicles, techJobs, appointments, settings } = req.body;
    
    // Store data in memory (in production, use a database)
    if (customers) global.customers = customers;
    if (vehicles) global.vehicles = vehicles;
    if (techJobs) global.techJobs = techJobs;
    if (appointments) global.appointments = appointments;
    if (settings) global.settings = settings;
    
    res.json({ success: true, message: 'Data synced successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Shop Settings Routes
app.get('/api/shop/settings', (req, res) => {
  try {
    const settings = shopSettingsService.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/shop/settings', (req, res) => {
  try {
    const updatedSettings = shopSettingsService.updateSettings(req.body);
    res.json(updatedSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shop/alex-prompt', (req, res) => {
  try {
    const prompt = shopSettingsService.getAlexPrompt();
    res.json({ prompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// VAPI Phone System Routes
app.post('/api/vapi/check-vehicle-status', (req, res) => {
  try {
    const { phone_number } = req.body;
    const vehicle = global.vehicles?.find(v => v.customerPhone === phone_number);
    
    if (!vehicle) {
      return res.json({ status: 'not_found', message: 'Vehicle not found' });
    }
    
    res.json({
      status: 'found',
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status: vehicle.status,
        currentJob: vehicle.currentJob
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vapi/book-appointment', (req, res) => {
  try {
    const { customer_name, phone_number, date, time, service_type, vehicle_info } = req.body;
    
    // Create appointment (in production, save to database)
    const appointment = {
      id: Date.now(),
      customerName: customer_name,
      customerPhone: phone_number,
      date,
      time,
      serviceType: service_type,
      vehicleInfo: vehicle_info,
      status: 'scheduled'
    };
    
    // Send confirmation email
    const settings = shopSettingsService.getSettings();
    emailService.sendAppointmentConfirmation(
      customer_name,
      phone_number,
      date,
      time,
      service_type,
      vehicle_info,
      settings
    );
    
    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vapi/get-estimate', (req, res) => {
  try {
    const { phone_number, job_id } = req.body;
    
    const job = global.techJobs?.find(j => j.id === job_id && j.customerPhone === phone_number);
    
    if (!job) {
      return res.json({ status: 'not_found', message: 'Job not found' });
    }
    
    res.json({
      status: 'found',
      estimate: {
        jobId: job.id,
        description: job.description,
        parts: job.parts || [],
        labor: job.labor || 0,
        tax: job.tax || 0,
        total: job.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vapi/approve-estimate', (req, res) => {
  try {
    const { phone_number, job_id } = req.body;
    
    // Update job status
    const job = global.techJobs?.find(j => j.id === job_id && j.customerPhone === phone_number);
    if (job) {
      job.status = 'approved';
      job.approvedAt = new Date().toISOString();
    }
    
    // Send approval confirmation email
    const settings = shopSettingsService.getSettings();
    emailService.sendEstimateApproved(
      phone_number,
      job_id,
      settings
    );
    
    res.json({ success: true, message: 'Estimate approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vapi/check-parts-availability', (req, res) => {
  try {
    const { part_name, vehicle_info } = req.body;
    
    // Simulate parts lookup (in production, integrate with parts API)
    const parts = [
      {
        name: part_name,
        available: true,
        price: 54.35,// Realistic brake pad price
        source: 'Nexpart'
      }
    ];
    
    res.json({
      status: 'found',
      parts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vapi/get-shop-hours', (req, res) => {
  try {
    const settings = shopSettingsService.getSettings();
    
    res.json({
      hours: settings.shopHours || 'Mon-Fri: 8am-5pm, Sat: 8am-12pm'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vapi/take-message', (req, res) => {
  try {
    const { customer_name, phone_number, message, callback_requested } = req.body;
    
    // Store message (in production, save to database)
    const messageObj = {
      id: Date.now(),
      customerName: customer_name,
      customerPhone: phone_number,
      message,
      callbackRequested: callback_requested,
      createdAt: new Date().toISOString()
    };
    
    res.json({ success: true, message: 'Message saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Outbound Call Routes
app.post('/api/outbound/estimate-ready', (req, res) => {
  try {
    const { job_id } = req.body;
    
    const job = global.techJobs?.find(j => j.id === job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Send estimate ready email
    const settings = shopSettingsService.getSettings();
    emailService.sendEstimateReady(
      job.customerPhone,
      job_id,
      settings
    );
    
    res.json({ success: true, message: 'Estimate ready notification sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/outbound/car-ready', (req, res) => {
  try {
    const { job_id } = req.body;
    
    const job = global.techJobs?.find(j => j.id === job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Send vehicle ready email
    const settings = shopSettingsService.getSettings();
    emailService.sendVehicleReady(
      job.customerPhone,
      job_id,
      settings
    );
    
    res.json({ success: true, message: 'Vehicle ready notification sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email Routes
app.post('/api/email/send-checkin', async (req, res) => {
  try {
    const { customer_name, customer_email, vehicle_info } = req.body;
    const settings = shopSettingsService.getSettings();
    
    await emailService.sendCheckinConfirmation(
      customer_name,
      customer_email,
      vehicle_info,
      settings
    );
    
    res.json({ success: true, message: 'Check-in confirmation sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/send-estimate-ready', async (req, res) => {
  try {
    const { customer_email, job_id } = req.body;
    const settings = shopSettingsService.getSettings();
    
    await emailService.sendEstimateReady(
      customer_email,
      job_id,
      settings
    );
    
    res.json({ success: true, message: 'Estimate ready notification sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/send-estimate-approved', async (req, res) => {
  try {
    const { customer_email, job_id } = req.body;
    const settings = shopSettingsService.getSettings();
    
    await emailService.sendEstimateApproved(
      customer_email,
      job_id,
      settings
    );
    
    res.json({ success: true, message: 'Estimate approved confirmation sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/send-parts-ordered', async (req, res) => {
  try {
    const { customer_email, parts } = req.body;
    const settings = shopSettingsService.getSettings();
    
    await emailService.sendPartsOrdered(
      customer_email,
      parts,
      settings
    );
    
    res.json({ success: true, message: 'Parts ordered notification sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/send-vehicle-ready', async (req, res) => {
  try {
    const { customer_email, job_id } = req.body;
    const settings = shopSettingsService.getSettings();
    
    await emailService.sendVehicleReady(
      customer_email,
      job_id,
      settings
    );
    
    res.json({ success: true, message: 'Vehicle ready notification sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/send-payment-confirmation', async (req, res) => {
  try {
    const { customer_email, amount, payment_method } = req.body;
    const settings = shopSettingsService.getSettings();
    
    await emailService.sendPaymentConfirmation(
      customer_email,
      amount,
      payment_method,
      settings
    );
    
    res.json({ success: true, message: 'Payment confirmation sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Shop Settings:`, shopSettingsService.getSettings());
});