// Vehicle Drop-off Service
// Handles customer vehicle drop-offs via phone calls with ALEX

class VehicleDropoffService {
    constructor() {
        this.dropoffs = JSON.parse(localStorage.getItem('vhicl_dropoffs') || '[]');
        this.dropoffQueue = JSON.parse(localStorage.getItem('vhicl_dropoff_queue') || '[]');
    }

    /**
     * Process a vehicle drop-off from ALEX phone call
     * Creates vehicle record and adds to drop-off queue
     */
    processDropoff(dropoffData) {
        const {
            customerName,
            customerPhone,
            customerEmail,
            vehicleYear,
            vehicleMake,
            vehicleModel,
            vehiclePlate,
            serviceRequested,
            issues,
            isReturningCustomer,
            appointmentTime,
            needsRide,
            shopName,
            dropBoxLocation,
            timestamp = new Date().toISOString()
        } = dropoffData;

        // Validate required fields
        if (!customerName || !customerPhone || !vehicleYear || !vehicleMake || !vehicleModel) {
            throw new Error('Missing required fields: customer name, phone, and vehicle info are required');
        }

        // Create drop-off record
        const dropoff = {
            id: this.generateDropoffId(),
            timestamp,
            status: 'pending_review', // pending_review, in_review, diagnosed, approved, in_progress, ready
            priority: this.determinePriority(issues, appointmentTime),
            
            // Customer Information
            customer: {
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
                isReturningCustomer: isReturningCustomer || false
            },
            
            // Vehicle Information
            vehicle: {
                year: parseInt(vehicleYear),
                make: vehicleMake,
                model: vehicleModel,
                plate: vehiclePlate || '',
                vin: '' // Will be filled when tech inspects
            },
            
            // Service Information
            service: {
                requested: serviceRequested,
                issues: issues,
                appointmentTime: appointmentTime || null,
                needsRide: needsRide || false
            },
            
            // Drop-off Details
            dropoff: {
                method: 'key_drop_box',
                location: dropBoxLocation,
                shop: shopName
            },
            
            // Tracking
            assignedTechnician: null,
            assignedBay: null,
            diagnosticNotes: '',
            diagnosticCompleted: false,
            estimateCreated: false,
            estimateApproved: false,
            customerNotified: false
        };

        // Save drop-off record
        this.dropoffs.push(dropoff);
        this.saveDropoffs();

        // Add to queue for service advisor review
        this.dropoffQueue.push(dropoff.id);
        this.saveDropoffQueue();

        // Also create/update customer record (if customer service exists)
        this.createOrUpdateCustomerRecord(dropoff.customer);

        return dropoff;
    }

    /**
     * Get all pending drop-offs
     */
    getPendingDropoffs() {
        return this.dropoffs.filter(d => d.status === 'pending_review');
    }

    /**
     * Get drop-offs in queue
     */
    getDropoffQueue() {
        return this.dropoffQueue
            .map(id => this.dropoffs.find(d => d.id === id))
            .filter(d => d && d.status === 'pending_review');
    }

    /**
     * Get drop-off by ID
     */
    getDropoffById(dropoffId) {
        return this.dropoffs.find(d => d.id === dropoffId);
    }

    /**
     * Update drop-off status
     */
    updateDropoffStatus(dropoffId, status, updates = {}) {
        const index = this.dropoffs.findIndex(d => d.id === dropoffId);
        if (index === -1) {
            throw new Error('Drop-off not found');
        }

        this.dropoffs[index] = {
            ...this.dropoffs[index],
            status,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.saveDropoffs();

        // Remove from queue if status changed from pending_review
        if (status !== 'pending_review') {
            this.removeFromQueue(dropoffId);
        }

        return this.dropoffs[index];
    }

    /**
     * Assign technician to drop-off
     */
    assignTechnician(dropoffId, technicianId) {
        return this.updateDropoffStatus(dropoffId, 'in_review', {
            assignedTechnician: technicianId,
            assignedAt: new Date().toISOString()
        });
    }

    /**
     * Assign bay to drop-off
     */
    assignBay(dropoffId, bayId) {
        return this.updateDropoffStatus(dropoffId, 'in_review', {
            assignedBay: bayId,
            bayAssignedAt: new Date().toISOString()
        });
    }

    /**
     * Complete diagnostic and create estimate
     */
    completeDiagnostic(dropoffId, diagnosticData) {
        const {
            vin,
            diagnosticNotes,
            laborItems,
            partsNeeded,
            skillLevelRequired
        } = diagnosticData;

        return this.updateDropoffStatus(dropoffId, 'diagnosed', {
            vehicle: {
                ...this.getDropoffById(dropoffId).vehicle,
                vin: vin
            },
            diagnosticNotes,
            diagnosticCompleted: true,
            diagnosticCompletedAt: new Date().toISOString(),
            laborItems,
            partsNeeded,
            skillLevelRequired
        });
    }

    /**
     * Create estimate for drop-off
     */
    createEstimate(dropoffId, estimateData) {
        return this.updateDropoffStatus(dropoffId, 'approved', {
            estimateCreated: true,
            estimateData,
            estimateCreatedAt: new Date().toISOString()
        });
    }

    /**
     * Start work on vehicle (after estimate approved)
     */
    startWork(dropoffId, technicianId, bayId) {
        return this.updateDropoffStatus(dropoffId, 'in_progress', {
            assignedTechnician: technicianId,
            assignedBay: bayId,
            workStartedAt: new Date().toISOString()
        });
    }

    /**
     * Mark vehicle as ready
     */
    markReady(dropoffId) {
        return this.updateDropoffStatus(dropoffId, 'ready', {
            readyAt: new Date().toISOString()
        });
    }

    /**
     * Remove from queue
     */
    removeFromQueue(dropoffId) {
        this.dropoffQueue = this.dropoffQueue.filter(id => id !== dropoffId);
        this.saveDropoffQueue();
    }

    /**
     * Get drop-offs by date range
     */
    getDropoffsByDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);

        return this.dropoffs.filter(d => {
            const date = new Date(d.timestamp);
            return date >= start && date <= end;
        });
    }

    /**
     * Get drop-off statistics
     */
    getDropoffStats(dateRange = 'today') {
        const dropoffs = this.getDropoffsByDateRange(
            this.getStartDate(dateRange),
            new Date()
        );

        return {
            total: dropoffs.length,
            pending: dropoffs.filter(d => d.status === 'pending_review').length,
            inReview: dropoffs.filter(d => d.status === 'in_review').length,
            diagnosed: dropoffs.filter(d => d.status === 'diagnosed').length,
            approved: dropoffs.filter(d => d.status === 'approved').length,
            inProgress: dropoffs.filter(d => d.status === 'in_progress').length,
            ready: dropoffs.filter(d => d.status === 'ready').length,
            returningCustomers: dropoffs.filter(d => d.customer.isReturningCustomer).length,
            newCustomers: dropoffs.filter(d => !d.customer.isReturningCustomer).length,
            needsRide: dropoffs.filter(d => d.service.needsRide).length
        };
    }

    /**
     * Generate drop-off ID
     */
    generateDropoffId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `DO${timestamp}${random}`;
    }

    /**
     * Determine priority based on issues and appointment
     */
    determinePriority(issues, appointmentTime) {
        // Emergency keywords
        const emergencyKeywords = ['emergency', 'wont start', 'overheating', 'brake', 'stuck', 'dangerous'];
        if (emergencyKeywords.some(keyword => issues.toLowerCase().includes(keyword))) {
            return 'emergency';
        }

        // Has appointment today
        if (appointmentTime) {
            const appointmentDate = new Date(appointmentTime);
            const today = new Date();
            if (appointmentDate.toDateString() === today.toDateString()) {
                return 'high';
            }
        }

        return 'normal';
    }

    /**
     * Get start date based on range
     */
    getStartDate(range) {
        const now = new Date();
        switch (range) {
            case 'today':
                return new Date(now.setHours(0, 0, 0, 0));
            case 'week':
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                return weekStart;
            case 'month':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                return monthStart;
            default:
                return new Date(now.setHours(0, 0, 0, 0));
        }
    }

    /**
     * Create or update customer record
     * This would integrate with the customer service
     */
    createOrUpdateCustomerRecord(customer) {
        // Check if customer service exists
        if (window.customerService) {
            // Try to find existing customer by phone
            const existingCustomers = window.customerService.getAllCustomers();
            const existingCustomer = existingCustomers.find(c => 
                c.phone === customer.phone
            );

            if (existingCustomer) {
                // Update existing customer
                window.customerService.updateCustomer(existingCustomer.id, {
                    name: customer.name,
                    email: customer.email || existingCustomer.email,
                    lastVisit: new Date().toISOString()
                });
            } else {
                // Create new customer
                window.customerService.createCustomer({
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email || '',
                    customerType: 'individual',
                    createdAt: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Save drop-offs to localStorage
     */
    saveDropoffs() {
        localStorage.setItem('vhicl_dropoffs', JSON.stringify(this.dropoffs));
    }

    /**
     * Save drop-off queue to localStorage
     */
    saveDropoffQueue() {
        localStorage.setItem('vhicl_dropoff_queue', JSON.stringify(this.dropoffQueue));
    }

    /**
     * Get drop-off instructions text
     */
    getDropoffInstructions(shopName, dropBoxLocation) {
        return `Thank you for calling ${shopName}. I can help you with dropping off your vehicle. Please follow these instructions:

**Key Drop Box Instructions:**
• Please park your vehicle in our customer parking area
• Place your keys in the secure key drop box located ${dropBoxLocation}
• The drop box is clearly marked and checked regularly throughout the day`;
    }
}

// Export for use in other files
// 

