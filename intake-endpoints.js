// Intake API Endpoints
// VHICL Pro Service Advisor System

/**
 * ================================
 * CAR INTAKE API ENDPOINTS
 * ================================
 * 
 * These endpoints handle both appointment arrivals and walk-in/drop-off intakes
 * via ALEX voice assistant (VAPI)
 */

const CarIntakeHandler = require('./vapi-car-intake.js');
const EmailService = require('./email-service-updated.js');

// Intake state storage (in production, use database)
let intakeState = {};

/**
 * Initialize and register all intake endpoints
 * @param {Express} app - Express app instance
 * @param {Object} shopSettingsService - Shop settings service instance
 */
function registerIntakeEndpoints(app, shopSettingsService) {
    /**
     * POST /api/intake/start
     * Start car intake process via phone call
     */
    app.post('/api/intake/start', async (req, res) => {
        try {
            const { customerPhone, intakeMethod } = req.body;
            
            if (!customerPhone) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Customer phone number is required' 
                });
            }

            // Get shop settings
            const shopSettings = await shopSettingsService.getSettings();
            
            // Initialize handler with current settings
            const carIntakeHandler = new CarIntakeHandler(shopSettings.voice?.vapiApiKey, shopSettings);

            // Start intake based on method
            let result;
            if (intakeMethod === 'appointment') {
                result = await carIntakeHandler.handleAppointmentArrival(customerPhone);
            } else if (intakeMethod === 'walkin') {
                result = await carIntakeHandler.handleWalkIn(customerPhone);
            } else if (intakeMethod === 'dropoff') {
                result = await carIntakeHandler.handleDropOff(customerPhone);
            } else {
                result = await carIntakeHandler.startIntake(customerPhone);
            }

            // Store intake state
            intakeState[result.intakeId] = result;

            res.json({
                success: true,
                intakeId: result.intakeId,
                status: result.status,
                message: result.message
            });

        } catch (error) {
            console.error('Error starting intake:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    /**
     * POST /api/intake/complete
     * Complete car intake and generate work order
     */
    app.post('/api/intake/complete', async (req, res) => {
        try {
            const { 
                intakeId,
                customerName,
                email,
                phone,
                vehicleInfo,
                serviceDescription,
                notes
            } = req.body;

            // Get intake state
            const intake = intakeState[intakeId];
            if (!intake) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Intake not found' 
                });
            }

            // Get shop settings
            const shopSettings = await shopSettingsService.getSettings();

            // Create work order
            const workOrder = {
                id: `WO-${Date.now()}`,
                intakeId,
                customer: {
                    name: customerName,
                    email,
                    phone
                },
                vehicle: vehicleInfo,
                service: serviceDescription,
                notes,
                status: 'pending',
                createdAt: new Date().toISOString(),
                createdBy: 'ALEX'
            };

            // Send work order email
            try {
                const emailService = new EmailService({
                    apiKey: shopSettings.email?.sendgridApiKey,
                    fromEmail: shopSettings.email?.sendgridFromEmail,
                    fromName: shopSettings.shopInfo?.shopName || 'VHICL Pro'
                });

                await emailService.sendWorkOrder(workOrder);
            } catch (emailError) {
                console.error('Error sending work order email:', emailError);
                // Continue anyway
            }

            // Update intake state
            intakeState[intakeId] = {
                ...intake,
                status: 'completed',
                workOrder,
                completedAt: new Date().toISOString()
            };

            res.json({
                success: true,
                workOrder,
                message: 'Car intake completed successfully'
            });

        } catch (error) {
            console.error('Error completing intake:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    /**
     * POST /api/intake/walk-in
     * Create work order for walk-in customer (no phone call)
     */
    app.post('/api/intake/walk-in', async (req, res) => {
        try {
            const { 
                customerName,
                email,
                phone,
                vehicleInfo,
                serviceDescription,
                notes
            } = req.body;

            // Get shop settings
            const shopSettings = await shopSettingsService.getSettings();

            // Create work order
            const workOrder = {
                id: `WO-${Date.now()}`,
                intakeId: `WALKIN-${Date.now()}`,
                customer: {
                    name: customerName,
                    email,
                    phone
                },
                vehicle: vehicleInfo,
                service: serviceDescription,
                notes,
                status: 'pending',
                intakeMethod: 'walk-in',
                createdAt: new Date().toISOString(),
                createdBy: 'Staff'
            };

            // Send work order email if email provided
            if (email) {
                try {
                    const emailService = new EmailService({
                        apiKey: shopSettings.email?.sendgridApiKey,
                        fromEmail: shopSettings.email?.sendgridFromEmail,
                        fromName: shopSettings.shopInfo?.shopName || 'VHICL Pro'
                    });

                    await emailService.sendWorkOrder(workOrder);
                } catch (emailError) {
                    console.error('Error sending work order email:', emailError);
                }
            }

            res.json({
                success: true,
                workOrder,
                message: 'Walk-in work order created successfully'
            });

        } catch (error) {
            console.error('Error creating walk-in work order:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    /**
     * POST /api/intake/drop-off
     * Create work order for drop-off from home
     */
    app.post('/api/intake/drop-off', async (req, res) => {
        try {
            const { 
                customerName,
                email,
                phone,
                vehicleInfo,
                serviceDescription,
                notes,
                dropOffInstructions
            } = req.body;

            // Get shop settings
            const shopSettings = await shopSettingsService.getSettings();

            // Create work order
            const workOrder = {
                id: `WO-${Date.now()}`,
                intakeId: `DROPOFF-${Date.now()}`,
                customer: {
                    name: customerName,
                    email,
                    phone
                },
                vehicle: vehicleInfo,
                service: serviceDescription,
                notes,
                dropOffInstructions,
                status: 'pending',
                intakeMethod: 'drop-off',
                createdAt: new Date().toISOString(),
                createdBy: 'Customer'
            };

            // Send work order email if email provided
            if (email) {
                try {
                    const emailService = new EmailService({
                        apiKey: shopSettings.email?.sendgridApiKey,
                        fromEmail: shopSettings.email?.sendgridFromEmail,
                        fromName: shopSettings.shopInfo?.shopName || 'VHICL Pro'
                    });

                    await emailService.sendWorkOrder(workOrder);
                } catch (emailError) {
                    console.error('Error sending work order email:', emailError);
                }
            }

            res.json({
                success: true,
                workOrder,
                message: 'Drop-off work order created successfully'
            });

        } catch (error) {
            console.error('Error creating drop-off work order:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    /**
     * GET /api/intake/status/:intakeId
     * Get intake status by ID
     */
    app.get('/api/intake/status/:intakeId', async (req, res) => {
        try {
            const { intakeId } = req.params;
            const intake = intakeState[intakeId];

            if (!intake) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Intake not found' 
                });
            }

            res.json({
                success: true,
                intake
            });

        } catch (error) {
            console.error('Error getting intake status:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    /**
     * GET /api/intake/all
     * Get all intakes
     */
    app.get('/api/intake/all', async (req, res) => {
        try {
            const intakes = Object.values(intakeState);

            res.json({
                success: true,
                intakes,
                total: intakes.length
            });

        } catch (error) {
            console.error('Error getting all intakes:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    /**
     * POST /api/intake/quote
     * Get quote for service
     */
    app.post('/api/intake/quote', async (req, res) => {
        try {
            const { 
                vehicleInfo,
                serviceDescription
            } = req.body;

            // Get shop settings
            const shopSettings = await shopSettingsService.getSettings();
            const LaborService = require('./labor-service.js');
            const laborService = new LaborService({
                shopId: 'default',
                laborRate: shopSettings.labor?.laborRate || 100,
                laborMultiplier: shopSettings.labor?.laborMultiplier || 1.0
            });

            // Get labor estimate
            const laborEstimate = await laborService.quickEstimate(serviceDescription);

            // Calculate quote
            const quote = {
                labor: {
                    hours: laborEstimate.hours,
                    rate: shopSettings.labor?.laborRate || 100,
                    total: laborEstimate.hours * (shopSettings.labor?.laborRate || 100)
                },
                diagnosticFee: shopSettings.labor?.diagnosticFee || 0,
                subtotal: 0,
                tax: 0,
                total: 0
            };

            // Calculate totals
            quote.subtotal = quote.labor.total + quote.diagnosticFee;
            quote.tax = quote.subtotal * (shopSettings.pricing?.taxRate || 0);
            quote.total = quote.subtotal + quote.tax;

            res.json({
                success: true,
                quote
            });

        } catch (error) {
            console.error('Error getting quote:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    /**
     * POST /api/intake/approve-quote
     * Approve quote and schedule appointment
     */
    app.post('/api/intake/approve-quote', async (req, res) => {
        try {
            const { 
                intakeId,
                quote,
                appointmentDate,
                appointmentTime
            } = req.body;

            // Get intake state
            const intake = intakeState[intakeId];
            if (!intake) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Intake not found' 
                });
            }

            // Get shop settings
            const shopSettings = await shopSettingsService.getSettings();

            // Create appointment
            const appointment = {
                id: `APT-${Date.now()}`,
                intakeId,
                quote,
                appointmentDate,
                appointmentTime,
                status: 'scheduled',
                createdAt: new Date().toISOString(),
                createdBy: 'ALEX'
            };

            // Update intake state
            intakeState[intakeId] = {
                ...intake,
                status: 'scheduled',
                appointment,
                scheduledAt: new Date().toISOString()
            };

            // Send confirmation email if email available
            if (intake.customer?.email) {
                try {
                    const emailService = new EmailService({
                        apiKey: shopSettings.email?.sendgridApiKey,
                        fromEmail: shopSettings.email?.sendgridFromEmail,
                        fromName: shopSettings.shopInfo?.shopName || 'VHICL Pro'
                    });

                    await emailService.sendAppointmentConfirmation({
                        to: intake.customer.email,
                        appointment
                    });
                } catch (emailError) {
                    console.error('Error sending confirmation email:', emailError);
                }
            }

            res.json({
                success: true,
                appointment,
                message: 'Quote approved and appointment scheduled'
            });

        } catch (error) {
            console.error('Error approving quote:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });
}

// Export the registration function
module.exports = registerIntakeEndpoints;
