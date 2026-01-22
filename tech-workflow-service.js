/**
 * Technician Workflow Service
 * Manages technician assignments, job tracking, time tracking, and performance
 */

const { ShopRouter } = require('./firebase-config');
const admin = require('firebase-admin');

class TechWorkflowService {
  /**
   * Add technician
   * @param {string} shopId - Shop ID
   * @param {object} techData - Technician data
   * @returns {Promise<object>}
   */
  async addTechnician(shopId, techData) {
    try {
      const techDoc = await ShopRouter.getShopCollection(shopId, 'technicians').add({
        ...techData,
        active: true,
        jobsCompleted: 0,
        totalHours: 0,
        rating: 5.0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        id: techDoc.id,
        ...techData
      };
    } catch (error) {
      console.error('Error adding technician:', error);
      throw error;
    }
  }

  /**
   * Get all technicians
   * @param {string} shopId - Shop ID
   * @returns {Promise<Array>}
   */
  async getTechnicians(shopId) {
    try {
      const techsSnapshot = await ShopRouter.getShopCollection(shopId, 'technicians')
        .where('active', '==', true)
        .orderBy('name')
        .get();

      return techsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting technicians:', error);
      throw error;
    }
  }

  /**
   * Assign job to technician
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {string} technicianId - Technician ID
   * @returns {Promise<void>}
   */
  async assignJob(shopId, jobId, technicianId) {
    try {
      const updates = {
        assignedTechnicianId: technicianId,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'assigned'
      };

      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update(updates);
    } catch (error) {
      console.error('Error assigning job:', error);
      throw error;
    }
  }

  /**
   * Start job (technician begins work)
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {string} technicianId - Technician ID
   * @returns {Promise<void>}
   */
  async startJob(shopId, jobId, technicianId) {
    try {
      const updates = {
        status: 'in_progress',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        startedBy: technicianId
      };

      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update(updates);
    } catch (error) {
      console.error('Error starting job:', error);
      throw error;
    }
  }

  /**
   * Complete job
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {object} completionData - Completion data
   * @returns {Promise<void>}
   */
  async completeJob(shopId, jobId, completionData) {
    try {
      const jobDoc = await ShopRouter.getShopDocument(shopId, 'jobs', jobId).get();
      
      if (!jobDoc.exists) {
        throw new Error('Job not found');
      }

      const jobData = jobDoc.data();
      
      // Calculate time spent
      const timeSpent = completionData.actualHours || 0;
      
      const updates = {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedBy: completionData.technicianId || jobData.assignedTechnicianId,
        actualHours: timeSpent,
        notes: completionData.notes || '',
        partsUsed: completionData.partsUsed || [],
        photos: completionData.photos || []
      };

      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update(updates);

      // Update technician stats
      if (jobData.assignedTechnicianId) {
        await this.updateTechnicianStats(shopId, jobData.assignedTechnicianId, {
          jobsCompleted: admin.firestore.FieldValue.increment(1),
          totalHours: admin.firestore.FieldValue.increment(timeSpent)
        });
      }

      // Update bay status if assigned to bay
      if (jobData.bayId) {
        await ShopRouter.getShopDocument(shopId, 'bays', jobData.bayId).update({
          currentJobId: null,
          status: 'available'
        });
      }
    } catch (error) {
      console.error('Error completing job:', error);
      throw error;
    }
  }

  /**
   * Update job status
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {string} status - New status
   * @param {object} updateData - Additional data
   * @returns {Promise<void>}
   */
  async updateJobStatus(shopId, jobId, status, updateData = {}) {
    try {
      const updates = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...updateData
      };

      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update(updates);
    } catch (error) {
      console.error('Error updating job status:', error);
      throw error;
    }
  }

  /**
   * Get technician jobs
   * @param {string} shopId - Shop ID
   * @param {string} technicianId - Technician ID
   * @param {string} status - Status filter
   * @returns {Promise<Array>}
   */
  async getTechnicianJobs(shopId, technicianId, status = null) {
    try {
      let query = ShopRouter.getShopCollection(shopId, 'jobs')
        .where('assignedTechnicianId', '==', technicianId);

      if (status) {
        query = query.where('status', '==', status);
      }

      query = query.orderBy('assignedAt', 'desc');

      const jobsSnapshot = await query.get();

      return jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting technician jobs:', error);
      throw error;
    }
  }

  /**
   * Create job checklist
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {Array} checkItems - Checklist items
   * @returns {Promise<void>}
   */
  async createChecklist(shopId, jobId, checkItems) {
    try {
      const checklist = checkItems.map((item, index) => ({
        id: `item_${index}`,
        text: item.text || item,
        completed: false,
        completedBy: null,
        completedAt: null,
        notes: ''
      }));

      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update({
        checklist
      });
    } catch (error) {
      console.error('Error creating checklist:', error);
      throw error;
    }
  }

  /**
   * Update checklist item
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {string} itemId - Item ID
   * @param {boolean} completed - Completed status
   * @param {string} technicianId - Technician ID
   * @returns {Promise<void>}
   */
  async updateChecklistItem(shopId, jobId, itemId, completed, technicianId) {
    try {
      const jobDoc = await ShopRouter.getShopDocument(shopId, 'jobs', jobId).get();
      
      if (!jobDoc.exists) {
        throw new Error('Job not found');
      }

      const jobData = jobDoc.data();
      const checklist = jobData.checklist || [];

      const itemIndex = checklist.findIndex(item => item.id === itemId);
      
      if (itemIndex === -1) {
        throw new Error('Checklist item not found');
      }

      checklist[itemIndex].completed = completed;
      checklist[itemIndex].completedBy = completed ? technicianId : null;
      checklist[itemIndex].completedAt = completed ? admin.firestore.FieldValue.serverTimestamp() : null;

      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update({
        checklist
      });
    } catch (error) {
      console.error('Error updating checklist item:', error);
      throw error;
    }
  }

  /**
   * Request parts for job
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {Array} parts - Parts requested
   * @returns {Promise<void>}
   */
  async requestParts(shopId, jobId, parts) {
    try {
      const partsRequest = await ShopRouter.getShopCollection(shopId, 'partsRequests').add({
        jobId,
        parts,
        status: 'pending',
        requestedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update job with parts request reference
      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update({
        partsRequestId: partsRequest.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error requesting parts:', error);
      throw error;
    }
  }

  /**
   * Add technician note to job
   * @param {string} shopId - Shop ID
   * @param {string} jobId - Job ID
   * @param {string} note - Note text
   * @param {string} technicianId - Technician ID
   * @returns {Promise<void>}
   */
  async addTechnicianNote(shopId, jobId, note, technicianId) {
    try {
      const techNote = {
        text: note,
        technicianId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await ShopRouter.getShopDocument(shopId, 'jobs', jobId).update({
        technicianNotes: admin.firestore.FieldValue.arrayUnion(techNote)
      });
    } catch (error) {
      console.error('Error adding technician note:', error);
      throw error;
    }
  }

  /**
   * Get technician performance
   * @param {string} shopId - Shop ID
   * @param {string} technicianId - Technician ID
   * @returns {Promise<object>}
   */
  async getTechnicianPerformance(shopId, technicianId) {
    try {
      const techDoc = await ShopRouter.getShopDocument(shopId, 'technicians', technicianId).get();
      
      if (!techDoc.exists) {
        throw new Error('Technician not found');
      }

      const techData = techDoc.data();

      // Get recent jobs
      const recentJobs = await this.getTechnicianJobs(shopId, technicianId);

      // Calculate performance metrics
      const completedJobs = recentJobs.filter(job => job.status === 'completed');
      const inProgressJobs = recentJobs.filter(job => job.status === 'in_progress');

      const avgTimePerJob = completedJobs.length > 0 
        ? completedJobs.reduce((sum, job) => sum + (job.actualHours || 0), 0) / completedJobs.length
        : 0;

      // Get jobs from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentCompletedJobs = completedJobs.filter(job => 
        job.completedAt && job.completedAt.toDate() >= thirtyDaysAgo
      );

      return {
        technicianId,
        name: techData.name,
        jobsCompleted: techData.jobsCompleted || 0,
        totalHours: techData.totalHours || 0,
        rating: techData.rating || 5.0,
        avgTimePerJob,
        activeJobs: inProgressJobs.length,
        recentJobsCompleted: recentCompletedJobs.length,
        efficiency: avgTimePerJob > 0 ? (completedJobs.length / techData.totalHours) * 100 : 0
      };
    } catch (error) {
      console.error('Error getting technician performance:', error);
      throw error;
    }
  }

  /**
   * Get technician dashboard data
   * @param {string} shopId - Shop ID
   * @param {string} technicianId - Technician ID
   * @returns {Promise<object>}
   */
  async getDashboardData(shopId, technicianId) {
    try {
      const performance = await this.getTechnicianPerformance(shopId, technicianId);
      const activeJobs = await this.getTechnicianJobs(shopId, technicianId, 'in_progress');
      const recentJobs = await this.getTechnicianJobs(shopId, technicianId, 'completed');

      return {
        performance,
        activeJobs: activeJobs.slice(0, 5), // Last 5 active jobs
        recentJobs: recentJobs.slice(0, 10) // Last 10 completed jobs
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Update technician stats
   * @param {string} shopId - Shop ID
   * @param {string} technicianId - Technician ID
   * @param {object} updates - Stat updates
   * @returns {Promise<void>}
   */
  async updateTechnicianStats(shopId, technicianId, updates) {
    try {
      await ShopRouter.getShopDocument(shopId, 'technicians', technicianId).update(updates);
    } catch (error) {
      console.error('Error updating technician stats:', error);
      throw error;
    }
  }

  /**
   * Get technician dashboard HTML
   * @returns {string}
   */
  getDashboardHTML() {
    return `
<div class="tech-dashboard">
  <div class="dashboard-header">
    <h2>Technician Dashboard</h2>
    <div class="tech-info">
      <span class="tech-name">Loading...</span>
      <span class="tech-status">Online</span>
    </div>
  </div>

  <div class="dashboard-stats">
    <div class="stat-card">
      <div class="stat-value" id="activeJobsCount">0</div>
      <div class="stat-label">Active Jobs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="completedTodayCount">0</div>
      <div class="stat-label">Completed Today</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="totalHoursCount">0</div>
      <div class="stat-label">Total Hours</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="ratingCount">0.0</div>
      <div class="stat-label">Rating</div>
    </div>
  </div>

  <div class="dashboard-section">
    <h3>Active Jobs</h3>
    <div id="activeJobsList" class="jobs-list">
      <p>Loading active jobs...</p>
    </div>
  </div>

  <div class="dashboard-section">
    <h3>Recent Jobs</h3>
    <div id="recentJobsList" class="jobs-list">
      <p>Loading recent jobs...</p>
    </div>
  </div>

  <div class="dashboard-section">
    <h3>Quick Actions</h3>
    <div class="quick-actions">
      <button class="btn btn-primary" onclick="startNextJob()">Start Next Job</button>
      <button class="btn btn-secondary" onclick="viewSchedule()">View Schedule</button>
      <button class="btn btn-secondary" onclick="requestParts()">Request Parts</button>
      <button class="btn btn-secondary" onclick="addNote()">Add Note</button>
    </div>
  </div>
</div>

<style>
  .tech-dashboard {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e5e7eb;
  }
  .dashboard-header h2 {
    margin: 0;
    color: var(--vhicl-primary, #2563eb);
  }
  .tech-info {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  .tech-name {
    font-weight: bold;
    font-size: 18px;
  }
  .tech-status {
    background: #22c55e;
    color: #ffffff;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
  }
  .dashboard-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }
  .stat-card {
    background: #ffffff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
  }
  .stat-value {
    font-size: 36px;
    font-weight: bold;
    color: var(--vhicl-primary, #2563eb);
    margin-bottom: 5px;
  }
  .stat-label {
    color: #6b7280;
    font-size: 14px;
  }
  .dashboard-section {
    background: #ffffff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin-bottom: 20px;
  }
  .dashboard-section h3 {
    margin: 0 0 15px 0;
    color: var(--vhicl-primary, #2563eb);
  }
  .jobs-list {
    max-height: 400px;
    overflow-y: auto;
  }
  .job-item {
    padding: 15px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .job-item:hover {
    background: #f9fafb;
  }
  .job-item h4 {
    margin: 0 0 5px 0;
    color: #374151;
  }
  .job-item p {
    margin: 5px 0;
    color: #6b7280;
    font-size: 14px;
  }
  .job-status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
  }
  .job-status.in_progress {
    background: #dbeafe;
    color: #1e40af;
  }
  .job-status.completed {
    background: #d1fae5;
    color: #065f46;
  }
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
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
</style>
    `.trim();
  }
}

module.exports = TechWorkflowService;