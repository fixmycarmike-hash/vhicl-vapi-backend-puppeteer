/**
 * Towing Service
 * Manages towing providers, requests, and integration with towing companies
 */

const { ShopRouter } = require('./firebase-config');
const admin = require('firebase-admin');

class TowingService {
  /**
   * Add towing provider
   * @param {string} shopId - Shop ID
   * @param {object} providerData - Provider data
   * @returns {Promise<object>}
   */
  async addProvider(shopId, providerData) {
    try {
      const providerDoc = await ShopRouter.getShopCollection(shopId, 'towingProviders').add({
        ...providerData,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        id: providerDoc.id,
        ...providerData
      };
    } catch (error) {
      console.error('Error adding towing provider:', error);
      throw error;
    }
  }

  /**
   * Get all towing providers
   * @param {string} shopId - Shop ID
   * @returns {Promise<Array>}
   */
  async getProviders(shopId) {
    try {
      const providersSnapshot = await ShopRouter.getShopCollection(shopId, 'towingProviders')
        .where('active', '==', true)
        .orderBy('name')
        .get();

      return providersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting towing providers:', error);
      throw error;
    }
  }

  /**
   * Create towing request
   * @param {string} shopId - Shop ID
   * @param {object} requestData - Request data
   * @returns {Promise<object>}
   */
  async createRequest(shopId, requestData) {
    try {
      const requestDoc = await ShopRouter.getShopCollection(shopId, 'towingRequests').add({
        ...requestData,
        status: 'pending', // pending, assigned, in_progress, completed, cancelled
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Auto-assign provider if specified
      if (requestData.providerId) {
        await this.updateRequestStatus(shopId, requestDoc.id, 'assigned', {
          assignedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return {
        id: requestDoc.id,
        status: 'pending',
        ...requestData
      };
    } catch (error) {
      console.error('Error creating towing request:', error);
      throw error;
    }
  }

  /**
   * Update towing request status
   * @param {string} shopId - Shop ID
   * @param {string} requestId - Request ID
   * @param {string} status - New status
   * @param {object} updateData - Additional update data
   * @returns {Promise<void>}
   */
  async updateRequestStatus(shopId, requestId, status, updateData = {}) {
    try {
      const updates = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...updateData
      };

      // Add timestamp based on status
      if (status === 'assigned') {
        updates.assignedAt = admin.firestore.FieldValue.serverTimestamp();
      } else if (status === 'in_progress') {
        updates.inProgressAt = admin.firestore.FieldValue.serverTimestamp();
      } else if (status === 'completed') {
        updates.completedAt = admin.firestore.FieldValue.serverTimestamp();
      } else if (status === 'cancelled') {
        updates.cancelledAt = admin.firestore.FieldValue.serverTimestamp();
      }

      await ShopRouter.getShopDocument(shopId, 'towingRequests', requestId).update(updates);
    } catch (error) {
      console.error('Error updating towing request status:', error);
      throw error;
    }
  }

  /**
   * Get towing request
   * @param {string} shopId - Shop ID
   * @param {string} requestId - Request ID
   * @returns {Promise<object>}
   */
  async getRequest(shopId, requestId) {
    try {
      const requestDoc = await ShopRouter.getShopDocument(shopId, 'towingRequests', requestId).get();
      
      if (!requestDoc.exists) {
        throw new Error('Towing request not found');
      }

      const requestData = requestDoc.data();

      // Get provider details if assigned
      if (requestData.providerId) {
        const providerDoc = await ShopRouter.getShopDocument(shopId, 'towingProviders', requestData.providerId).get();
        if (providerDoc.exists) {
          requestData.provider = {
            id: providerDoc.id,
            ...providerDoc.data()
          };
        }
      }

      return {
        id: requestDoc.id,
        ...requestData
      };
    } catch (error) {
      console.error('Error getting towing request:', error);
      throw error;
    }
  }

  /**
   * Get all towing requests
   * @param {string} shopId - Shop ID
   * @param {object} filters - Filters (status, dateRange, etc.)
   * @returns {Promise<Array>}
   */
  async getRequests(shopId, filters = {}) {
    try {
      let query = ShopRouter.getShopCollection(shopId, 'towingRequests');

      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      if (filters.startDate) {
        query = query.where('createdAt', '>=', new Date(filters.startDate));
      }

      if (filters.endDate) {
        query = query.where('createdAt', '<=', new Date(filters.endDate));
      }

      query = query.orderBy('createdAt', 'desc');

      const requestsSnapshot = await query.get();

      return requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting towing requests:', error);
      throw error;
    }
  }

  /**
   * Calculate towing cost estimate
   * @param {string} shopId - Shop ID
   * @param {object} jobData - Job data
   * @returns {Promise<object>}
   */
  async calculateCostEstimate(shopId, jobData) {
    try {
      const providers = await this.getProviders(shopId);
      
      // Estimate distance (in a real app, use Google Maps API)
      const estimatedDistance = 10; // Default 10 miles
      
      // Get best price from providers
      let bestPrice = null;
      let bestProvider = null;
      
      for (const provider of providers) {
        const baseFee = provider.baseFee || 75;
        const perMileRate = provider.perMileRate || 4;
        const estimatedCost = baseFee + (estimatedDistance * perMileRate);
        
        if (!bestPrice || estimatedCost < bestPrice) {
          bestPrice = estimatedCost;
          bestProvider = provider;
        }
      }

      return {
        estimatedDistance,
        estimatedCost: bestPrice || (75 + estimatedDistance * 4),
        bestProvider: bestProvider || null,
        providers: providers.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          estimatedCost: (p.baseFee || 75) + (estimatedDistance * (p.perMileRate || 4))
        }))
      };
    } catch (error) {
      console.error('Error calculating cost estimate:', error);
      throw error;
    }
  }

  /**
   * Get towing statistics
   * @param {string} shopId - Shop ID
   * @param {string} period - Period ('day', 'week', 'month', 'year')
   * @returns {Promise<object>}
   */
  async getStatistics(shopId, period = 'month') {
    try {
      const now = new Date();
      let startDate;

      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      const requests = await this.getRequests(shopId, {
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      });

      const stats = {
        total: requests.length,
        byStatus: {
          pending: 0,
          assigned: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0
        },
        totalCost: 0,
        averageCost: 0,
        topProviders: {}
      };

      const providerCounts = {};

      requests.forEach(req => {
        stats.byStatus[req.status] = (stats.byStatus[req.status] || 0) + 1;
        
        if (req.totalCost) {
          stats.totalCost += req.totalCost;
        }

        if (req.providerId) {
          providerCounts[req.providerId] = (providerCounts[req.providerId] || 0) + 1;
        }
      });

      stats.averageCost = requests.length > 0 ? stats.totalCost / requests.length : 0;

      // Sort providers by usage
      stats.topProviders = Object.entries(providerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([providerId, count]) => ({ providerId, count }));

      return stats;
    } catch (error) {
      console.error('Error getting towing statistics:', error);
      throw error;
    }
  }

  /**
   * Cancel towing request
   * @param {string} shopId - Shop ID
   * @param {string} requestId - Request ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<void>}
   */
  async cancelRequest(shopId, requestId, reason = '') {
    try {
      await this.updateRequestStatus(shopId, requestId, 'cancelled', {
        cancellationReason: reason,
        cancelledBy: 'shop'
      });
    } catch (error) {
      console.error('Error cancelling towing request:', error);
      throw error;
    }
  }

  /**
   * Get towing request form HTML
   * @returns {string}
   */
  getRequestFormHTML() {
    return `
<div class="towing-request-form">
  <h3>Request Towing</h3>
  <form id="towingRequestForm">
    <div class="form-group">
      <label>Customer Name</label>
      <input type="text" name="customerName" required>
    </div>
    <div class="form-group">
      <label>Customer Phone</label>
      <input type="tel" name="customerPhone" required>
    </div>
    <div class="form-group">
      <label>Pickup Address</label>
      <input type="text" name="pickupAddress" required>
    </div>
    <div class="form-group">
      <label>Pickup Location Type</label>
      <select name="pickupLocationType">
        <option value="home">Home</option>
        <option value="roadside">Roadside</option>
        <option value="parking_lot">Parking Lot</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="form-group">
      <label>Vehicle Make/Model/Year</label>
      <input type="text" name="vehicleInfo" required>
    </div>
    <div class="form-group">
      <label>License Plate</label>
      <input type="text" name="licensePlate">
    </div>
    <div class="form-group">
      <label>Vehicle Condition</label>
      <select name="vehicleCondition">
        <option value="running">Running</option>
        <option value="not_running">Not Running</option>
        <option value="damaged">Damaged</option>
        <option value="stuck">Stuck</option>
      </select>
    </div>
    <div class="form-group">
      <label>Towing Provider</label>
      <select name="providerId" id="towingProviderSelect">
        <option value="">Auto-select best provider</option>
      </select>
    </div>
    <div class="form-group">
      <label>Priority</label>
      <select name="priority">
        <option value="normal">Normal (1-2 hours)</option>
        <option value="urgent">Urgent (30-60 minutes)</option>
        <option value="emergency">Emergency (ASAP)</option>
      </select>
    </div>
    <div class="form-group">
      <label>Special Instructions</label>
      <textarea name="specialInstructions" rows="3"></textarea>
    </div>
    <div class="form-group">
      <label>Estimated Cost</label>
      <div id="towingCostEstimate">$0.00</div>
    </div>
    <button type="submit" class="btn btn-primary">Request Towing</button>
  </form>
</div>

<style>
  .towing-request-form {
    background: #ffffff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  .form-group {
    margin-bottom: 15px;
  }
  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
    color: #374151;
  }
  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
  }
  #towingCostEstimate {
    font-size: 24px;
    font-weight: bold;
    color: var(--vhicl-primary, #2563eb);
    padding: 10px;
    background: #f9fafb;
    border-radius: 4px;
    text-align: center;
  }
  .btn-primary {
    background-color: var(--vhicl-primary, #2563eb);
    color: #ffffff;
    padding: 12px 24px;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    width: 100%;
  }
  .btn-primary:hover {
    background-color: #1d4ed8;
  }
</style>
    `.trim();
  }
}

module.exports = TowingService;<=', new Date(filters.endDate));
      }

      const requestsSnapshot = await query.orderBy('createdAt', 'desc').get();

      return requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting towing requests:', error);
      throw error;
    }
  }

  /**
   * Request towing from provider API
   * @param {string} shopId - Shop ID
   * @param {string} requestId - Request ID
   * @returns {Promise<object>}
   */
  async requestFromProvider(shopId, requestId) {
    try {
      const request = await this.getRequest(shopId, requestId);

      if (!request.providerId) {
        throw new Error('No provider assigned to this request');
      }

      // Get provider details
      const providerDoc = await ShopRouter.getShopDocument(shopId, 'towingProviders', request.providerId).get();
      const provider = providerDoc.data();

      // Simulate API call to towing provider
      // In production, this would integrate with provider's API
      const apiResponse = await this.callProviderAPI(provider, request);

      // Update request with API response
      await ShopRouter.getShopDocument(shopId, 'towingRequests', requestId).update({
        providerReference: apiResponse.reference,
        estimatedArrival: apiResponse.estimatedArrival,
        driverContact: apiResponse.driverContact,
        status: 'in_progress',
        inProgressAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return apiResponse;
    } catch (error) {
      console.error('Error requesting towing from provider:', error);
      throw error;
    }
  }

  /**
   * Call towing provider API (simulation)
   * @param {object} provider - Provider data
   * @param {object} request - Request data
   * @returns {Promise<object>}
   */
  async callProviderAPI(provider, request) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In production, this would make actual API calls to provider
    // For now, return simulated response
    return {
      reference: `TOW-${Date.now()}`,
      estimatedArrival: new Date(Date.now() + 30 * 60000).toISOString(), // 30 minutes from now
      driverContact: {
        name: 'John Driver',
        phone: provider.phone || '555-0100'
      },
      status: 'confirmed'
    };
  }

  /**
   * Get towing cost estimate
   * @param {string} shopId - Shop ID
   * @param {object} locationData - Pickup and drop-off locations
   * @returns {Promise<Array>}
   */
  async getCostEstimate(shopId, locationData) {
    try {
      const providers = await this.getProviders(shopId);

      // Simulate distance calculation
      const distance = this.calculateDistance(locationData.pickup, locationData.dropoff);

      // Calculate costs for each provider
      const estimates = providers.map(provider => {
        const baseRate = provider.baseRate || 50;
        const perMileRate = provider.perMileRate || 4;
        const cost = baseRate + (distance * perMileRate);

        return {
          providerId: provider.id,
          providerName: provider.name,
          providerPhone: provider.phone,
          estimatedCost: Math.round(cost),
          estimatedTime: Math.round(distance / 30 * 60), // Assume 30 mph average
          distance: Math.round(distance)
        };
      });

      // Sort by cost
      estimates.sort((a, b) => a.estimatedCost - b.estimatedCost);

      return estimates;
    } catch (error) {
      console.error('Error getting towing cost estimate:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two points (simplified)
   * @param {object} pickup - Pickup coordinates {lat, lng}
   * @param {object} dropoff - Drop-off coordinates {lat, lng}
   * @returns {number} - Distance in miles
   */
  calculateDistance(pickup, dropoff) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(dropoff.lat - pickup.lat);
    const dLon = this.toRad(dropoff.lng - pickup.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(pickup.lat)) * Math.cos(this.toRad(dropoff.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Degrees
   * @returns {number} - Radians
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Schedule towing
   * @param {string} shopId - Shop ID
   * @param {string} requestId - Request ID
   * @param {string} scheduledTime - Scheduled pickup time
   * @returns {Promise<void>}
   */
  async scheduleTowing(shopId, requestId, scheduledTime) {
    try {
      await ShopRouter.getShopDocument(shopId, 'towingRequests', requestId).update({
        scheduledTime: new Date(scheduledTime),
        status: 'scheduled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error scheduling towing:', error);
      throw error;
    }
  }

  /**
   * Get towing statistics
   * @param {string} shopId - Shop ID
   * @param {object} dateRange - Date range {startDate, endDate}
   * @returns {Promise<object>}
   */
  async getStatistics(shopId, dateRange) {
    try {
      const requests = await this.getRequests(shopId, dateRange);

      const stats = {
        total: requests.length,
        byStatus: {},
        byProvider: {},
        totalCost: 0,
        averageResponseTime: 0
      };

      requests.forEach(request => {
        // Count by status
        stats.byStatus[request.status] = (stats.byStatus[request.status] || 0) + 1;

        // Count by provider
        if (request.providerId) {
          stats.byProvider[request.providerId] = (stats.byProvider[request.providerId] || 0) + 1;
        }

        // Sum costs
        if (request.cost) {
          stats.totalCost += request.cost;
        }

        // Calculate response time
        if (request.assignedAt && request.createdAt) {
          const responseTime = new Date(request.assignedAt) - new Date(request.createdAt.toDate());
          stats.averageResponseTime += responseTime;
        }
      });

      // Average response time
      if (stats.total > 0) {
        stats.averageResponseTime = Math.round(stats.averageResponseTime / stats.total / 60000); // Convert to minutes
      }

      return stats;
    } catch (error) {
      console.error('Error getting towing statistics:', error);
      throw error;
    }
  }

  /**
   * Cancel towing request
   * @param {string} shopId - Shop ID
   * @param {string} requestId - Request ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<void>}
   */
  async cancelRequest(shopId, requestId, reason) {
    try {
      await this.updateRequestStatus(shopId, requestId, 'cancelled', {
        cancellationReason: reason,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error cancelling towing request:', error);
      throw error;
    }
  }
}

module.exports = TowingService;