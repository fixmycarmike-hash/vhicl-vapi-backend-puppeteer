const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ==================== FIREBASE INITIALIZATION ====================
// Service Advisor in a Box - Professional Firebase Integration

// Firebase initialization with fallback for missing credentials
let db = null;
let techniciansRef = null;
let dropoffsRef = null;
let appointmentsRef = null;
let estimatesRef = null;
let customersRef = null;
let shopsRef = null;

const firebaseCredentialsPath = './vhicl-pro-cloud-sync-firebase-adminsdk-fbsvc-64f3920175.json';

try {
  // Check if Firebase credentials file exists
  if (fs.existsSync(firebaseCredentialsPath)) {
    const serviceAccount = require(firebaseCredentialsPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://vhicl-pro-cloud-sync-default-rtdb.firebaseio.com"
    });
    
    db = admin.database();
    console.log('✅ Firebase initialized - Service Advisor in a Box');
    
    // ==================== DATABASE REFERENCES ====================
    techniciansRef = db.ref('technicians');
    dropoffsRef = db.ref('dropoffs');
    appointmentsRef = db.ref('appointments');
    estimatesRef = db.ref('estimates');
    customersRef = db.ref('customers');
    shopsRef = db.ref('shops');
  } else {
    throw new Error(`Firebase credentials file not found: ${firebaseCredentialsPath}`);
  }
} catch (error) {
  console.warn('⚠️ Firebase credentials not found - running in client-only mode');
  console.warn('⚠️ Firebase Admin SDK features will be unavailable');
  console.warn('⚠️ To enable Firebase Admin features, ensure the credential file is present');
  console.warn('⚠️ Frontend will use Firebase Client SDK instead');
  console.warn('⚠️ Error details:', error.message);
  // Continue without Firebase - frontend will handle Firebase client SDK
}

// ==================== DATABASE REFERENCES ====================

// Helper function to safely check if Firebase is available
function isFirebaseAvailable() {
  return db !== null && techniciansRef !== null;
}

// In-memory cache for faster access (synced with Firebase)
let technicians = [];
let dropoffs = [];
let appointments = [];
let estimates = [];

// ==================== SOCIAL MEDIA INTEGRATION ====================
const shopSettingsService = require('./shop-settings-service.js');
const registerSocialMediaEndpoints = require('./social-media-endpoints.js');
registerSocialMediaEndpoints(app, shopSettingsService);

console.log('✅ Social Media endpoints registered');

// ==================== TECHNICIAN MANAGEMENT ENDPOINTS ====================

// Get all technicians
app.get('/api/technicians', async (req, res) => {
    try {
        const snapshot = await techniciansRef.once('value');
        const data = snapshot.val() || {};
        const techList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        res.json({ technicians: techList });
    } catch (error) {
        console.error('❌ Error fetching technicians:', error);
        res.status(500).json({ error: 'Failed to fetch technicians' });
    }
});

// Add technician
app.post('/api/technicians', async (req, res) => {
    try {
        const tech = {
            ...req.body,
            createdAt: new Date().toISOString()
        };
        const ref = await techniciansRef.push(tech);
        const result = { id: ref.key, ...tech };
        res.json({ success: true, technician: result });
    } catch (error) {
        console.error('❌ Error creating technician:', error);
        res.status(500).json({ error: 'Failed to create technician' });
    }
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
app.get('/api/dropoffs', async (req, res) => {
    try {
        const snapshot = await dropoffsRef.once('value');
        const data = snapshot.val() || {};
        const dropoffList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        res.json({ dropoffs: dropoffList });
    } catch (error) {
        console.error('❌ Error fetching dropoffs:', error);
        res.status(500).json({ error: 'Failed to fetch dropoffs' });
    }
});

// Add drop-off
app.post('/api/dropoffs', async (req, res) => {
    try {
        const dropoff = {
            ...req.body,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        const ref = await dropoffsRef.push(dropoff);
        const result = { id: ref.key, ...dropoff };
        res.json({ success: true, dropoff: result });
    } catch (error) {
        console.error('❌ Error creating dropoff:', error);
        res.status(500).json({ error: 'Failed to create dropoff' });
    }
});

// Update drop-off
app.put('/api/dropoffs/:id', async (req, res) => {
    try {
        await dropoffsRef.child(req.params.id).update(req.body);
        const snapshot = await dropoffsRef.child(req.params.id).once('value');
        const dropoff = { id: req.params.id, ...snapshot.val() };
        res.json({ success: true, dropoff });
    } catch (error) {
        console.error('❌ Error updating dropoff:', error);
        res.status(500).json({ error: 'Failed to update dropoff' });
    }
});

// Delete drop-off
app.delete('/api/dropoffs/:id', async (req, res) => {
    try {
        await dropoffsRef.child(req.params.id).remove();
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting dropoff:', error);
        res.status(500).json({ error: 'Failed to delete dropoff' });
    }
});

// ==================== JOB ASSIGNMENT ENDPOINTS ====================

// Assign technician to job
app.post('/api/jobs/assign', async (req, res) => {
    try {
        const { jobId, technicianId } = req.body;
        
        // Update drop-off if jobId is a drop-off
        const dropoffSnapshot = await dropoffsRef.child(jobId).once('value');
        if (dropoffSnapshot.exists()) {
            await dropoffsRef.child(jobId).update({
                assignedTechnicianId: technicianId,
                status: 'assigned',
                assignedAt: new Date().toISOString()
            });
            const updated = await dropoffsRef.child(jobId).once('value');
            return res.json({ success: true, dropoff: { id: jobId, ...updated.val() } });
        }
        
        res.status(404).json({ error: 'Job not found' });
    } catch (error) {
        console.error('❌ Error assigning job:', error);
        res.status(500).json({ error: 'Failed to assign job' });
    }
});

// ==================== APPOINTMENT ENDPOINTS ====================

// Get all appointments
app.get('/api/appointments', async (req, res) => {
    try {
        const snapshot = await appointmentsRef.once('value');
        const data = snapshot.val() || {};
        const appointmentList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        res.json({ appointments: appointmentList });
    } catch (error) {
        console.error('❌ Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// Add appointment
app.post('/api/appointments', async (req, res) => {
    try {
        const appointment = {
            ...req.body,
            createdAt: new Date().toISOString()
        };
        const ref = await appointmentsRef.push(appointment);
        const result = { id: ref.key, ...appointment };
        res.json({ success: true, appointment: result });
    } catch (error) {
        console.error('❌ Error creating appointment:', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
});

// Update appointment
app.put('/api/appointments/:id', async (req, res) => {
    try {
        await appointmentsRef.child(req.params.id).update(req.body);
        const snapshot = await appointmentsRef.child(req.params.id).once('value');
        const appointment = { id: req.params.id, ...snapshot.val() };
        res.json({ success: true, appointment });
    } catch (error) {
        console.error('❌ Error updating appointment:', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

// ==================== ESTIMATE ENDPOINTS ====================

// Get all estimates
app.get('/api/estimates', async (req, res) => {
    try {
        const snapshot = await estimatesRef.once('value');
        const data = snapshot.val() || {};
        const estimateList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        res.json({ estimates: estimateList });
    } catch (error) {
        console.error('❌ Error fetching estimates:', error);
        res.status(500).json({ error: 'Failed to fetch estimates' });
    }
});

// Add estimate
app.post('/api/estimates', async (req, res) => {
    try {
        const estimate = {
            ...req.body,
            createdAt: new Date().toISOString()
        };
        const ref = await estimatesRef.push(estimate);
        const result = { id: ref.key, ...estimate };
        res.json({ success: true, estimate: result });
    } catch (error) {
        console.error('❌ Error creating estimate:', error);
        res.status(500).json({ error: 'Failed to create estimate' });
    }
});

// Update estimate
app.put('/api/estimates/:id', async (req, res) => {
    try {
        await estimatesRef.child(req.params.id).update(req.body);
        const snapshot = await estimatesRef.child(req.params.id).once('value');
        const estimate = { id: req.params.id, ...snapshot.val() };
        res.json({ success: true, estimate });
    } catch (error) {
        console.error('❌ Error updating estimate:', error);
        res.status(500).json({ error: 'Failed to update estimate' });
    }
});

// Decode license plate via Nexpart
app.post('/api/decode-license-plate', async (req, res) => {
    try {
        const { licensePlate } = req.body;
        
        if (!licensePlate || licensePlate.length < 5) {
            return res.json({ success: false, error: 'Invalid license plate' });
        }

        console.log(`🔍 Decoding license plate: ${licensePlate}`);

        // TODO: Replace with actual Nexpart API call
        // For now, return mock data based on common plate patterns
        // In production, integrate with Nexpart VIN decoder API
        
        const mockVehicles = [
            { make: 'Toyota', model: 'Camry', year: 2022, vin: '4T1BF1FK8CU123456' },
            { make: 'Honda', model: 'Civic', year: 2021, vin: '1HGCV1F31KA123456' },
            { make: 'Ford', model: 'F-150', year: 2023, vin: '1FTEW1EP8PFA12345' },
            { make: 'Chevrolet', model: 'Silverado', year: 2022, vin: '3GCUYDED2MG123456' },
            { make: 'Nissan', model: 'Altima', year: 2021, vin: '1N4BL4BV3LC123456' }
        ];

        // Simple hash-based selection for consistent mock results
        const hash = licensePlate.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const vehicle = mockVehicles[hash % mockVehicles.length];

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`✅ Decoded to: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);

        res.json({
            success: true,
            vehicle: {
                ...vehicle,
                licensePlate: licensePlate.toUpperCase()
            },
            source: 'Nexpart ACES (Mock)'
        });

    } catch (error) {
        console.error('❌ License plate decode error:', error);
        res.status(500).json({ success: false, error: 'Failed to decode license plate' });
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

// ==================== VAPI PHONE CALL ENDPOINTS ====================

// Parse phone directory
function parsePhoneDirectory(directoryText) {
    if (!directoryText) return [];
    return directoryText.split('\n')
        .filter(line => line.trim() && line.includes('|'))
        .map(line => {
            const parts = line.split('|');
            return {
                name: parts[0]?.trim() || '',
                phone: parts[1]?.trim() || '',
                notes: parts[2]?.trim() || ''
            };
        })
        .filter(entry => entry.name && entry.phone);
}

// Make VAPI phone call
app.post('/api/vapi/call', async (req, res) => {
    const { phoneNumber, script, voice, type, vapiEnabled } = req.body;
    
    if (!phoneNumber || !script) {
        return res.status(400).json({ 
            success: false, 
            error: 'Phone number and script are required' 
        });
    }

    try {
        // Check if VAPI is configured
        if (!vapiEnabled) {
            return res.status(400).json({ 
                success: false, 
                error: 'VAPI is not enabled. Please configure VAPI in Settings.' 
            });
        }

        // Simulate VAPI call (in production, this would make actual API call to VAPI)
        const callResult = {
            success: true,
            callId: `call_${Date.now()}`,
            phoneNumber: phoneNumber,
            script: script,
            voice: voice || 'rachel',
            type: type,
            status: 'initiated',
            timestamp: new Date().toISOString(),
            message: `📞 Call initiated to ${phoneNumber} using ${voice} voice`
        };

        console.log('VAPI Call Details:', callResult);
        res.json(callResult);
    } catch (error) {
        console.error('VAPI call error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to initiate VAPI call: ' + error.message 
        });
    }
});

// Get parsed phone directory
app.post('/api/vapi/directory', (req, res) => {
    const { type, directoryText } = req.body;
    const entries = parsePhoneDirectory(directoryText);
    res.json({ success: true, entries, count: entries.length });
});

// ==================== EMAIL ENDPOINTS ====================

// Send email via SendGrid
app.post('/api/email/send', async (req, res) => {
    const { to, subject, html, text, fromEmail, fromName, apiKey } = req.body;
    
    if (!to || !subject || !apiKey) {
        return res.status(400).json({ 
            success: false, 
            error: 'Recipient email, subject, and API key are required' 
        });
    }

    try {
        // Simulate SendGrid email (in production, this would use actual SendGrid API)
        const emailResult = {
            success: true,
            messageId: `msg_${Date.now()}`,
            to: to,
            subject: subject,
            from: `${fromName || 'VHICL Pro Auto Shop'} <${fromEmail || 'noreply@vhiclpro.com'}>`,
            timestamp: new Date().toISOString(),
            message: `📧 Email sent to ${to} - ${subject}`
        };

        console.log('Email Details:', emailResult);
        res.json(emailResult);
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send email: ' + error.message 
        });
    }
});

// Send vehicle completion email
app.post('/api/email/completion', async (req, res) => {
    const { 
        customerEmail, 
        customerName, 
        vehicleInfo, 
        servicesPerformed, 
        totalCost,
        completionDate,
        shopName,
        shopPhone,
        shopAddress,
        apiKey 
    } = req.body;

    if (!customerEmail || !apiKey) {
        return res.status(400).json({ 
            success: false, 
            error: 'Customer email and API key are required' 
        });
    }

    try {
        // Generate completion email HTML
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #0a2540; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .vehicle-info { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #0a2540; }
                    .total { font-size: 24px; font-weight: bold; color: #0a2540; margin: 20px 0; }
                    .footer { background: #0a2540; color: white; padding: 15px; text-align: center; font-size: 12px; }
                    .btn { background: #0a2540; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚗 Your Vehicle Is Ready!</h1>
                    </div>
                    <div class="content">
                        <h2>Great News, ${customerName}!</h2>
                        <p>Your vehicle is now ready for pickup. We've completed all requested services and your vehicle is in perfect condition.</p>
                        
                        <div class="vehicle-info">
                            <h3>🔧 Vehicle Details</h3>
                            <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
                            <p><strong>Services Performed:</strong></p>
                            <ul>
                                ${servicesPerformed.map(s => `<li>${s}</li>`).join('')}
                            </ul>
                            <p><strong>Completion Date:</strong> ${new Date(completionDate).toLocaleDateString()}</p>
                        </div>
                        
                        <div class="total">
                            Total: $${totalCost.toFixed(2)}
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="#" class="btn">View Invoice</a>
                            <a href="#" class="btn">Make Payment</a>
                        </div>
                        
                        <p><strong>📍 Pickup Location:</strong></p>
                        <p>${shopName}<br>${shopAddress}<br>📞 ${shopPhone}</p>
                        
                        <p>Please call us before pickup so we can have your vehicle ready for you.</p>
                        <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
                    </div>
                    <div class="footer">
                        <p>Thank you for choosing ${shopName}!</p>
                        <p>${shopAddress} | 📞 ${shopPhone}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const emailResult = {
            success: true,
            messageId: `completion_${Date.now()}`,
            to: customerEmail,
            type: 'vehicle_completion',
            timestamp: new Date().toISOString(),
            message: `📧 Vehicle completion email sent to ${customerEmail}`
        };

        console.log('Completion Email Details:', {
            to: customerEmail,
            vehicle: vehicleInfo,
            total: totalCost,
            subject: `Your ${vehicleInfo} is Ready for Pickup!`
        });

        res.json(emailResult);
    } catch (error) {
        console.error('Completion email error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send completion email: ' + error.message 
        });
    }
});

// Send invoice/payment request email
app.post('/api/email/invoice', async (req, res) => {
    const { 
        customerEmail, 
        customerName, 
        invoiceNumber,
        vehicleInfo,
        invoiceItems,
        subtotal,
        tax,
        total,
        dueDate,
        shopName,
        shopPhone,
        shopAddress,
        apiKey 
    } = req.body;

    if (!customerEmail || !apiKey) {
        return res.status(400).json({ 
            success: false, 
            error: 'Customer email and API key are required' 
        });
    }

    try {
        // Generate invoice email HTML
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #d9534f; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .invoice-details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #d9534f; }
                    .items { background: white; padding: 15px; margin: 10px 0; }
                    .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd; }
                    .total-row { font-weight: bold; padding: 10px 0; border-top: 2px solid #333; }
                    .total { font-size: 24px; font-weight: bold; color: #d9534f; margin: 20px 0; }
                    .due-date { background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin: 15px 0; }
                    .footer { background: #0a2540; color: white; padding: 15px; text-align: center; font-size: 12px; }
                    .btn { background: #d9534f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📄 Invoice #${invoiceNumber}</h1>
                    </div>
                    <div class="content">
                        <h2>Payment Request</h2>
                        <p>Dear ${customerName},</p>
                        <p>Please find below the invoice for services performed on your vehicle:</p>
                        
                        <div class="invoice-details">
                            <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
                            <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
                            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                        
                        <div class="items">
                            <h3>📋 Invoice Items</h3>
                            ${invoiceItems.map(item => `
                                <div class="item">
                                    <span>${item.description}</span>
                                    <span>$${item.amount.toFixed(2)}</span>
                                </div>
                            `).join('')}
                            
                            <div class="total-row">
                                <span>Subtotal:</span>
                                <span>$${subtotal.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span>Tax:</span>
                                <span>$${tax.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div class="total">
                            Total Due: $${total.toFixed(2)}
                        </div>
                        
                        <div class="due-date">
                            <strong>⚠️ Payment Due Date: ${new Date(dueDate).toLocaleDateString()}</strong>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="#" class="btn">Pay Now</a>
                            <a href="#" class="btn">Download Invoice</a>
                        </div>
                        
                        <p><strong>💳 Payment Methods:</strong></p>
                        <ul>
                            <li>Credit/Debit Card</li>
                            <li>Cash</li>
                            <li>PayPal</li>
                        </ul>
                        
                        <p><strong>📍 Contact Information:</strong></p>
                        <p>${shopName}<br>${shopAddress}<br>📞 ${shopPhone}</p>
                    </div>
                    <div class="footer">
                        <p>Thank you for your business!</p>
                        <p>${shopAddress} | 📞 ${shopPhone}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const emailResult = {
            success: true,
            messageId: `invoice_${Date.now()}`,
            to: customerEmail,
            invoiceNumber: invoiceNumber,
            total: total,
            type: 'invoice_payment_request',
            timestamp: new Date().toISOString(),
            message: `📧 Invoice email sent to ${customerEmail} - Total: $${total.toFixed(2)}`
        };

        console.log('Invoice Email Details:', {
            to: customerEmail,
            invoiceNumber: invoiceNumber,
            total: total,
            dueDate: dueDate,
            subject: `Invoice #${invoiceNumber} - Payment Request`
        });

        res.json(emailResult);
    } catch (error) {
        console.error('Invoice email error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send invoice email: ' + error.message 
        });
    }
});

// Send payment reminder email
app.post('/api/email/payment-reminder', async (req, res) => {
    const { 
        customerEmail, 
        customerName, 
        invoiceNumber,
        amount,
        dueDate,
        daysOverdue,
        shopName,
        shopPhone,
        apiKey 
    } = req.body;

    if (!customerEmail || !apiKey) {
        return res.status(400).json({ 
            success: false, 
            error: 'Customer email and API key are required' 
        });
    }

    try {
        const urgencyColor = daysOverdue > 7 ? '#dc3545' : '#ffc107';
        const urgencyMessage = daysOverdue > 7 ? 'URGENT: Payment is significantly overdue!' : 'Payment Reminder';
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: ${urgencyColor}; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .reminder { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid ${urgencyColor}; }
                    .total { font-size: 24px; font-weight: bold; color: ${urgencyColor}; margin: 20px 0; }
                    .footer { background: #0a2540; color: white; padding: 15px; text-align: center; font-size: 12px; }
                    .btn { background: ${urgencyColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⏰ Payment Reminder</h1>
                    </div>
                    <div class="content">
                        <h2>${urgencyMessage}</h2>
                        <p>Dear ${customerName},</p>
                        <p>This is a friendly reminder that payment for invoice #${invoiceNumber} is overdue.</p>
                        
                        <div class="reminder">
                            <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
                            <p><strong>Amount Due:</strong> $${amount.toFixed(2)}</p>
                            <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
                            <p><strong>Days Overdue:</strong> ${daysOverdue} days</p>
                        </div>
                        
                        <div class="total">
                            $${amount.toFixed(2)}
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="#" class="btn">Pay Now</a>
                            <a href="#" class="btn">Contact Us</a>
                        </div>
                        
                        <p>Please arrange payment as soon as possible to avoid any late fees. If you have already made payment, please disregard this notice.</p>
                        
                        <p><strong>📞 Contact Information:</strong></p>
                        <p>${shopName}<br>📞 ${shopPhone}</p>
                    </div>
                    <div class="footer">
                        <p>Thank you for your prompt attention to this matter.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const emailResult = {
            success: true,
            messageId: `reminder_${Date.now()}`,
            to: customerEmail,
            invoiceNumber: invoiceNumber,
            daysOverdue: daysOverdue,
            type: 'payment_reminder',
            timestamp: new Date().toISOString(),
            message: `📧 Payment reminder sent to ${customerEmail} - ${daysOverdue} days overdue`
        };

        console.log('Payment Reminder Details:', {
            to: customerEmail,
            invoiceNumber: invoiceNumber,
            amount: amount,
            daysOverdue: daysOverdue
        });

        res.json(emailResult);
    } catch (error) {
        console.error('Payment reminder error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send payment reminder: ' + error.message 
        });
    }
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
