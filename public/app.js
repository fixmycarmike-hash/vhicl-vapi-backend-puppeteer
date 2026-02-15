// Car Towing Workflow System - Enhanced with Tow Company Integration & Safety

class CarTowingSystem {
    constructor() {
        this.workOrders = this.loadWorkOrders();
        this.technicians = this.loadTechnicians();
        this.bays = this.loadBays();
        this.shopSettings = this.loadShopSettings();
        this.towCompanies = this.loadTowCompanies();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderWorkOrders();
        this.renderQueues();
        this.renderTechnicians();
        this.renderBays();
        this.renderTowCompanies();
        this.updateStatistics();
        this.updateArrivalSelect();
        this.generateAssignmentRecommendation();
    }

    // ========== DATA PERSISTENCE ==========

    loadWorkOrders() {
        const stored = localStorage.getItem('carTowingWorkOrders');
        return stored ? JSON.parse(stored) : [];
    }

    loadTechnicians() {
        const stored = localStorage.getItem('carTowingTechnicians');
        return stored ? JSON.parse(stored) : [];
    }

    loadBays() {
        const stored = localStorage.getItem('carTowingBays');
        return stored ? JSON.parse(stored) : [];
    }

    loadShopSettings() {
        const stored = localStorage.getItem('carTowingShopSettings');
        return stored ? JSON.parse(stored) : { numBays: 4, shopName: 'Auto Shop' };
    }

    loadTowCompanies() {
        const stored = localStorage.getItem('carTowingTowCompanies');
        return stored ? JSON.parse(stored) : [];
    }

    saveWorkOrders() {
        localStorage.setItem('carTowingWorkOrders', JSON.stringify(this.workOrders));
    }

    saveTechnicians() {
        localStorage.setItem('carTowingTechnicians', JSON.stringify(this.technicians));
    }

    saveBays() {
        localStorage.setItem('carTowingBays', JSON.stringify(this.bays));
    }

    saveShopSettings() {
        localStorage.setItem('carTowingShopSettings', JSON.stringify(this.shopSettings));
    }

    saveTowCompanies() {
        localStorage.setItem('carTowingTowCompanies', JSON.stringify(this.towCompanies));
    }

    // ========== EVENT LISTENERS ==========

    setupEventListeners() {
        // Work order form submission
        document.getElementById('work-order-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createWorkOrder();
        });

        // Arrival alert button
        document.getElementById('arrival-alert-btn').addEventListener('click', () => {
            this.handleArrivalAlert();
        });

        // Arrival select change
        document.getElementById('arrival-car-select').addEventListener('change', (e) => {
            const btn = document.getElementById('arrival-alert-btn');
            btn.disabled = !e.target.value;
        });

        // Technician form
        document.getElementById('tech-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTechnician();
        });

        // Settings form
        document.getElementById('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Tow company form
        document.getElementById('tow-company-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTowCompany();
        });
    }

    // ========== WORK ORDER MANAGEMENT ==========

    createWorkOrder() {
        const form = document.getElementById('work-order-form');
        const formData = new FormData(form);

        const dangerousLocation = document.getElementById('dangerous-location').checked;

        const workOrder = {
            id: Date.now(),
            customerName: formData.get('customerName'),
            customerPhone: formData.get('customerPhone'),
            carMake: formData.get('carMake'),
            carModel: formData.get('carModel'),
            carYear: formData.get('carYear'),
            carColor: formData.get('carColor'),
            tagNumber: formData.get('tagNumber'),
            vin: formData.get('vin'),
            towLocation: formData.get('towLocation'),
            towReason: formData.get('towReason'),
            additionalNotes: formData.get('additionalNotes'),
            dangerousLocation: dangerousLocation,
            jobDifficulty: formData.get('jobDifficulty'),
            jobUrgency: formData.get('jobUrgency') || 'medium',
            status: 'towing',
            createdAt: new Date().toISOString(),
            arrivedAt: null,
            notifiedAt: null,
            assignedTech: null,
            assignedBay: null,
            assignedAt: null,
            towStatus: 'pending', // pending, called, dispatched, en_route, arrived
            towCompany: null,
            towEta: null,
            customerNotifiedOfEta: false
        };

        this.workOrders.push(workOrder);
        this.saveWorkOrders();
        
        form.reset();
        document.getElementById('dangerous-location').checked = false;
        
        this.renderWorkOrders();
        this.renderQueues();
        this.updateStatistics();
        this.updateArrivalSelect();

        this.showNotification('Work Order Created!', `Work order for ${workOrder.carYear} ${workOrder.carMake} ${workOrder.carModel} has been created successfully.`);

        // If dangerous location, show immediate alert
        if (dangerousLocation) {
            this.showDangerousLocationModal(workOrder);
        }

        // Show tow company call prompt
        setTimeout(() => {
            this.showCallTowCompanyModal(workOrder);
        }, 1000);
    }

    handleArrivalAlert() {
        const select = document.getElementById('arrival-car-select');
        const workOrderId = parseInt(select.value);
        
        if (!workOrderId) return;

        const workOrder = this.workOrders.find(wo => wo.id === workOrderId);
        if (!workOrder) return;

        workOrder.status = 'arrived';
        workOrder.towStatus = 'arrived';
        workOrder.arrivedAt = new Date().toISOString();
        
        this.saveWorkOrders();
        
        this.renderWorkOrders();
        this.renderQueues();
        this.updateStatistics();
        this.updateArrivalSelect();

        this.showAlexNotification(workOrder);
    }

    showAlexNotification(workOrder) {
        const notificationArea = document.getElementById('notification-area');
        
        const banner = document.createElement('div');
        banner.className = 'notification-banner';
        banner.innerHTML = `
            <h3>🚨 Car Arrived: ${workOrder.carYear} ${workOrder.carMake} ${workOrder.carModel}</h3>
            <p><strong>Customer:</strong> ${workOrder.customerName}</p>
            <p><strong>Phone:</strong> ${workOrder.customerPhone}</p>
            <p><strong>Towed From:</strong> ${workOrder.towLocation}</p>
            <p><strong>Job Difficulty:</strong> ${workOrder.jobDifficulty} | <strong>Urgency:</strong> ${workOrder.jobUrgency}</p>
            <div class="notification-actions">
                <select id="call-customer-select-${workOrder.id}" class="select-car">
                    <option value="${workOrder.id}">${workOrder.carYear} ${workOrder.carMake} ${workOrder.carModel}</option>
                </select>
                <button onclick="carTowingSystem.callCustomer(${workOrder.id})" class="btn-primary" style="background-color: white; color: var(--success-color);">
                    📞 Call Customer
                </button>
                <button onclick="this.parentElement.parentElement.remove()" class="btn-warning">
                    Dismiss
                </button>
            </div>
        `;
        
        notificationArea.innerHTML = '';
        notificationArea.appendChild(banner);
    }

    callCustomer(workOrderId) {
        const workOrder = this.workOrders.find(wo => wo.id === workOrderId);
        if (!workOrder) return;

        workOrder.status = 'notified';
        workOrder.notifiedAt = new Date().toISOString();
        
        this.saveWorkOrders();
        
        const notificationArea = document.getElementById('notification-area');
        notificationArea.innerHTML = '';

        this.renderWorkOrders();
        this.renderQueues();
        this.updateStatistics();
        this.updateArrivalSelect();
        this.generateAssignmentRecommendation();

        this.showNotification('Customer Notified!', `Called ${workOrder.customerName} at ${workOrder.customerPhone}. The car has been placed in the queue.`);
    }

    deleteWorkOrder(workOrderId) {
        if (!confirm('Are you sure you want to delete this work order?')) return;

        this.workOrders = this.workOrders.filter(wo => wo.id !== workOrderId);
        this.saveWorkOrders();
        
        this.renderWorkOrders();
        this.renderQueues();
        this.updateStatistics();
        this.updateArrivalSelect();
        this.generateAssignmentRecommendation();
    }

    markAsArrived(workOrderId) {
        const workOrder = this.workOrders.find(wo => wo.id === workOrderId);
        if (!workOrder) return;

        workOrder.status = 'arrived';
        workOrder.towStatus = 'arrived';
        workOrder.arrivedAt = new Date().toISOString();
        
        this.saveWorkOrders();
        
        this.renderWorkOrders();
        this.renderQueues();
        this.updateStatistics();
        this.updateArrivalSelect();

        this.showAlexNotification(workOrder);
    }

    // ========== TOW COMPANY MANAGEMENT ==========

    addTowCompany() {
        const form = document.getElementById('tow-company-form');
        const formData = new FormData(form);

        const company = {
            id: Date.now(),
            name: formData.get('towCompanyName'),
            phone: formData.get('towCompanyPhone'),
            notes: formData.get('towCompanyNotes')
        };

        this.towCompanies.push(company);
        this.saveTowCompanies();
        
        form.reset();
        closeTowCompanyModal();
        
        this.renderTowCompanies();

        this.showNotification('Tow Company Added!', `${company.name} has been added to your tow company list.`);
    }

    deleteTowCompany(companyId) {
        if (!confirm('Are you sure you want to remove this tow company?')) return;

        this.towCompanies = this.towCompanies.filter(c => c.id !== companyId);
        this.saveTowCompanies();
        
        this.renderTowCompanies();
    }

    // ========== CALL TOW COMPANY WORKFLOW ==========

    showCallTowCompanyModal(workOrder) {
        if (this.towCompanies.length === 0) {
            this.showNotification('Add Tow Company First', 'Please add a tow company before calling for pickup.');
            return;
        }

        const modal = document.getElementById('call-tow-modal');
        const content = document.getElementById('call-tow-content');

        const companiesOptions = this.towCompanies.map(c => 
            `<option value="${c.id}">${c.name} - ${c.phone}</option>`
        ).join('');

        content.innerHTML = `
            <div class="call-script">
                <h4>📋 Call Script for Tow Company</h4>
                <div class="script-item"><strong>1. Greet:</strong> "Hi, this is ${this.shopSettings.shopName}, I'd like to request a tow pickup."</div>
                <div class="script-item"><strong>2. Provide Customer Info:</strong></div>
                <ul>
                    <li>Customer Name: <strong>${workOrder.customerName}</strong></li>
                    <li>Customer Phone: <strong>${workOrder.customerPhone}</strong></li>
                </ul>
                <div class="script-item"><strong>3. Provide Vehicle Info:</strong></div>
                <ul>
                    <li>Vehicle: <strong>${workOrder.carYear} ${workOrder.carMake} ${workOrder.carModel}</strong></li>
                    <li>Color: <strong>${workOrder.carColor}</strong></li>
                    <li>Tag Number: <strong>${workOrder.tagNumber}</strong></li>
                </ul>
                <div class="script-item"><strong>4. Provide Pickup Location:</strong></div>
                <ul>
                    <li>Address: <strong>${workOrder.towLocation}</strong></li>
                </ul>
                ${workOrder.dangerousLocation ? `
                    <div class="dangerous-warning" style="margin-top: 15px;">
                        <h4>⚠️ DANGEROUS LOCATION</h4>
                        <p><strong>IMPORTANT:</strong> This vehicle is in a dangerous location. Please prioritize this pickup and notify your driver.</p>
                        <p>Customer has been instructed to call 911 and police have been notified.</p>
                    </div>
                ` : ''}
                <div class="script-item"><strong>5. Get ETA:</strong> "What is your estimated time of arrival?"</div>
            </div>

            <div class="form-group">
                <label for="select-tow-company">Select Tow Company to Call</label>
                <select id="select-tow-company" class="select-car">
                    ${companiesOptions}
                </select>
            </div>

            <div class="eta-section">
                <h3>⏱️ Tow Company ETA</h3>
                <div class="eta-input-group">
                    <input type="text" id="tow-eta-input" placeholder="e.g., 30 mins">
                    <button onclick="carTowingSystem.recordTowEta(${workOrder.id})" class="btn-primary" style="background-color: white; color: var(--success-color);">
                        Record ETA
                    </button>
                </div>
                <div id="eta-display-${workOrder.id}" class="eta-display">
                    ${workOrder.towEta ? workOrder.towEta : '--'}
                </div>
            </div>

            <div class="call-actions">
                <button onclick="carTowingSystem.confirmTowCall(${workOrder.id})" class="btn-success" style="flex: 1;">
                    ✓ Called Tow Company & Got ETA
                </button>
                <button onclick="closeCallTowModal()" class="btn-warning">
                    Skip
                </button>
            </div>

            <div class="tow-status-tracker">
                <div class="tow-status-step ${workOrder.towStatus === 'pending' ? 'active' : ''} ${['called', 'dispatched', 'en_route', 'arrived'].includes(workOrder.towStatus) ? 'completed' : ''}">
                    <div class="tow-status-circle">📝</div>
                    <div class="tow-status-label">Request</div>
                </div>
                <div class="tow-status-step ${workOrder.towStatus === 'called' ? 'active' : ''} ${['dispatched', 'en_route', 'arrived'].includes(workOrder.towStatus) ? 'completed' : ''}">
                    <div class="tow-status-circle">📞</div>
                    <div class="tow-status-label">Called</div>
                </div>
                <div class="tow-status-step ${workOrder.towStatus === 'dispatched' ? 'active' : ''} ${['en_route', 'arrived'].includes(workOrder.towStatus) ? 'completed' : ''}">
                    <div class="tow-status-circle">🚛</div>
                    <div class="tow-status-label">Dispatched</div>
                </div>
                <div class="tow-status-step ${workOrder.towStatus === 'en_route' ? 'active' : ''} ${workOrder.towStatus === 'arrived' ? 'completed' : ''}">
                    <div class="tow-status-circle">🛣️</div>
                    <div class="tow-status-label">En Route</div>
                </div>
                <div class="tow-status-step ${workOrder.towStatus === 'arrived' ? 'active' : ''}">
                    <div class="tow-status-circle">🏁</div>
                    <div class="tow-status-label">Arrived</div>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    recordTowEta(workOrderId) {
        const etaInput = document.getElementById('tow-eta-input').value.trim();
        if (!etaInput) {
            alert('Please enter the ETA');
            return;
        }

        const workOrder = this.workOrders.find(wo => wo.id === workOrderId);
        if (!workOrder) return;

        workOrder.towEta = etaInput;
        this.saveWorkOrders();

        // Update display
        const etaDisplay = document.getElementById(`eta-display-${workOrderId}`);
        if (etaDisplay) {
            etaDisplay.textContent = etaInput;
        }

        this.showNotification('ETA Recorded!', `Tow company ETA: ${etaInput}`);
    }

    confirmTowCall(workOrderId) {
        const workOrder = this.workOrders.find(wo => wo.id === workOrderId);
        if (!workOrder) return;

        const companyId = parseInt(document.getElementById('select-tow-company').value);
        const company = this.towCompanies.find(c => c.id === companyId);

        workOrder.towStatus = 'called';
        workOrder.towCompany = companyId;

        if (!workOrder.towEta) {
            const etaInput = document.getElementById('tow-eta-input').value.trim();
            if (etaInput) {
                workOrder.towEta = etaInput;
            }
        }

        this.saveWorkOrders();
        closeCallTowModal();

        this.renderWorkOrders();

        // Show customer callback prompt
        this.showCustomerCallbackPrompt(workOrder, company);
    }

    showCustomerCallbackPrompt(workOrder, company) {
        const notificationArea = document.getElementById('notification-area');
        
        const banner = document.createElement('div');
        banner.className = 'notification-banner';
        banner.style.background = 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))';
        banner.innerHTML = `
            <h3>📞 Call Customer with Tow ETA</h3>
            <p><strong>Tow Company:</strong> ${company.name}</p>
            <p><strong>ETA:</strong> ${workOrder.towEta || 'Not recorded yet'}</p>
            <p><strong>Customer:</strong> ${workOrder.customerName} (${workOrder.customerPhone})</p>
            <div class="call-script" style="background: rgba(255,255,255,0.2); color: white;">
                <h4>💬 What to say:</h4>
                <p>"Hello ${workOrder.customerName}, this is ${this.shopSettings.shopName}. I've called ${company.name} and they'll be there in approximately ${workOrder.towEta || '___'} to pick up your ${workOrder.carColor} ${workOrder.carYear} ${workOrder.carMake} ${workOrder.carModel} from ${workOrder.towLocation}."</p>
            </div>
            <div class="notification-actions">
                <button onclick="carTowingSystem.confirmCustomerCallback(${workOrder.id})" class="btn-primary" style="background-color: white; color: var(--primary-color);">
                    ✓ Called Customer with ETA
                </button>
                <button onclick="this.parentElement.parentElement.remove()" class="btn-warning">
                    Dismiss
                </button>
            </div>
        `;
        
        notificationArea.innerHTML = '';
        notificationArea.appendChild(banner);
    }

    confirmCustomerCallback(workOrderId) {
        const workOrder = this.workOrders.find(wo => wo.id === workOrderId);
        if (!workOrder) return;

        workOrder.customerNotifiedOfEta = true;
        workOrder.towStatus = 'dispatched';
        this.saveWorkOrders();

        const notificationArea = document.getElementById('notification-area');
        notificationArea.innerHTML = '';

        this.renderWorkOrders();

        this.showNotification('Customer Informed!', `Customer has been notified of tow company ETA: ${workOrder.towEta}`);
    }

    // ========== DANGEROUS LOCATION HANDLING ==========

    showDangerousLocationModal(workOrder) {
        const modal = document.getElementById('dangerous-modal');
        const details = document.getElementById('dangerous-work-order-details');

        details.innerHTML = `
            <div class="card" style="margin: 20px 0;">
                <h4>📋 Vehicle & Customer Details</h4>
                <p><strong>Customer:</strong> ${workOrder.customerName} - ${workOrder.customerPhone}</p>
                <p><strong>Vehicle:</strong> ${workOrder.carYear} ${workOrder.carMake} ${workOrder.carModel} (${workOrder.carColor})</p>
                <p><strong>Tag:</strong> ${workOrder.tagNumber}</p>
                <p><strong>Location:</strong> ${workOrder.towLocation}</p>
            </div>
        `;

        document.getElementById('dangerous-eta').textContent = workOrder.towEta || 'Pending...';

        modal.classList.add('active');
    }

    confirmDangerousHandled() {
        // Find the work order that triggered this modal
        const workOrder = this.workOrders.find(wo => wo.dangerousLocation && !wo.dangerousLocationHandled);
        if (workOrder) {
            workOrder.dangerousLocationHandled = true;
            workOrder.dangerousLocationHandledAt = new Date().toISOString();
            this.saveWorkOrders();
        }

        closeDangerousModal();

        this.showNotification('Safety Alert Handled!', 'Customer has been instructed to call 911. Police and tow company have been notified of the dangerous location.');
    }

    updateTowStatus(workOrderId, newStatus) {
        const workOrder = this.workOrders.find(wo => wo.id === workOrderId);
        if (!workOrder) return;

        workOrder.towStatus = newStatus;
        this.saveWorkOrders();

        this.renderWorkOrders();
    }

    // ========== TECHNICIAN MANAGEMENT ==========

    addTechnician() {
        const form = document.getElementById('tech-form');
        const formData = new FormData(form);

        const tech = {
            id: Date.now(),
            name: formData.get('techName'),
            rating: formData.get('techRating'),
            qualifications: formData.get('techQualifications')
                ? formData.get('techQualifications').split(',').map(q => q.trim())
                : [],
            phone: formData.get('techPhone'),
            status: 'available',
            currentJob: null,
            currentBay: null
        };

        this.technicians.push(tech);
        this.saveTechnicians();
        
        form.reset();
        closeTechModal();
        
        this.renderTechnicians();
        this.updateStatistics();
        this.generateAssignmentRecommendation();

        this.showNotification('Technician Added!', `${tech.name} (${tech.rating}-Rated) has been added to the team.`);
    }

    deleteTechnician(techId) {
        if (!confirm('Are you sure you want to remove this technician?')) return;

        this.technicians = this.technicians.filter(t => t.id !== techId);
        this.saveTechnicians();
        
        this.renderTechnicians();
        this.updateStatistics();
        this.generateAssignmentRecommendation();
    }

    toggleTechStatus(techId) {
        const tech = this.technicians.find(t => t.id === techId);
        if (!tech) return;

        tech.status = tech.status === 'available' ? 'busy' : 'available';
        this.saveTechnicians();
        
        this.renderTechnicians();
        this.updateStatistics();
        this.generateAssignmentRecommendation();
    }

    // ========== BAY MANAGEMENT ==========

    initializeBays(numBays) {
        this.bays = [];
        for (let i = 1; i <= numBays; i++) {
            this.bays.push({
                id: i,
                number: i,
                status: 'empty',
                currentCar: null,
                currentTech: null,
                currentJob: null
            });
        }
        this.saveBays();
    }

    saveSettings() {
        const form = document.getElementById('settings-form');
        const formData = new FormData(form);

        this.shopSettings = {
            numBays: parseInt(formData.get('numBays')),
            shopName: formData.get('shopName') || 'Auto Shop'
        };

        this.initializeBays(this.shopSettings.numBays);
        this.saveShopSettings();

        closeSettingsModal();
        
        this.renderBays();
        this.updateStatistics();
        this.generateAssignmentRecommendation();

        this.showNotification('Settings Saved!', `${this.shopSettings.numBays} bays configured for ${this.shopSettings.shopName}`);
    }

    // ========== INTELLIGENT JOB ASSIGNMENT ==========

    generateAssignmentRecommendation() {
        const recommendationArea = document.getElementById('assignment-recommendation-area');
        
        const pendingJobs = this.workOrders
            .filter(wo => wo.status === 'notified')
            .sort((a, b) => this.calculateUrgencyScore(b) - this.calculateUrgencyScore(a));

        const availableTechs = this.technicians.filter(t => t.status === 'available');
        const emptyBays = this.bays.filter(b => b.status === 'empty');

        if (pendingJobs.length === 0 || availableTechs.length === 0 || emptyBays.length === 0) {
            recommendationArea.innerHTML = `
                <div class="assignment-recommendation" style="background: #64748b;">
                    <h3>⏳ Waiting for Assignment</h3>
                    <p>${pendingJobs.length === 0 ? 'No pending jobs' : 
                         availableTechs.length === 0 ? 'No technicians available' : 
                         'No empty bays available'}</p>
                </div>
            `;
            return;
        }

        const topJob = pendingJobs[0];
        const bestTech = this.findBestTech(topJob, availableTechs);
        const bestBay = emptyBays[0];

        recommendationArea.innerHTML = `
            <div class="assignment-recommendation">
                <h3>🎯 Recommended Assignment</h3>
                <div class="recommendation-details">
                    <div class="rec-job">
                        <div class="rec-label">Job</div>
                        <div class="rec-value">${topJob.carYear} ${topJob.carMake} ${topJob.carModel}</div>
                        <div style="font-size: 0.9rem; margin-top: 5px;">
                            <span class="job-difficulty difficulty-${topJob.jobDifficulty.toLowerCase()}">${topJob.jobDifficulty}-Level Job</span>
                            <span class="urgency-badge urgency-${topJob.jobUrgency}" style="margin-left: 5px;">${topJob.jobUrgency} Priority</span>
                        </div>
                    </div>
                    <div class="rec-tech">
                        <div class="rec-label">Technician</div>
                        <div class="rec-value">${bestTech.name} (${bestTech.rating}-Rated)</div>
                        <div style="font-size: 0.9rem; margin-top: 5px;">
                            Bay ${bestBay.number} • ${bestTech.qualifications.length > 0 ? bestTech.qualifications.slice(0, 2).join(', ') : 'General Tech'}
                        </div>
                    </div>
                </div>
                <div class="assignment-actions">
                    <button onclick="carTowingSystem.assignJob(${topJob.id}, ${bestTech.id}, ${bestBay.id})" class="btn-recommend">
                        ✅ Assign Job to ${bestTech.name}
                    </button>
                    <button onclick="this.parentElement.parentElement.remove()" class="btn-warning">
                        Skip
                    </button>
                </div>
            </div>
        `;
    }

    calculateUrgencyScore(job) {
        let score = 0;
        
        if (job.jobUrgency === 'high') score += 30;
        else if (job.jobUrgency === 'medium') score += 20;
        else score += 10;
        
        if (job.jobDifficulty === 'A') score += 15;
        else if (job.jobDifficulty === 'B') score += 10;
        else score += 5;
        
        const hoursInQueue = (Date.now() - new Date(job.notifiedAt).getTime()) / (1000 * 60 * 60);
        score += Math.min(hoursInQueue * 2, 20);
        
        if (job.towReason === 'accident') score += 10;
        else if (job.towReason === 'breakdown') score += 8;
        
        return score;
    }

    findBestTech(job, availableTechs) {
        let qualifiedTechs = [];
        
        if (job.jobDifficulty === 'A') {
            qualifiedTechs = availableTechs.filter(t => t.rating === 'A');
        } else if (job.jobDifficulty === 'B') {
            qualifiedTechs = availableTechs.filter(t => t.rating === 'A' || t.rating === 'B');
        } else {
            qualifiedTechs = availableTechs;
        }

        if (qualifiedTechs.length === 0) {
            qualifiedTechs = availableTechs;
        }

        const scoredTechs = qualifiedTechs.map(tech => {
            let score = 0;
            
            if (tech.rating === job.jobDifficulty) score += 20;
            else if (tech.rating === 'A' && job.jobDifficulty !== 'A') score += 10;
            
            if (tech.rating === 'A') score += 15;
            else if (tech.rating === 'B') score += 10;
            else score += 5;
            
            return { tech, score };
        });

        scoredTechs.sort((a, b) => b.score - a.score);
        return scoredTechs[0].tech;
    }

    assignJob(jobId, techId, bayId) {
        const job = this.workOrders.find(wo => wo.id === jobId);
        const tech = this.technicians.find(t => t.id === techId);
        const bay = this.bays.find(b => b.id === bayId);

        if (!job || !tech || !bay) return;

        job.status = 'assigned';
        job.assignedTech = tech.id;
        job.assignedBay = bay.id;
        job.assignedAt = new Date().toISOString();

        tech.status = 'busy';
        tech.currentJob = job.id;
        tech.currentBay = bay.id;

        bay.status = 'occupied';
        bay.currentCar = job.id;
        bay.currentTech = tech.id;
        bay.currentJob = job.id;

        this.saveWorkOrders();
        this.saveTechnicians();
        this.saveBays();

        this.renderWorkOrders();
        this.renderQueues();
        this.renderTechnicians();
        this.renderBays();
        this.updateStatistics();
        this.updateArrivalSelect();
        this.generateAssignmentRecommendation();

        this.showNotification('Job Assigned!', `${tech.name} assigned to ${job.carYear} ${job.carMake} ${job.carModel} in Bay ${bay.number}`);
    }

    completeJob(jobId) {
        const job = this.workOrders.find(wo => wo.id === jobId);
        if (!job) return;

        const tech = this.technicians.find(t => t.id === job.assignedTech);
        const bay = this.bays.find(b => b.id === job.assignedBay);

        job.status = 'completed';

        if (tech) {
            tech.status = 'available';
            tech.currentJob = null;
            tech.currentBay = null;
        }

        if (bay) {
            bay.status = 'empty';
            bay.currentCar = null;
            bay.currentTech = null;
            bay.currentJob = null;
        }

        this.saveWorkOrders();
        this.saveTechnicians();
        this.saveBays();

        this.renderWorkOrders();
        this.renderQueues();
        this.renderTechnicians();
        this.renderBays();
        this.updateStatistics();
        this.generateAssignmentRecommendation();

        this.showNotification('Job Completed!', `${job.carYear} ${job.carMake} ${job.carModel} is ready for pickup!`);
    }

    // ========== RENDERING ==========

    renderWorkOrders() {
        const container = document.getElementById('work-orders-container');
        
        if (this.workOrders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">No active work orders yet</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.workOrders.map(wo => `
            <div class="work-order-item status-${wo.status}">
                <div class="work-order-header">
                    <div class="work-order-title">${wo.carYear} ${wo.carMake} ${wo.carModel}</div>
                    <div class="work-order-status status-${wo.status}">${wo.status}</div>
                </div>
                <div class="work-order-details">
                    <p><strong>Customer:</strong> ${wo.customerName} | <strong>Phone:</strong> ${wo.customerPhone}</p>
                    <p><strong>Vehicle:</strong> ${wo.carColor} ${wo.carYear} ${wo.carMake} ${wo.carModel} | <strong>Tag:</strong> ${wo.tagNumber}</p>
                    <p><strong>From:</strong> ${wo.towLocation} | <strong>Reason:</strong> ${this.formatReason(wo.towReason)}</p>
                    <p><strong>Difficulty:</strong> <span class="job-difficulty difficulty-${wo.jobDifficulty.toLowerCase()}">${wo.jobDifficulty}</span> | 
                       <strong>Urgency:</strong> <span class="urgency-badge urgency-${wo.jobUrgency}">${wo.jobUrgency}</span></p>
                    ${wo.towEta ? `<p><strong>Tow ETA:</strong> ${wo.towEta} | <strong>Status:</strong> ${wo.towStatus.replace('_', ' ').toUpperCase()}</p>` : ''}
                    ${wo.dangerousLocation ? `<p><strong>⚠️ DANGEROUS LOCATION</strong> - ${wo.dangerousLocationHandled ? 'Handled - Customer called 911' : 'Not yet handled'}</p>` : ''}
                    ${wo.assignedTech ? `<p><strong>Assigned:</strong> Bay ${wo.assignedBay} • ${this.getTechName(wo.assignedTech)}</p>` : ''}
                    <p><strong>Created:</strong> ${this.formatDate(wo.createdAt)}</p>
                    ${wo.vin ? `<p><strong>VIN:</strong> ${wo.vin}</p>` : ''}
                    ${wo.additionalNotes ? `<p><strong>Notes:</strong> ${wo.additionalNotes}</p>` : ''}
                </div>
                <div class="work-order-actions">
                    ${wo.status === 'towing' ? `
                        <button onclick="carTowingSystem.showCallTowCompanyModal(carTowingSystem.workOrders.find(w => w.id === ${wo.id}))" class="btn-warning">📞 Call Tow Company</button>
                        <button onclick="carTowingSystem.markAsArrived(${wo.id})" class="btn-success">Mark as Arrived</button>
                    ` : ''}
                    ${wo.status === 'arrived' ? `
                        <button onclick="carTowingSystem.callCustomer(${wo.id})" class="btn-primary">Call Customer</button>
                    ` : ''}
                    ${wo.status === 'assigned' ? `
                        <button onclick="carTowingSystem.completeJob(${wo.id})" class="btn-success">Mark Complete</button>
                    ` : ''}
                    <button onclick="carTowingSystem.deleteWorkOrder(${wo.id})" class="btn-danger">Delete</button>
                </div>
            </div>
        `).join('');
    }

    renderQueues() {
        const towingQueue = this.workOrders.filter(wo => wo.status === 'towing');
        const arrivedQueue = this.workOrders.filter(wo => wo.status === 'arrived');
        const notifiedQueue = this.workOrders.filter(wo => wo.status === 'notified');

        document.getElementById('towing-queue').innerHTML = towingQueue.length === 0 
            ? '<div class="empty-state"><div class="empty-state-text">No cars being towed</div></div>'
            : towingQueue.map(wo => this.createQueueItem(wo)).join('');

        document.getElementById('arrived-queue').innerHTML = arrivedQueue.length === 0
            ? '<div class="empty-state"><div class="empty-state-text">No cars arrived yet</div></div>'
            : arrivedQueue.map(wo => this.createQueueItem(wo)).join('');

        document.getElementById('notified-queue').innerHTML = notifiedQueue.length === 0
            ? '<div class="empty-state"><div class="empty-state-text">No customers notified yet</div></div>'
            : notifiedQueue.map(wo => this.createQueueItem(wo)).join('');
    }

    renderTechnicians() {
        const container = document.getElementById('tech-grid');
        
        if (this.technicians.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-text">No technicians added yet</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.technicians.map(tech => `
            <div class="tech-card rating-${tech.rating.toLowerCase()} ${tech.status}">
                <div class="tech-header">
                    <div class="tech-name">${tech.name}</div>
                    <div class="tech-rating rating-${tech.rating.toLowerCase()}-badge">${tech.rating}</div>
                </div>
                <div class="tech-status ${tech.status}">${tech.status}</div>
                <div class="tech-details">
                    ${tech.phone ? `<p><strong>Phone:</strong> ${tech.phone}</p>` : ''}
                    ${tech.currentJob ? `<p><strong>Current Job:</strong> ${this.getJobDetails(tech.currentJob)}</p>` : ''}
                    ${tech.currentBay ? `<p><strong>Bay:</strong> ${tech.currentBay}</p>` : ''}
                </div>
                ${tech.qualifications.length > 0 ? `
                    <div class="tech-qualifications">
                        ${tech.qualifications.map(q => `<span class="qualification-tag">${q}</span>`).join('')}
                    </div>
                ` : ''}
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button onclick="carTowingSystem.toggleTechStatus(${tech.id})" class="btn-primary" style="flex: 1; font-size: 0.9rem;">
                        ${tech.status === 'available' ? 'Mark Busy' : 'Mark Available'}
                    </button>
                    <button onclick="carTowingSystem.deleteTechnician(${tech.id})" class="btn-danger" style="font-size: 0.9rem;">×</button>
                </div>
            </div>
        `).join('');
    }

    renderBays() {
        const container = document.getElementById('bay-grid');
        
        if (this.bays.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-text">No bays configured</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.bays.map(bay => `
            <div class="bay-card ${bay.status}">
                <div class="bay-number">Bay ${bay.number}</div>
                <div class="bay-status ${bay.status}">${bay.status}</div>
                ${bay.currentCar ? `
                    <div class="bay-car">
                        <strong>${this.getJobDetails(bay.currentJob)}</strong>
                    </div>
                    <div class="bay-tech">
                        Tech: ${this.getTechName(bay.currentTech)}
                    </div>
                ` : '<p style="color: var(--text-secondary);">Empty</p>'}
            </div>
        `).join('');
    }

    renderTowCompanies() {
        const container = document.getElementById('tow-company-grid');
        
        if (this.towCompanies.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-text">No tow companies added yet</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.towCompanies.map(company => `
            <div class="tech-card" style="border-color: var(--warning-color);">
                <div class="tech-header">
                    <div class="tech-name">${company.name}</div>
                </div>
                <div class="tech-details">
                    <p><strong>Phone:</strong> ${company.phone}</p>
                    ${company.notes ? `<p><strong>Notes:</strong> ${company.notes}</p>` : ''}
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button onclick="carTowingSystem.deleteTowCompany(${company.id})" class="btn-danger" style="flex: 1; font-size: 0.9rem;">Delete</button>
                </div>
            </div>
        `).join('');
    }

    updateStatistics() {
        const pendingJobs = this.workOrders.filter(wo => wo.status === 'notified').length;
        const availableTechs = this.technicians.filter(t => t.status === 'available').length;
        const emptyBays = this.bays.filter(b => b.status === 'empty').length;
        
        const nextJob = this.workOrders
            .filter(wo => wo.status === 'notified')
            .sort((a, b) => this.calculateUrgencyScore(b) - this.calculateUrgencyScore(a))[0];

        document.getElementById('stat-pending-jobs').textContent = pendingJobs;
        document.getElementById('stat-available-techs').textContent = availableTechs;
        document.getElementById('stat-empty-bays').textContent = emptyBays;
        document.getElementById('stat-next-urgency').textContent = nextJob ? nextJob.jobUrgency.toUpperCase() : '-';

        const towing = this.workOrders.filter(wo => wo.status === 'towing').length;
        const arrived = this.workOrders.filter(wo => wo.status === 'arrived').length;
        const notified = this.workOrders.filter(wo => wo.status === 'notified').length;
        const total = this.workOrders.length;

        document.getElementById('stat-towing').textContent = towing;
        document.getElementById('stat-arrived').textContent = arrived;
        document.getElementById('stat-queue').textContent = notified;
        document.getElementById('stat-total').textContent = total;
    }

    updateArrivalSelect() {
        const select = document.getElementById('arrival-car-select');
        const towingCars = this.workOrders.filter(wo => wo.status === 'towing');

        select.innerHTML = '<option value="">-- Select a car being towed --</option>';
        
        towingCars.forEach(wo => {
            select.innerHTML += `<option value="${wo.id}">${wo.carYear} ${wo.carMake} ${wo.carModel} - ${wo.customerName}</option>`;
        });

        const btn = document.getElementById('arrival-alert-btn');
        btn.disabled = towingCars.length === 0;
    }

    // ========== HELPER FUNCTIONS ==========

    createQueueItem(workOrder) {
        return `
            <div class="queue-item">
                <div class="queue-item-title">${workOrder.carYear} ${workOrder.carMake} ${workOrder.carModel}</div>
                <div class="queue-item-details">
                    <p><strong>Customer:</strong> ${workOrder.customerName}</p>
                    <p><strong>From:</strong> ${workOrder.towLocation}</p>
                    <p><strong>Difficulty:</strong> ${workOrder.jobDifficulty} | <strong>Urgency:</strong> ${workOrder.jobUrgency}</p>
                    ${workOrder.towEta ? `<p><strong>ETA:</strong> ${workOrder.towEta}</p>` : ''}
                </div>
            </div>
        `;
    }

    getTechName(techId) {
        const tech = this.technicians.find(t => t.id === techId);
        return tech ? tech.name : 'Unknown';
    }

    getJobDetails(jobId) {
        const job = this.workOrders.find(wo => wo.id === jobId);
        return job ? `${job.carYear} ${job.carMake} ${job.carModel}` : 'Unknown';
    }

    formatReason(reason) {
        const reasons = {
            breakdown: 'Breakdown',
            accident: 'Accident',
            maintenance: 'Maintenance',
            inspection: 'Inspection',
            other: 'Other'
        };
        return reasons[reason] || reason;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showNotification(title, message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border-left: 4px solid var(--success-color);
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        notification.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: var(--text-primary);">${title}</h4>
            <p style="margin: 0; color: var(--text-secondary);">${message}</p>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
}

// Modal functions
function openTechModal() {
    document.getElementById('tech-modal').classList.add('active');
}

function closeTechModal() {
    document.getElementById('tech-modal').classList.remove('active');
}

function openSettingsModal() {
    document.getElementById('settings-modal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
}

function openTowCompanyModal() {
    document.getElementById('tow-company-modal').classList.add('active');
}

function closeTowCompanyModal() {
    document.getElementById('tow-company-modal').classList.remove('active');
}

function closeCallTowModal() {
    document.getElementById('call-tow-modal').classList.remove('active');
}

function closeDangerousModal() {
    document.getElementById('dangerous-modal').classList.remove('active');
}

// Close modals when clicking outside
document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Add custom animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the system
const carTowingSystem = new CarTowingSystem();
