/**
 * Reporting Service
 * Generates comprehensive reports for sales, performance, inventory, and more
 */

const { ShopRouter } = require('./firebase-config');
const admin = require('firebase-admin');

class ReportingService {
  async generateSalesReport(shopId, period = 'month', dateRange = null) {
    try {
      const { startDate, endDate } = this.getDateRange(period, dateRange);

      const invoicesSnapshot = await ShopRouter.getShopCollection(shopId, 'invoices')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const invoices = invoicesSnapshot.docs.map(doc => doc.data());

      const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const totalParts = invoices.reduce((sum, inv) => sum + (inv.partsTotal || 0), 0);
      const totalLabor = invoices.reduce((sum, inv) => sum + (inv.laborTotal || 0), 0);

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalInvoices: invoices.length,
          totalRevenue,
          totalParts,
          totalLabor,
          averageInvoice: invoices.length > 0 ? totalRevenue / invoices.length : 0
        }
      };
    } catch (error) {
      console.error('Error generating sales report:', error);
      throw error;
    }
  }

  exportToCSV(reportData, reportType) {
    let csv = '';
    const headers = [];
    const rows = [];

    switch (reportType) {
      case 'sales':
        headers.push('Date', 'Invoice #', 'Customer', 'Total', 'Parts', 'Labor');
        break;
    }

    csv += headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    return csv;
  }

  getDateRange(period, customRange = null) {
    const now = new Date();
    let startDate, endDate = now;

    if (customRange) {
      startDate = new Date(customRange.startDate);
      endDate = new Date(customRange.endDate);
    } else {
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
    }

    return { startDate, endDate };
  }

  /**
   * Generate technician performance report
   * @param {string} shopId - Shop ID
   * @param {string} period - Period
   * @param {object} dateRange - Custom date range
   * @returns {Promise<object>}
   */
  async generateTechnicianPerformanceReport(shopId, period = 'month', dateRange = null) {
    try {
      const { startDate, endDate } = this.getDateRange(period, dateRange);

      const techsSnapshot = await ShopRouter.getShopCollection(shopId, 'technicians').get();
      const technicians = techsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const performanceData = [];

      for (const tech of technicians) {
        const jobsSnapshot = await ShopRouter.getShopCollection(shopId, 'jobs')
          .where('assignedTechnicianId', '==', tech.id)
          .where('completedAt', '>=', startDate)
          .where('completedAt', '<=', endDate)
          .get();

        const completedJobs = jobsSnapshot.docs.map(doc => doc.data());

        const totalHours = completedJobs.reduce((sum, job) => sum + (job.actualHours || 0), 0);
        const totalRevenue = completedJobs.reduce((sum, job) => sum + (job.total || 0), 0);

        performanceData.push({
          technicianId: tech.id,
          name: tech.name,
          jobsCompleted: completedJobs.length,
          totalHours,
          totalRevenue,
          avgHoursPerJob: completedJobs.length > 0 ? totalHours / completedJobs.length : 0,
          avgRevenuePerJob: completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0,
          revenuePerHour: totalHours > 0 ? totalRevenue / totalHours : 0,
          rating: tech.rating || 5.0
        });
      }

      // Sort by total revenue
      performanceData.sort((a, b) => b.totalRevenue - a.totalRevenue);

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalTechnicians: technicians.length,
          totalJobsCompleted: performanceData.reduce((sum, t) => sum + t.jobsCompleted, 0),
          totalRevenue: performanceData.reduce((sum, t) => sum + t.totalRevenue, 0),
          avgRevenuePerTechnician: performanceData.reduce((sum, t) => sum + t.totalRevenue, 0) / performanceData.length
        },
        technicians: performanceData
      };
    } catch (error) {
      console.error('Error generating technician performance report:', error);
      throw error;
    }
  }

  /**
   * Generate parts inventory report
   * @param {string} shopId - Shop ID
   * @returns {Promise<object>}
   */
  async generatePartsInventoryReport(shopId) {
    try {
      const partsSnapshot = await ShopRouter.getShopCollection(shopId, 'partsInventory').get();
      const parts = partsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const totalValue = parts.reduce((sum, part) => sum + ((part.quantity || 0) * (part.cost || 0)), 0);
      const lowStockParts = parts.filter(part => (part.quantity || 0) <= (part.minStock || 0));

      // Group by category
      const byCategory = {};
      parts.forEach(part => {
        const category = part.category || 'Uncategorized';
        if (!byCategory[category]) {
          byCategory[category] = {
            count: 0,
            totalValue: 0
          };
        }
        byCategory[category].count++;
        byCategory[category].totalValue += (part.quantity || 0) * (part.cost || 0);
      });

      return {
        generatedAt: new Date().toISOString(),
        summary: {
          totalParts: parts.length,
          totalValue,
          lowStockCount: lowStockParts.length,
          categories: Object.keys(byCategory).length
        },
        byCategory,
        lowStockParts
      };
    } catch (error) {
      console.error('Error generating parts inventory report:', error);
      throw error;
    }
  }

  /**
   * Generate customer analysis report
   * @param {string} shopId - Shop ID
   * @param {string} period - Period
   * @returns {Promise<object>}
   */
  async generateCustomerAnalysisReport(shopId, period = 'month') {
    try {
      const { startDate, endDate } = this.getDateRange(period);

      const invoicesSnapshot = await ShopRouter.getShopCollection(shopId, 'invoices')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const invoices = invoicesSnapshot.docs.map(doc => doc.data());

      // Group by customer
      const byCustomer = {};
      invoices.forEach(inv => {
        const customerId = inv.customerId;
        if (!byCustomer[customerId]) {
          byCustomer[customerId] = {
            customerId,
            name: inv.customerName || 'Unknown',
            visitCount: 0,
            totalSpent: 0,
            lastVisit: null
          };
        }
        byCustomer[customerId].visitCount++;
        byCustomer[customerId].totalSpent += inv.total || 0;
        
        if (!byCustomer[customerId].lastVisit || inv.createdAt > byCustomer[customerId].lastVisit) {
          byCustomer[customerId].lastVisit = inv.createdAt;
        }
      });

      const customers = Object.values(byCustomer);
      
      // Sort by total spent
      customers.sort((a, b) => b.totalSpent - a.totalSpent);

      // Top customers
      const topCustomers = customers.slice(0, 10);

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalCustomers: customers.length,
          totalVisits: customers.reduce((sum, c) => sum + c.visitCount, 0),
          totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
          avgSpentPerCustomer: customers.length > 0 ? customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length : 0
        },
        topCustomers
      };
    } catch (error) {
      console.error('Error generating customer analysis report:', error);
      throw error;
    }
  }

  /**
   * Generate profit/loss report
   * @param {string} shopId - Shop ID
   * @param {string} period - Period
   * @returns {Promise<object>}
   */
  async generateProfitLossReport(shopId, period = 'month') {
    try {
      const { startDate, endDate } = this.getDateRange(period);

      const invoicesSnapshot = await ShopRouter.getShopCollection(shopId, 'invoices')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const invoices = invoicesSnapshot.docs.map(doc => doc.data());

      const revenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const partsCost = invoices.reduce((sum, inv) => sum + (inv.partsCost || 0), 0);
      const laborCost = invoices.reduce((sum, inv) => sum + (inv.laborCost || 0), 0);

      const grossProfit = revenue - partsCost - laborCost;
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        revenue,
        costs: {
          parts: partsCost,
          labor: laborCost,
          total: partsCost + laborCost
        },
        grossProfit,
        grossMargin: grossMargin.toFixed(2) + '%',
        invoiceCount: invoices.length
      };
    } catch (error) {
      console.error('Error generating profit/loss report:', error);
      throw error;
    }
  }

  /**
   * Generate bay utilization report
   * @param {string} shopId - Shop ID
   * @param {string} period - Period
   * @returns {Promise<object>}
   */
  async generateBayUtilizationReport(shopId, period = 'month') {
    try {
      const { startDate, endDate } = this.getDateRange(period);

      const baysSnapshot = await ShopRouter.getShopCollection(shopId, 'bays').get();
      const bays = baysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const bayStats = [];

      for (const bay of bays) {
        const jobsSnapshot = await ShopRouter.getShopCollection(shopId, 'jobs')
          .where('bayId', '==', bay.id)
          .where('startedAt', '>=', startDate)
          .where('startedAt', '<=', endDate)
          .get();

        const jobs = jobsSnapshot.docs.map(doc => doc.data());

        const totalHours = jobs.reduce((sum, job) => sum + (job.actualHours || 0), 0);
        const utilization = totalHours / (bay.capacity || 8); // Assuming 8-hour day

        bayStats.push({
          bayId: bay.id,
          name: bay.name,
          totalJobs: jobs.length,
          totalHours,
          utilization: (utilization * 100).toFixed(1) + '%'
        });
      }

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        bays: bayStats,
        summary: {
          totalBays: bays.length,
          avgUtilization: (bayStats.reduce((sum, b) => sum + parseFloat(b.utilization), 0) / bayStats.length).toFixed(1) + '%'
        }
      };
    } catch (error) {
      console.error('Error generating bay utilization report:', error);
      throw error;
    }
  }

  /**
   * Generate trend analysis report
   * @param {string} shopId - Shop ID
   * @param {string} period - Period
   * @returns {Promise<object>}
   */
  async generateTrendAnalysisReport(shopId, period = 'month') {
    try {
      const { startDate, endDate } = this.getDateRange(period);
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      const invoicesSnapshot = await ShopRouter.getShopCollection(shopId, 'invoices')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();

      const invoices = invoicesSnapshot.docs.map(doc => doc.data());

      // Group by day
      const byDay = {};
      invoices.forEach(inv => {
        const date = new Date(inv.createdAt).toISOString().split('T')[0];
        if (!byDay[date]) {
          byDay[date] = {
            date,
            revenue: 0,
            invoiceCount: 0
          };
        }
        byDay[date].revenue += inv.total || 0;
        byDay[date].invoiceCount++;
      });

      const dailyData = Object.values(byDay);

      // Calculate trends
      const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const avgDailyRevenue = totalRevenue / daysDiff;

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summary: {
          totalRevenue,
          avgDailyRevenue: avgDailyRevenue.toFixed(2),
          totalInvoices: invoices.length,
          avgDailyInvoices: (invoices.length / daysDiff).toFixed(2)
        },
        dailyData
      };
    } catch (error) {
      console.error('Error generating trend analysis report:', error);
      throw error;
    }
  }

  /**
   * Generate all reports summary
   * @param {string} shopId - Shop ID
   * @param {string} period - Period
   * @returns {Promise<object>}
   */
  async generateAllReportsSummary(shopId, period = 'month') {
    try {
      const [sales, techPerformance, inventory, customerAnalysis, profitLoss, bayUtilization] = await Promise.all([
        this.generateSalesReport(shopId, period),
        this.generateTechnicianPerformanceReport(shopId, period),
        this.generatePartsInventoryReport(shopId),
        this.generateCustomerAnalysisReport(shopId, period),
        this.generateProfitLossReport(shopId, period),
        this.generateBayUtilizationReport(shopId, period)
      ]);

      return {
        period,
        generatedAt: new Date().toISOString(),
        sales,
        technicianPerformance: techPerformance,
        inventory,
        customerAnalysis,
        profitLoss,
        bayUtilization
      };
    } catch (error) {
      console.error('Error generating all reports summary:', error);
      throw error;
    }
  }
}

module.exports = ReportingService;