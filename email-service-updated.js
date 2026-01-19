class EmailService {
  constructor(sendGridApiKey, fromEmail, fromName) {
    this.sendGridApiKey = sendGridApiKey;
    this.fromEmail = fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@vhiclpro.com';
    this.fromName = fromName || process.env.SENDGRID_FROM_NAME || 'VHICL Pro';
    this.nodemailer = require('nodemailer');
    this.sendgridTransport = require('nodemailer-sendgrid-transport');
    this.transporter = null;
    this.initialized = false;
  }

  async initialize() {
    if (!this.sendGridApiKey) {
      console.warn('⚠️  SendGrid API key not configured. Email service will be disabled.');
      return false;
    }

    try {
      this.transporter = this.nodemailer.createTransport(this.sendgridTransport({
        auth: {
          api_key: this.sendGridApiKey
        }
      }));
      this.initialized = true;
      console.log('✅ EmailService initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize EmailService:', error.message);
      return false;
    }
  }

  isReady() {
    return this.initialized && this.transporter;
  }

  async sendEmail(to, subject, htmlContent, textContent = '') {
    if (!this.isReady()) {
      throw new Error('EmailService not initialized. Check SendGrid API key.');
    }

    const mailOptions = {
      from: `${this.fromName} <${this.fromEmail}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, '')
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      throw error;
    }
  }

  async sendWorkOrder(workOrderData) {
    const {
      customerName,
      customerEmail,
      vehicleInfo,
      services,
      estimate,
      workOrderId,
      shopInfo
    } = workOrderData;

    const subject = `Work Order #${workOrderId} - ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Work Order #${workOrderId}</h2>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Vehicle Information</h3>
          <p><strong>Vehicle:</strong> ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}</p>
          ${vehicleInfo.color ? `<p><strong>Color:</strong> ${vehicleInfo.color}</p>` : ''}
          ${vehicleInfo.licensePlate ? `<p><strong>License Plate:</strong> ${vehicleInfo.licensePlate}</p>` : ''}
          ${vehicleInfo.mileage ? `<p><strong>Mileage:</strong> ${vehicleInfo.mileage}</p>` : ''}
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Services Requested</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${services.map(service => `<li>${service.name} - $${service.price}</li>`).join('')}
          </ul>
        </div>

        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Estimated Cost</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 0;">$${estimate.total}</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">
            Parts: $${estimate.parts} | Labor: $${estimate.labor} | Tax: $${estimate.tax}
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Thank you for choosing ${shopInfo.name || 'VHICL Pro'}. We'll contact you shortly with updates.
        </p>
      </div>
    `;

    return this.sendEmail(customerEmail, subject, htmlContent);
  }

  async sendQuote(quoteData) {
    const {
      customerName,
      customerEmail,
      vehicleInfo,
      parts,
      labor,
      total,
      quoteId,
      shopInfo
    } = quoteData;

    const subject = `Quote #${quoteId} - ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Quote #${quoteId}</h2>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Vehicle Information</h3>
          <p><strong>Vehicle:</strong> ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}</p>
          ${vehicleInfo.color ? `<p><strong>Color:</strong> ${vehicleInfo.color}</p>` : ''}
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Parts</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${parts.map(part => `<li>${part.name} - $${part.price}</li>`).join('')}
          </ul>
          <p><strong>Parts Total:</strong> $${parts.reduce((sum, p) => sum + p.price, 0)}</p>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Labor</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${labor.map(item => `<li>${item.name} - $${item.price}</li>`).join('')}
          </ul>
          <p><strong>Labor Total:</strong> $${labor.reduce((sum, l) => sum + l.price, 0)}</p>
        </div>

        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Total Estimate</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 0;">$${total}</p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          This quote is valid for 30 days. Please contact us to approve and schedule service.
        </p>
      </div>
    `;

    return this.sendEmail(customerEmail, subject, htmlContent);
  }

  async sendAppointmentConfirmation(appointmentData) {
    const {
      customerName,
      customerEmail,
      vehicleInfo,
      appointmentDate,
      appointmentTime,
      serviceType,
      shopInfo
    } = appointmentData;

    const subject = `Appointment Confirmed - ${serviceType} on ${appointmentDate}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">✅ Appointment Confirmed</h2>
        
        <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #065f46;">Appointment Details</h3>
          <p><strong>Date:</strong> ${appointmentDate}</p>
          <p><strong>Time:</strong> ${appointmentTime}</p>
          <p><strong>Service:</strong> ${serviceType}</p>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Vehicle Information</h3>
          <p><strong>Vehicle:</strong> ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}</p>
          ${vehicleInfo.color ? `<p><strong>Color:</strong> ${vehicleInfo.color}</p>` : ''}
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Please arrive 10 minutes early. If you need to reschedule, please contact us at ${shopInfo.phone || 'our shop'}.
        </p>

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;">
            <strong>🔑 Key Drop Box:</strong> Please drop your keys in the key drop box and we'll take it from there!
          </p>
        </div>
      </div>
    `;

    return this.sendEmail(customerEmail, subject, htmlContent);
  }

  async sendVehicleReadyNotification(vehicleData) {
    const {
      customerName,
      customerEmail,
      vehicleInfo,
      servicesCompleted,
      totalCost,
      shopInfo
    } = vehicleData;

    const subject = `🚗 Your Vehicle is Ready! - ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">🚗 Your Vehicle is Ready!</h2>
        
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px;">
            <strong>${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}</strong>
          </p>
          ${vehicleInfo.color ? `<p style="margin: 5px 0 0 0;">Color: ${vehicleInfo.color}</p>` : ''}
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Services Completed</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${servicesCompleted.map(service => `<li>${service}</li>`).join('')}
          </ul>
        </div>

        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Total Cost</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 0;">$${totalCost}</p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Please pick up your vehicle during business hours. If you have any questions, contact us at ${shopInfo.phone || 'our shop'}.
        </p>
      </div>
    `;

    return this.sendEmail(customerEmail, subject, htmlContent);
  }

  async sendPaymentConfirmation(paymentData) {
    const {
      customerName,
      customerEmail,
      amount,
      paymentMethod,
      workOrderId,
      shopInfo
    } = paymentData;

    const subject = `Payment Confirmation - Work Order #${workOrderId}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">✅ Payment Received</h2>
        
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Payment Details</h3>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Work Order:</strong> #${workOrderId}</p>
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Thank you for your payment! Your receipt has been processed. If you have any questions, please contact us.
        </p>
      </div>
    `;

    return this.sendEmail(customerEmail, subject, htmlContent);
  }

  async sendIntakeConfirmation(intakeData) {
    const {
      customerName,
      customerEmail,
      vehicleInfo,
      intakeType,
      shopInfo
    } = intakeData;

    const subject = `Vehicle Intake Confirmed - ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">✅ Vehicle Intake Confirmed</h2>
        
        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px;">
            <strong>${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}</strong>
          </p>
          ${vehicleInfo.color ? `<p style="margin: 5px 0 0 0;">Color: ${vehicleInfo.color}</p>` : ''}
        </div>

        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Intake Type</h3>
          <p><strong>Type:</strong> ${intakeType}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;">
            <strong>🔑 Key Drop Box:</strong> Please drop your keys in the key drop box and we'll take it from there!
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          We'll contact you shortly with an estimate and update on your vehicle's status.
        </p>
      </div>
    `;

    return this.sendEmail(customerEmail, subject, htmlContent);
  }
}

module.exports = EmailService;