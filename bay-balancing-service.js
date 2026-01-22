/**
 * Bay Balancing Service
 * Manages service bays, job assignments, scheduling, and efficiency tracking
 */

const { ShopRouter } = require('./firebase-config');
const admin = require('firebase-admin');

class BayBalancingService {
  /**
   * Add service bay
   * @param {string} shopId - Shop ID
   * @param {object} bayData - Bay data
   * @returns {Promise<object>}
   */
  async addBay(shopId, bayData) {
    try {
      const bayDoc = await ShopRouter.getShopCollection(shopId, 'bays').add({
        ...bayData,
        active: true,
        currentJobId: null,
        status: 'available', // available, occupied, maintenance
        utilization: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        id: bayDoc.id,
        ...bayData
      };
    } catch (error) {
      console.error('Error adding bay:', error);
      throw error;
    }
  }

  /**
   * Get all service bays
   * @param {string} shopId - Shop ID
   * @returns {Promise<Array>}
   */
  async getBays(shopId) {
    try {
      const baysSnapshot = await ShopRouter.getShopCollection(shopId, 'bays')
        .where('active', '==', true)
        .orderBy('name')
        .get();

      const bays = baysSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get current job for each bay
      for (const bay of bays) {
        if (bay.currentJobId) {
          const jobDoc = await ShopRouter.getShopDocument(shopId, 'jobs', bay.currentJobId).get();
          if (jobDoc.exists) {
            bay.currentJob = {
              id: jobDoc.id,
              ...jobDoc.data()
            };
          }
        }
      }

      return bays;
    } catch (error) {
      console.error('Error getting bays:', error);
      throw error;
    }
  }

  /**
   * Assign job to bay
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {string} bayId - Bay ID
   * @returns {Promise<void>}
   */
  async assignJobToBay(shopId, jobId, bayId) {
    try {
      // Check if bay is available
      const bayDoc = await ShopRouter.getShopDocument(shopId, 'bays', bayId).get();
      
      if (!bayDoc.exists) {
        throw new Error('Bay not found');
      }

      const bayData = bayDoc.data();
      
      if (bayData.status !== 'available') {
        throw new Error('Bay is not available');
      }

      // Update bay
      await ShopRouter.getShopDocument(shopId, 'bays', bayId).update({
        currentJobId: jobId,
        status: 'occupied',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update job
      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update({
        bayId: bayId,
        assignedToBayAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error assigning job to bay:', error);
      throw error;
    }
  }

  /**
   * Release bay (job completed)
   * @param {string} shopId - Shop ID
   * @param {string} bayId - Bay ID
   * @returns {Promise<void>}
   */
  async releaseBay(shopId, bayId) {
    try {
      await ShopRouter.getShopDocument(shopId, 'bays', bayId).update({
        currentJobId: null,
        status: 'available',
        releasedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error releasing bay:', error);
      throw error;
    }
  }

  /**
   * Get bay status
   * @param {string} shopId - Shop ID
   * @param {string} bayId - Bay ID
   * @returns {Promise<object>}
   */
  async getBayStatus(shopId, bayId) {
    try {
      const bayDoc = await ShopRouter.getShopDocument(shopId, 'bays', bayId).get();
      
      if (!bayDoc.exists) {
        throw new Error('Bay not found');
      }

      const bayData = bayDoc.data();
      
      let currentJob = null;
      
      if (bayData.currentJobId) {
        const jobDoc = await ShopRouter.getShopDocument(shopId, 'jobs', bayData.currentJobId).get();
        if (jobDoc.exists) {
          currentJob = {
            id: jobDoc.id,
            ...jobDoc.data()
          };
        }
      }

      return {
        id: bayDoc.id,
        ...bayData,
        currentJob
      };
    } catch (error) {
      console.error('Error getting bay status:', error);
      throw error;
    }
  }

  /**
   * Get all bay statuses
   * @param {string} shopId - Shop ID
   * @returns {Promise<Array>}
   */
  async getAllBayStatuses(shopId) {
    try {
      const bays = await this.getBays(shopId);
      
      const statuses = bays.map(bay => ({
        id: bay.id,
        name: bay.name,
        status: bay.status,
        currentJob: bay.currentJob || null,
        capacity: bay.capacity || 8,
        utilization: bay.utilization || 0
      }));

      return statuses;
    } catch (error) {
      console.error('Error getting all bay statuses:', error);
      throw error;
    }
  }

  /**
   * Find available bay
   * @param {string} shopId - Shop ID
   * @param {string} jobType - Job type (optional)
   * @returns {Promise<object|null>}
   */
  async findAvailableBay(shopId, jobType = null) {
    try {
      const baysSnapshot = await ShopRouter.getShopCollection(shopId, 'bays')
        .where('active', '==', true)
        .where('status', '==', 'available')
        .get();

      const bays = baysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (bays.length === 0) {
        return null;
      }

      // If job type specified, try to find matching bay
      if (jobType) {
        const matchingBay = bays.find(bay => 
          bay.specialization && bay.specialization.toLowerCase() === jobType.toLowerCase()
        );
        
        if (matchingBay) {
          return matchingBay;
        }
      }

      // Return first available bay
      return bays[0];
    } catch (error) {
      console.error('Error finding available bay:', error);
      throw error;
    }
  }

  /**
   * Schedule bay for job
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {string} bayId - Bay ID
   * @param {Date} scheduledTime - Scheduled time
   * @returns {Promise<void>}
   */
  async scheduleBay(shopId, jobId, bayId, scheduledTime) {
    try {
      const scheduleDoc = await ShopRouter.getShopCollection(shopId, 'baySchedule').add({
        jobId,
        bayId,
        scheduledTime: admin.firestore.Timestamp.fromDate(scheduledTime),
        status: 'scheduled',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update job with scheduled bay
      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update({
        scheduledBayId: bayId,
        scheduledAt: admin.firestore.Timestamp.fromDate(scheduledTime),
        scheduleId: scheduleDoc.id
      });
    } catch (error) {
      console.error('Error scheduling bay:', error);
      throw error;
    }
  }

  /**
   * Check for bay conflicts
   * @param {string} shopId - Shop ID
   * @param {string} bayId - Bay ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Promise<Array>}
   */
  async checkBayConflicts(shopId, bayId, startTime, endTime) {
    try {
      const scheduleSnapshot = await ShopRouter.getShopCollection(shopId, 'baySchedule')
        .where('bayId', '==', bayId)
        .where('status', '==', 'scheduled')
        .get();

      const schedules = scheduleSnapshot.docs.map(doc => doc.data());
      
      const conflicts = [];

      schedules.forEach(schedule => {
        const scheduledTime = schedule.scheduledTime.toDate();
        
        // Check for overlap
        if (scheduledTime >= startTime && scheduledTime < endTime) {
          conflicts.push(schedule);
        }
      });

      return conflicts;
    } catch (error) {
      console.error('Error checking bay conflicts:', error);
      throw error;
    }
  }

  /**
   * Calculate bay efficiency
   * @param {string} shopId - Shop ID
   * @param {string} bayId - Bay ID
   * @param {string} period - Period
   * @returns {Promise<object>}
   */
  async calculateBayEfficiency(shopId, bayId, period = 'month') {
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

      const jobsSnapshot = await ShopRouter.getShopCollection(shopId, 'jobs')
        .where('bayId', '==', bayId)
        .where('completedAt', '>=', startDate)
        .get();

      const jobs = jobsSnapshot.docs.map(doc => doc.data());

      const totalJobs = jobs.length;
      const totalHours = jobs.reduce((sum, job) => sum + (job.actualHours || 0), 0);
      const totalEstimatedHours = jobs.reduce((sum, job) => sum + (job.estimatedHours || 0), 0);
      
      const efficiency = totalEstimatedHours > 0 
        ? (totalEstimatedHours / totalHours) * 100 
        : 100;

      return {
        bayId,
        period,
        totalJobs,
        totalHours,
        totalEstimatedHours,
        efficiency: efficiency.toFixed(1) + '%',
        avgHoursPerJob: totalJobs > 0 ? (totalHours / totalJobs).toFixed(2) : 0
      };
    } catch (error) {
      console.error('Error calculating bay efficiency:', error);
      throw error;
    }
  }

  /**
   * Get bay balancing recommendations
   * @param {string} shopId - Shop ID
   * @returns {Promise<object>}
   */
  async getBalancingRecommendations(shopId) {
    try {
      const bays = await this.getBays(shopId);
      
      const recommendations = [];

      // Check for overloaded bays
      const overloadedBays = bays.filter(bay => 
        bay.status === 'occupied' && bay.utilization > 80
      );

      if (overloadedBays.length > 0) {
        recommendations.push({
          type: 'overload',
          message: `${overloadedBays.length} bay(s) are overloaded`,
          bays: overloadedBays.map(b => b.id),
          suggestion: 'Consider redistributing jobs or adding capacity'
        });
      }

      // Check for underutilized bays
      const underutilizedBays = bays.filter(bay => 
        bay.status === 'available' && bay.utilization < 50
      );

      if (underutilizedBays.length > 0) {
        recommendations.push({
          type: 'underutilization',
          message: `${underutilizedBays.length} bay(s) are underutilized`,
          bays: underutilizedBays.map(b => b.id),
          suggestion: 'Consider consolidating work or accepting more jobs'
        });
      }

      // Check for conflicts
      for (const bay of bays) {
        const conflicts = await this.checkBayConflicts(shopId, bay.id, new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000));
        
        if (conflicts.length > 0) {
          recommendations.push({
            type: 'conflict',
            message: `Bay "${bay.name}" has ${conflicts.length} conflict(s) in the next 24 hours`,
            bayId: bay.id,
            conflicts,
            suggestion: 'Reschedule conflicting jobs to different times or bays'
          });
        }
      }

      return {
        recommendations,
        summary: {
          totalBays: bays.length,
          overloadedCount: overloadedBays.length,
          underutilizedCount: underutilizedBays.length,
          conflictCount: recommendations.filter(r => r.type === 'conflict').length
        }
      };
    } catch (error) {
      console.error('Error getting balancing recommendations:', error);
      throw error;
    }
  }

  /**
   * Get real-time bay board data
   * @param {string} shopId - Shop ID
   * @returns {Promise<object>}
   */
  async getRealTimeBayBoard(shopId) {
    try {
      const bays = await this.getAllBayStatuses(shopId);
      
      const board = {
        timestamp: new Date().toISOString(),
        summary: {
          total: bays.length,
          available: bays.filter(b => b.status === 'available').length,
          occupied: bays.filter(b => b.status === 'occupied').length,
          maintenance: bays.filter(b => b.status === 'maintenance').length
        },
        bays
      };

      return board;
    } catch (error) {
      console.error('Error getting real-time bay board:', error);
      throw error;
    }
  }

  /**
   * Get bay balancing HTML
   * @returns {string}
   */
  getBayBalancingHTML() {
    return `
<div class="bay-balancing-dashboard">
  <div class="dashboard-header">
    <h2>Service Bay Management</h2>
    <div class="bay-summary">
      <span class="stat available"><span id="availableBays">0</span> Available</span>
      <span class="stat occupied"><span id="occupiedBays">0</span> Occupied</span>
      <span class="stat maintenance"><span id="maintenanceBays">0</span> Maintenance</span>
    </div>
  </div>

  <div class="bay-board" id="bayBoard">
    <p>Loading bay board...</p>
  </div>

  <div class="bay-actions">
    <button class="btn btn-primary" onclick="assignJobToBay()">Assign Job to Bay</button>
    <button class="btn btn-secondary" onclick="releaseBay()">Release Bay</button>
    <button class="btn btn-secondary" onclick="scheduleBay()">Schedule Bay</button>
    <button class="btn btn-secondary" onclick="viewEfficiency()">View Efficiency</button>
    <button class="btn btn-warning" onclick="getRecommendations()">Get Recommendations</button>
  </div>

  <div class="bay-recommendations" id="bayRecommendations" style="display: none;">
    <h3>Recommendations</h3>
    <div id="recommendationsList"></div>
  </div>
</div>

<style>
  .bay-balancing-dashboard {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
  }
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e5e7eb;
  }
  .dashboard-header h2 {
    margin: 0;
    color: var(--vhicl-primary, #2563eb);
  }
  .bay-summary {
    display: flex;
    gap: 20px;
  }
  .bay-summary .stat {
    padding: 10px 20px;
    border-radius: 20px;
    font-weight: bold;
    font-size: 14px;
  }
  .bay-summary .stat span {
    font-size: 20px;
    margin-right: 5px;
  }
  .bay-summary .stat.available {
    background: #d1fae5;
    color: #065f46;
  }
  .bay-summary .stat.occupied {
    background: #dbeafe;
    color: #1e40af;
  }
  .bay-summary .stat.maintenance {
    background: #fee2e2;
    color: #991b1b;
  }
  .bay-board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }
  .bay-card {
    background: #ffffff;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .bay-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
  .bay-card.available {
    border-color: #22c55e;
    background: #f0fdf4;
  }
  .bay-card.occupied {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  .bay-card.maintenance {
    border-color: #ef4444;
    background: #fef2f2;
  }
  .bay-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  .bay-card-header h3 {
    margin: 0;
    font-size: 18px;
  }
  .bay-status {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
  }
  .bay-status.available {
    background: #22c55e;
    color: #ffffff;
  }
  .bay-status.occupied {
    background: #3b82f6;
    color: #ffffff;
  }
  .bay-status.maintenance {
    background: #ef4444;
    color: #ffffff;
  }
  .bay-info {
    margin: 10px 0;
    font-size: 14px;
    color: #6b7280;
  }
  .current-job {
    background: #ffffff;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
  }
  .current-job h4 {
    margin: 0 0 5px 0;
    font-size: 14px;
  }
  .current-job p {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
  }
  .bay-actions {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-primary {
    background: var(--vhicl-primary, #2563eb);
    color: #ffffff;
  }
  .btn-primary:hover {
    background: #1d4ed8;
  }
  .btn-secondary {
    background: #6b7280;
    color: #ffffff;
  }
  .btn-secondary:hover {
    background: #4b5563;
  }
  .btn-warning {
    background: #f59e0b;
    color: #ffffff;
  }
  .btn-warning:hover {
    background: #d97706;
  }
  .bay-recommendations {
    background: #fef3c7;
    padding: 20px;
    border-radius: 8px;
    border: 2px solid #f59e0b;
  }
  .recommendation-item {
    padding: 10px;
    background: #ffffff;
    margin-bottom: 10px;
    border-radius: 4px;
  }
  .recommendation-item h4 {
    margin: 0 0 5px 0;
    color: #92400e;
  }
  .recommendation-item p {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
  }
</style>
    `.trim();
  }
}

module.exports = BayBalancingService;