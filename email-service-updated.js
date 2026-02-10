// Email Service Module for VHICL Pro
// Handles all email notifications for customer service lifecycle

const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const shopSettingsService = require('./shop-settings-service-complete');

// Email configuration
const emailConfig = {
    service: process.env.EMAIL_SERVICE || 'gmail', // 'gmail', 'sendgrid', 'ses', etc.
    from: process.env.EMAIL_FROM || 'noreply@vhiclpro.com',
    fromName: process.env.EMAIL_FROM_NAME || 'VHICL Pro',
    replyTo: process.env.EMAIL_REPLY_TO || 'noreply@vhiclpro.com',
    
    // Gmail settings
    gmailUser: process.env.GMAIL_USER,
    gmailPassword: process.env.GMAIL_PASSWORD,
    
    // SendGrid settings
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    
    // BCC recipients (optional)
    bccEmails: process.env.BCC_EMAILS ? process.env.BCC_EMAILS.split(',') : [],
    
    // Tracking
    trackOpens: true,
    trackClicks: true
};

// Create transporter based on configuration
let transporter = null;

async function initializeTransporter() {
    try {
        if (emailConfig.service === 'gmail') {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: emailConfig.gmailUser,
                    pass: emailConfig.gmailPassword
                }
            });
        } else if (emailConfig.service === 'sendgrid') {
            const sgTransport = require('nodemailer-sendgrid-transport');
            transporter = nodemailer.createTransport(sgTransport({
                apiKey: emailConfig.sendgridApiKey
            }));
        } else {
            // Default to SMTP
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                }
            });
        }
        
        console.log('Email transporter initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing email transporter:', error);
        return false;
    }
}

// Load and render email template
async function loadTemplate(templateName, data) {
    try {
        const templatePath = path.join(__dirname, 'email-templates', templateName);
        let templateContent = await fs.readFile(templatePath, 'utf-8');
        
        // Replace placeholders with actual data
        // Using simple string replacement for compatibility
        Object.keys(data).forEach(key => {
            const placeholder = `{{${key}}}`;
            const regex = new RegExp(placeholder, 'g');
            templateContent = templateContent.replace(regex, data[key] || '');
        });
        
        // Handle conditional blocks (simple implementation)
        templateContent = templateContent.replace(/{{#if [^}]+}}[\s\S]*?{{\/if}}/g, (match) => {
            // For now, remove conditional blocks
            // In production, you'd use a proper template engine like Handlebars
            return '';
        });
        
        // Handle each loops (simple implementation)
        templateContent = templateContent.replace(/{{#each [^}]+}}[\s\S]*?{{\/each}}/g, (match) => {
            // For now, replace with a simple message
            // In production, you'd use a proper template engine like Handlebars
            return '<li>Items listed in your estimate</li>';
        });
        
        return templateContent;
    } catch (error) {
        console.error('Error loading email template:', error);
        throw error;
    }
}

// Send email
async function sendEmail(to, subject, htmlContent, textContent = null) {
    try {
        if (!transporter) {
            await initializeTransporter();
        }
        
        if (!transporter) {
            throw new Error('Email transporter not initialized');
        }
        
        const mailOptions = {
            from: `${emailConfig.fromName} <${emailConfig.from}>`,
            to: to,
            replyTo: emailConfig.replyTo,
            subject: subject,
            html: htmlContent,
            text: textContent || stripHtml(htmlContent)
        };
        
        // Add BCC if configured
        if (emailConfig.bccEmails.length > 0) {
            mailOptions.bcc = emailConfig.bccEmails.join(', ');
        }
        
        // Add tracking headers if SendGrid
        if (emailConfig.service === 'sendgrid') {
            mailOptions.headers = {
                'X-SG-Track-Clicks': emailConfig.trackClicks ? 'true' : 'false',
                'X-SG-Track-Opens': emailConfig.trackOpens ? 'true' : 'false'
            };
        }
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log('Email sent successfully:', info.messageId);
        return {
            success: true,
            messageId: info.messageId,
            response: info.response
        };
    } catch (error) {
        console.error('Error sending email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Strip HTML tags for plain text version
function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '')
               .replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&#39;/g, "'")
               .replace(/&quot;/g, '"')
               .trim();
}

// Email notification functions

/**
 * Send check-in confirmation email
 */
async function sendCheckinConfirmation(customerData) {
    try {
        const shopSettings = shopSettingsService.getSettings();
        const templateData = {
            shop_name: shopSettings.shopName,
            customer_name: customerData.customerName,
            year: customerData.vehicleYear,
            make: customerData.vehicleMake,
            model: customerData.vehicleModel,
            vin: customerData.vin,
            mileage: customerData.mileage,
            checkin_date: customerData.checkinDate,
            concerns: customerData.concerns || [],
            shop_phone: shopSettings.shopPhone,
            shop_email: shopSettings.shopEmail,
            shop_address: shopSettings.shopAddress,
            business_hours: shopSettings.businessHours,
            current_year: new Date().getFullYear()
        };
        
        const htmlContent = await loadTemplate('checkin-confirmation.html', templateData);
        
        return await sendEmail(
            customerData.customerEmail,
            `Vehicle Check-in Confirmed - ${shopSettings.shopName}`,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending check-in confirmation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send estimate ready email
 */
async function sendEstimateReady(estimateData) {
    try {
        const shopSettings = shopSettingsService.getSettings();
        const templateData = {
            shop_name: shopSettings.shopName,
            customer_name: estimateData.customerName,
            year: estimateData.vehicleYear,
            make: estimateData.vehicleMake,
            model: estimateData.vehicleModel,
            estimate_id: estimateData.estimateId,
            estimate_date: estimateData.estimateDate,
            total_amount: estimateData.totalAmount,
            is_urgent: estimateData.isUrgent || false,
            view_estimate_url: estimateData.viewUrl,
            shop_phone_url: estimateData.phoneUrl,
            shop_phone: shopSettings.shopPhone,
            shop_email: shopSettings.shopEmail,
            shop_address: shopSettings.shopAddress,
            business_hours: shopSettings.businessHours,
            current_year: new Date().getFullYear()
        };
        
        const htmlContent = await loadTemplate('estimate-ready.html', templateData);
        
        return await sendEmail(
            estimateData.customerEmail,
            `Your Estimate is Ready - ${shopSettings.shopName}`,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending estimate ready email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send estimate approved email
 */
async function sendEstimateApproved(approvalData) {
    try {
        const templateData = {
            shop_name: approvalData.shopName || 'Your Shop',
            customer_name: approvalData.customerName,
            year: approvalData.vehicleYear,
            make: approvalData.vehicleMake,
            model: approvalData.vehicleModel,
            estimate_id: approvalData.estimateId,
            approval_date: approvalData.approvalDate,
            approval_method: approvalData.approvalMethod || 'Online',
            approved_amount: approvalData.approvedAmount,
            expected_start_date: approvalData.expectedStartDate,
            parts_expected_date: approvalData.partsExpectedDate,
            expected_completion_date: approvalData.expectedCompletionDate,
            shop_phone: approvalData.shopPhone,
            shop_email: approvalData.shopEmail,
            shop_address: approvalData.shopAddress,
            business_hours: approvalData.businessHours || 'Monday - Friday, 8AM - 5PM',
            current_year: new Date().getFullYear()
        };
        
        const htmlContent = await loadTemplate('estimate-approved.html', templateData);
        
        return await sendEmail(
            approvalData.customerEmail,
            `Work Authorized - ${approvalData.shopName}`,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending estimate approved email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send parts ordered email
 */
async function sendPartsOrdered(partsData) {
    try {
        const templateData = {
            shop_name: partsData.shopName || 'Your Shop',
            customer_name: partsData.customerName,
            year: partsData.vehicleYear,
            make: partsData.vehicleMake,
            model: partsData.vehicleModel,
            estimate_id: partsData.estimateId,
            order_date: partsData.orderDate,
            expected_arrival_date: partsData.expectedArrivalDate,
            service_start_date: partsData.serviceStartDate,
            parts: partsData.parts || [],
            shop_phone: partsData.shopPhone,
            shop_email: partsData.shopEmail,
            shop_address: partsData.shopAddress,
            business_hours: partsData.businessHours || 'Monday - Friday, 8AM - 5PM',
            current_year: new Date().getFullYear()
        };
        
        const htmlContent = await loadTemplate('parts-ordered.html', templateData);
        
        return await sendEmail(
            partsData.customerEmail,
            `Parts Update - ${partsData.shopName}`,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending parts ordered email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send vehicle ready email
 */
async function sendVehicleReady(readyData) {
    try {
        const templateData = {
            shop_name: readyData.shopName || 'Your Shop',
            customer_name: readyData.customerName,
            year: readyData.vehicleYear,
            make: readyData.vehicleMake,
            model: readyData.vehicleModel,
            estimate_id: readyData.estimateId,
            completion_date: readyData.completionDate,
            total_amount: readyData.totalAmount,
            payment_url: readyData.paymentUrl,
            shop_phone_url: readyData.phoneUrl,
            completed_work: readyData.completedWork || [],
            shop_address: readyData.shopAddress,
            business_hours: readyData.businessHours || 'Monday - Friday, 8AM - 5PM',
            shop_phone: readyData.shopPhone,
            shop_email: readyData.shopEmail,
            current_year: new Date().getFullYear()
        };
        
        const htmlContent = await loadTemplate('vehicle-ready.html', templateData);
        
        return await sendEmail(
            readyData.customerEmail,
            `Your Vehicle is Ready! - ${readyData.shopName}`,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending vehicle ready email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send payment confirmation email
 */
async function sendPaymentConfirmation(paymentData) {
    try {
        const templateData = {
            shop_name: paymentData.shopName || 'Your Shop',
            customer_name: paymentData.customerName,
            year: paymentData.vehicleYear,
            make: paymentData.vehicleMake,
            model: paymentData.vehicleModel,
            estimate_id: paymentData.estimateId,
            payment_date: paymentData.paymentDate,
            payment_amount: paymentData.paymentAmount,
            payment_method: paymentData.paymentMethod,
            transaction_id: paymentData.transactionId,
            shop_phone: paymentData.shopPhone,
            shop_email: paymentData.shopEmail,
            shop_address: paymentData.shopAddress,
            business_hours: paymentData.businessHours || 'Monday - Friday, 8AM - 5PM',
            current_year: new Date().getFullYear()
        };
        
        const htmlContent = await loadTemplate('payment-confirmation.html', templateData);
        
        return await sendEmail(
            paymentData.customerEmail,
            `Payment Confirmation - ${paymentData.shopName}`,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending payment confirmation email:', error);
        return { success: false, error: error.message };
    }
}

// Export all functions
module.exports = {
    initializeTransporter,
    sendEmail,
    sendCheckinConfirmation,
    sendEstimateReady,
    sendEstimateApproved,
    sendPartsOrdered,
    sendVehicleReady,
    sendPaymentConfirmation
};
