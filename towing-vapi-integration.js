/**
 * Towing Service with VAPI/ALEX Integration
 * 
 * ALEX calls towing companies directly with all vehicle details
 * Handles customer intake when tow arrives at shop
 */

const { ShopRouter } = require('./firebase-config');
const admin = require('firebase-admin');

class TowingVAPIService {
  constructor() {
    this.vapiApiKey = process.env.VAPI_API_KEY;
    this.vapiPhoneId = process.env.VAPI_PHONE_ID;
    this.callsInProgress = new Map();
  }

  /**
   * Call towing company with all vehicle details
   * @param {string} shopId - Shop ID
   * @param {object} towRequest - Towing request details
   * @returns {Promise<object>}
   */
  async callTowingCompany(shopId, towRequest) {
    try {
      // Get shop settings
      const settings = await this.getShopSettings(shopId);
      const towingConfig = settings.towing || {};
      
      if (!towingConfig.enabled || !towingConfig.vapi?.useAlexForCalling) {
        throw new Error('Towing or ALEX calling not enabled');
      }

      // Build call script for ALEX
      const callScript = this.buildTowingCallScript(towRequest, towingConfig);

      // Make VAPI call
      const vapiCall = await this.makeVAPICall(
        towingConfig.vapi.phoneNumber || towRequest.providerPhone,
        callScript,
        towingConfig.vapi.assistantId
      );

      // Store call details
      await this.saveCallDetails(shopId, {
        ...vapiCall,
        towRequestId: towRequest.id,
        providerPhone: towingConfig.vapi.phoneNumber || towRequest.providerPhone,
        vehicleDetails: towRequest.vehicle,
        pickupLocation: towRequest.pickupLocation,
        destination: towRequest.destination,
        callType: 'towing_request',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        callId: vapiCall.id,
        status: vapiCall.status,
        message: 'ALEX is calling the towing company with all vehicle details'
      };

    } catch (error) {
      console.error('Error calling towing company:', error);
      throw error;
    }
  }

  /**
   * Build the call script for ALEX to use when calling towing company
   */
  buildTowingCallScript(towRequest, towingConfig) {
    const { vehicle, pickupLocation, destination, customer } = towRequest;
    const config = towingConfig.providerCallInfo || {};

    let script = `You are ALEX, the AI assistant for ${customer.shopName || 'our auto shop'}. You're calling to request a tow truck.\n\n`;
    
    script += `**CUSTOMER INFORMATION:**\n`;
    script += `Customer Name: ${customer.name}\n`;
    script += `Customer Phone: ${customer.phone}\n\n`;

    script += `**VEHICLE DETAILS:**\n`;
    if (config.provideVehicleDetails) {
      script += `Color: ${vehicle.color}\n`;
      script += `Make: ${vehicle.make}\n`;
      script += `Model: ${vehicle.model}\n`;
      script += `Year: ${vehicle.year}\n`;
      script += `License Plate: ${vehicle.licensePlate}\n`;
      script += `VIN: ${vehicle.vin}\n\n`;
    }

    script += `**PICKUP LOCATION:**\n`;
    if (config.providePickupLocation) {
      script += `Address: ${pickupLocation.address}\n`;
      if (pickupLocation.landmark) script += `Landmark: ${pickupLocation.landmark}\n`;
      script += `GPS: ${pickupLocation.lat}, ${pickupLocation.lng}\n\n`;
    }

    script += `**KEY LOCATION:**\n`;
    if (config.provideKeyInfo) {
      script += `${pickupLocation.keyLocation}\n\n`;
    }

    script += `**DESTINATION:**\n`;
    if (config.provideDestination) {
      script += `${destination.address}\n\n`;
    }

    script += `**INSTRUCTIONS:**\n`;
    script += `1. Provide them with all the information above\n`;
    
    if (config.askAboutETA) {
      script += `2. Ask for estimated arrival time (ETA)\n`;
    }
    
    if (config.confirmPricing) {
      script += `3. Get a price quote for the tow\n`;
    }
    
    script += `4. Confirm they can do the tow\n`;
    script += `5. Ask for the driver's name and phone number\n`;
    
    if (customer.willMeetDriver) {
      script += `6. Let them know the customer will meet them at the pickup location\n`;
    } else {
      script += `6. Let them know the customer will NOT be there to meet them\n`;
    }

    script += `\n**IMPORTANT:** Be polite and professional. Speak clearly. Ask for confirmation of all details. Record their ETA, price, and driver info.`;

    return script;
  }

  /**
   * Make a VAPI phone call
   */
  async makeVAPICall(phoneNumber, script, assistantId = null) {
    try {
      const response = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.vapiApiKey}`
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          phoneId: this.vapiPhoneId,
          assistantId: assistantId,
          assistant: {
            firstMessage: script
          }
        })
      });

      if (!response.ok) {
        throw new Error(`VAPI call failed: ${response.statusText}`);
      }

      const callData = await response.json();
      return callData;

    } catch (error) {
      console.error('VAPI call error:', error);
      throw error;
    }
  }

  /**
   * Collect towing request from customer
   * @param {string} shopId - Shop ID
   * @param {object} customerInfo - Customer information from VAPI call
   * @returns {Promise<object>}
   */
  async collectTowingRequestFromCustomer(shopId, customerInfo) {
    try {
      const settings = await this.getShopSettings(shopId);
      const towingConfig = settings.towing || {};
      const intakeConfig = towingConfig.customerIntake || {};

      // Build what to ask customer
      const questions = [];
      
      if (intakeConfig.collectLocation) {
        questions.push('What is the exact pickup location or address where the vehicle needs to be towed from?');
      }
      
      if (intakeConfig.collectVehicleInfo) {
        questions.push('What is the color, make, model, and license plate number of the vehicle?');
      }
      
      if (intakeConfig.collectKeyLocation) {
        questions.push('Where are the keys located for the vehicle?');
      }
      
      if (intakeConfig.askCustomerMeeting) {
        questions.push('Will you be there to meet the tow truck driver?');
      }
      
      if (intakeConfig.confirmDestination) {
        questions.push('Should we tow the vehicle to our shop, or do you need it towed somewhere else?');
      }

      // This would be used by VAPI/ALEX to ask the customer
      return {
        questions: questions,
        instructions: 'Ask these questions in order. Collect all the answers. Confirm each detail.',
        autoIntakeOnArrival: towingConfig.autoIntakeOnArrival
      };

    } catch (error) {
      console.error('Error collecting towing request:', error);
      throw error;
    }
  }

  /**
   * Mark car as arrived at shop (triggered by staff)
   * @param {string} shopId - Shop ID
   * @param {string} towRequestId - Towing request ID
   * @returns {Promise<object>}
   */
  async markCarArrived(shopId, towRequestId) {
    try {
      const settings = await this.getShopSettings(shopId);
      const towingConfig = settings.towing || {};

      // Get towing request details
      const towRequestDoc = await ShopRouter.getShopCollection(shopId, 'towingRequests').doc(towRequestId).get();
      if (!towRequestDoc.exists) {
        throw new Error('Towing request not found');
      }
      const towRequest = towRequestDoc.data();

      // Update towing request status
      await ShopRouter.getShopCollection(shopId, 'towingRequests').doc(towRequestId).update({
        status: 'arrived',
        arrivedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Send SMS to customer if enabled
      if (towingConfig.sendArrivalSMS && towingConfig.twilio?.enabled) {
        await this.sendArrivalSMS(shopId, towRequest, settings);
      }

      // Auto-intake if enabled
      if (towingConfig.autoIntakeOnArrival) {
        await this.autoIntakeOnArrival(shopId, towRequest);
      }

      return {
        success: true,
        message: 'Car marked as arrived. SMS sent and intake started if enabled.'
      };

    } catch (error) {
      console.error('Error marking car arrived:', error);
      throw error;
    }
  }

  /**
   * Send SMS to customer when car arrives
   */
  async sendArrivalSMS(shopId, towRequest, settings) {
    try {
      const towingConfig = settings.towing || {};
      const twilioConfig = towingConfig.twilio || {};
      const shopInfo = settings.shopInfo || {};

      if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.fromNumber) {
        console.error('Twilio not configured');
        return { success: false, message: 'Twilio not configured' };
      }

      const client = require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);

      // Build SMS message with variables
      let message = towingConfig.arrivalSMSTemplate || 'Your vehicle has arrived at the shop!';
      message = message.replace('{{year}}', towRequest.vehicle?.year || '');
      message = message.replace('{{color}}', towRequest.vehicle?.color || '');
      message = message.replace('{{make}}', towRequest.vehicle?.make || '');
      message = message.replace('{{model}}', towRequest.vehicle?.model || '');
      message = message.replace('{{plate}}', towRequest.vehicle?.licensePlate || '');
      message = message.replace('{{shopName}}', shopInfo.shopName || 'our shop');
      message = message.replace('{{shopPhone}}', shopInfo.shopPhone || '');

      // Send SMS
      const sms = await client.messages.create({
        body: message,
        from: twilioConfig.fromNumber,
        to: towRequest.customer.phone
      });

      console.log('SMS sent:', sms.sid);

      // Log SMS in Firebase
      await ShopRouter.getShopCollection(shopId, 'towingSMS').add({
        towRequestId: towRequest.id,
        customerPhone: towRequest.customer.phone,
        message: message,
        sid: sms.sid,
        status: sms.status,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, message: 'SMS sent successfully' };

    } catch (error) {
      console.error('Error sending SMS:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Auto-intake customer when tow arrives at shop
   * @param {string} shopId - Shop ID
   * @param {object} towRequest - Towing request details
   * @returns {Promise<object>}
   */
  async autoIntakeOnArrival(shopId, towRequest) {
    try {
      const settings = await this.getShopSettings(shopId);
      const towingConfig = settings.towing || {};

      if (!towingConfig.autoIntakeOnArrival) {
        return { success: false, message: 'Auto-intake not enabled' };
      }

      // Create car intake record
      const intakeData = {
        customerId: towRequest.customerId,
        customerName: towRequest.customer.name,
        customerPhone: towRequest.customer.phone,
        vehicle: towRequest.vehicle,
        towRequestId: towRequest.id,
        arrivalMethod: 'towing',
        arrivedAt: admin.firestore.FieldValue.serverTimestamp(),
        notes: `Vehicle arrived via tow. Towing company: ${towRequest.providerName || 'Unknown'}`,
        status: 'pending',
        source: 'auto_intake'
      };

      // Save to Firebase
      const intakeDoc = await ShopRouter.getShopCollection(shopId, 'carIntake').add(intakeData);

      // Trigger ALEX to start intake call with customer
      if (settings.vapi?.enabled) {
        await this.startIntakeCall(shopId, intakeDoc.id, towRequest);
      }

      return {
        success: true,
        intakeId: intakeDoc.id,
        message: 'Customer auto-intake started'
      };

    } catch (error) {
      console.error('Error in auto-intake:', error);
      throw error;
    }
  }

  /**
   * Start intake call with customer
   */
  async startIntakeCall(shopId, intakeId, towRequest) {
    try {
      const settings = await this.getShopSettings(shopId);
      
      const intakeScript = `You are ALEX, the AI assistant for the shop. You're calling to intake ${towRequest.customer.name} whose vehicle just arrived at the shop via tow.\n\n`;
      intakeScript += `Vehicle: ${towRequest.vehicle.year} ${towRequest.vehicle.color} ${towRequest.vehicle.make} ${towRequest.vehicle.model}\n`;
      intakeScript += `License Plate: ${towRequest.vehicle.licensePlate}\n\n`;
      intakeScript += `Ask the customer:\n`;
      intakeScript += `1. What seems to be the problem with the vehicle?\n`;
      intakeScript += `2. When did the issue start?\n`;
      intakeScript += `3. Has any work been done on this issue before?\n`;
      intakeScript += `4. Are there any specific concerns or symptoms?\n`;
      intakeScript += `5. When do you need the vehicle back?\n\n`;
      intakeScript += `Record all their answers and create a work order.`;

      // Make VAPI call to customer
      await this.makeVAPICall(
        towRequest.customer.phone,
        intakeScript,
        settings.vapi.assistantId
      );

    } catch (error) {
      console.error('Error starting intake call:', error);
      throw error;
    }
  }

  /**
   * Get shop settings
   */
  async getShopSettings(shopId) {
    try {
      const settingsDoc = await ShopRouter.getShopCollection(shopId, 'settings').doc('main').get();
      if (settingsDoc.exists) {
        return settingsDoc.data();
      }
      return {};
    } catch (error) {
      console.error('Error getting shop settings:', error);
      return {};
    }
  }

  /**
   * Save call details
   */
  async saveCallDetails(shopId, callData) {
    try {
      await ShopRouter.getShopCollection(shopId, 'towingCalls').add(callData);
    } catch (error) {
      console.error('Error saving call details:', error);
    }
  }
}

module.exports = new TowingVAPIService();
