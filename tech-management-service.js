// Technician Management Service
// Handles technician profiles, skill ratings, hours tracking, and job assignment logic

class TechManagementService {
    constructor() {
        this.technicians = JSON.parse(localStorage.getItem('vhicl_technicians') || '[]');
        this.techHours = JSON.parse(localStorage.getItem('vhicl_tech_hours') || '{}');
        this.laborGuideSkillLevels = this.loadLaborGuideSkillLevels();
    }

    // ==================== TECHNICIAN MANAGEMENT ====================

    /**
     * Create a new technician profile
     */
    createTechnician(techData) {
        const technician = {
            id: Date.now(),
            name: techData.name,
            email: techData.email,
            phone: techData.phone,
            skillRating: techData.skillRating, // 'A', 'B', or 'C' (HIDDEN from tech)
            specialties: techData.specialties || [],
            certifications: techData.certifications || [],
            hourlyRate: techData.hourlyRate || 0,
            isActive: true,
            createdAt: new Date().toISOString(),
            hiredDate: techData.hiredDate || new Date().toISOString()
        };

        this.technicians.push(technician);
        this.saveTechnicians();
        return technician;
    }

    /**
     * Get all technicians (without skill ratings for regular users)
     */
    getAllTechnicians(includeSkillRatings = false) {
        if (includeSkillRatings) {
            return this.technicians;
        }
        // Remove skill ratings for non-admin users
        return this.technicians.map(tech => {
            const { skillRating, ...techWithoutRating } = tech;
            return techWithoutRating;
        });
    }

    /**
     * Get active technicians only
     */
    getActiveTechnicians(includeSkillRatings = false) {
        return this.getAllTechnicians(includeSkillRatings).filter(tech => tech.isActive);
    }

    /**
     * Get technician by ID
     */
    getTechnicianById(techId, includeSkillRating = false) {
        const tech = this.technicians.find(t => t.id === techId);
        if (!tech) return null;

        if (includeSkillRating) {
            return tech;
        }
        const { skillRating, ...techWithoutRating } = tech;
        return techWithoutRating;
    }

    /**
     * Update technician profile
     */
    updateTechnician(techId, updates) {
        const index = this.technicians.findIndex(t => t.id === techId);
        if (index === -1) throw new Error('Technician not found');

        this.technicians[index] = {
            ...this.technicians[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.saveTechnicians();
        return this.technicians[index];
    }

    /**
     * Deactivate/activate technician
     */
    setTechnicianActive(techId, isActive) {
        return this.updateTechnician(techId, { isActive });
    }

    /**
     * Delete technician
     */
    deleteTechnician(techId) {
        this.technicians = this.technicians.filter(t => t.id !== techId);
        this.saveTechnicians();
    }

    // ==================== SKILL RATING MANAGEMENT ====================

    /**
     * Get technician skill rating (admin only)
     */
    getTechSkillRating(techId) {
        const tech = this.getTechnicianById(techId, true);
        return tech ? tech.skillRating : null;
    }

    /**
     * Set technician skill rating (admin only)
     */
    setTechSkillRating(techId, rating) {
        if (!['A', 'B', 'C'].includes(rating)) {
            throw new Error('Invalid skill rating. Must be A, B, or C');
        }
        return this.updateTechnician(techId, { skillRating: rating });
    }

    /**
     * Get technicians by skill rating (admin only)
     */
    getTechniciansBySkillRating(rating) {
        return this.technicians.filter(tech => tech.skillRating === rating && tech.isActive);
    }

    // ==================== HOURS TRACKING ====================

    /**
     * Start work on a job
     */
    startJob(techId, jobId, jobIdType = 'vehicle') {
        const today = this.getTodayKey();
        
        if (!this.techHours[today]) {
            this.techHours[today] = {};
        }

        if (!this.techHours[today][techId]) {
            this.techHours[today][techId] = {
                techId,
                date: today,
                jobs: [],
                totalHours: 0
            };
        }

        // Check if tech already has an active job
        const activeJob = this.techHours[today][techId].jobs.find(j => j.endTime === null);
        if (activeJob) {
            throw new Error('Technician already has an active job. Please end the current job first.');
        }

        const jobEntry = {
            jobId,
            jobIdType,
            startTime: new Date().toISOString(),
            endTime: null,
            hours: 0,
            description: ''
        };

        this.techHours[today][techId].jobs.push(jobEntry);
        this.saveTechHours();
        return jobEntry;
    }

    /**
     * End work on a job
     */
    endJob(techId, jobId, description = '') {
        const today = this.getTodayKey();
        
        if (!this.techHours[today] || !this.techHours[today][techId]) {
            throw new Error('No active jobs found for this technician today');
        }

        const jobEntry = this.techHours[today][techId].jobs.find(j => 
            j.jobId === jobId && j.endTime === null
        );

        if (!jobEntry) {
            throw new Error('Active job not found');
        }

        jobEntry.endTime = new Date().toISOString();
        jobEntry.hours = this.calculateHours(jobEntry.startTime, jobEntry.endTime);
        jobEntry.description = description;

        // Recalculate total hours for the day
        this.techHours[today][techId].totalHours = this.techHours[today][techId].jobs
            .reduce((sum, job) => sum + job.hours, 0);

        this.saveTechHours();
        return jobEntry;
    }

    /**
     * Get technician's hours for today
     */
    getTechHoursToday(techId) {
        const today = this.getTodayKey();
        if (!this.techHours[today] || !this.techHours[today][techId]) {
            return {
                totalHours: 0,
                jobs: []
            };
        }
        return this.techHours[today][techId];
    }

    /**
     * Get technician's hours for a date range (weekly report)
     */
    getTechHoursRange(techId, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const hours = [];

        for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
            const dateKey = this.formatDateKey(date);
            if (this.techHours[dateKey] && this.techHours[dateKey][techId]) {
                hours.push({
                    date: dateKey,
                    ...this.techHours[dateKey][techId]
                });
            }
        }

        const totalHours = hours.reduce((sum, day) => sum + day.totalHours, 0);
        
        return {
            techId,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            totalHours,
            dailyBreakdown: hours
        };
    }

    /**
     * Get all technicians' weekly hours summary
     */
    getAllTechsWeeklyHours(startDate, endDate) {
        const activeTechs = this.getActiveTechnicians(true);
        return activeTechs.map(tech => ({
            techId: tech.id,
            name: tech.name,
            skillRating: tech.skillRating,
            ...this.getTechHoursRange(tech.id, startDate, endDate)
        }));
    }

    /**
     * Get technician's active job (if any)
     */
    getTechActiveJob(techId) {
        const today = this.getTodayKey();
        if (!this.techHours[today] || !this.techHours[today][techId]) {
            return null;
        }

        return this.techHours[today][techId].jobs.find(j => j.endTime === null) || null;
    }

    // ==================== JOB ASSIGNMENT LOGIC ====================

    /**
     * Get recommended technicians for a job based on skill requirements
     */
    getRecommendedTechsForJob(laborGuideSkillLevel, specialty = null) {
        // Map labor guide skill levels to tech skill ratings
        const skillMapping = {
            'A': ['A'],      // Expert jobs only for A-rated techs
            'B': ['A', 'B'], // Advanced jobs for A and B techs
            'C': ['A', 'B', 'C'] // Basic jobs for all techs
        };

        const allowedRatings = skillMapping[laborGuideSkillLevel] || ['A', 'B', 'C'];
        
        let recommended = this.technicians.filter(tech => 
            tech.isActive && 
            allowedRatings.includes(tech.skillRating)
        );

        // If specialty is required, prioritize techs with that specialty
        if (specialty) {
            const specialtyTechs = recommended.filter(tech => 
                tech.specialties.includes(specialty)
            );
            if (specialtyTechs.length > 0) {
                recommended = specialtyTechs;
            }
        }

        // Sort by skill rating (A first), then by hours worked today (least first)
        recommended.sort((a, b) => {
            const ratingOrder = { 'A': 1, 'B': 2, 'C': 3 };
            const ratingDiff = ratingOrder[a.skillRating] - ratingOrder[b.skillRating];
            if (ratingDiff !== 0) return ratingDiff;

            const hoursA = this.getTechHoursToday(a.id).totalHours;
            const hoursB = this.getTechHoursToday(b.id).totalHours;
            return hoursA - hoursB;
        });

        // Remove skill ratings before returning (for non-admin users)
        return recommended.map(tech => {
            const { skillRating, ...techWithoutRating } = tech;
            return techWithoutRating;
        });
    }

    /**
     * Check if a technician can handle a specific job
     */
    canTechHandleJob(techId, laborGuideSkillLevel, specialty = null) {
        const tech = this.getTechnicianById(techId, true);
        if (!tech || !tech.isActive) return false;

        const skillMapping = {
            'A': ['A'],
            'B': ['A', 'B'],
            'C': ['A', 'B', 'C']
        };

        const allowedRatings = skillMapping[laborGuideSkillLevel] || ['A', 'B', 'C'];
        if (!allowedRatings.includes(tech.skillRating)) {
            return false;
        }

        if (specialty && !tech.specialties.includes(specialty)) {
            return false; // Tech doesn't have required specialty
        }

        return true;
    }

    /**
     * Get best available technician for a job
     */
    getBestAvailableTech(laborGuideSkillLevel, specialty = null) {
        const recommendedTechs = this.getRecommendedTechsForJob(laborGuideSkillLevel, specialty);
        
        // Filter out techs who are currently working on a job
        const availableTechs = recommendedTechs.filter(tech => {
            const activeJob = this.getTechActiveJob(tech.id);
            return activeJob === null;
        });

        return availableTechs.length > 0 ? availableTechs[0] : null;
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * Calculate hours between two ISO timestamps
     */
    calculateHours(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimals
    }

    /**
     * Get today's date as key (YYYY-MM-DD)
     */
    getTodayKey() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Format date as key (YYYY-MM-DD)
     */
    formatDateKey(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Load labor guide skill levels (would come from labor guide integration)
     */
    loadLaborGuideSkillLevels() {
        // This would be loaded from the labor guide API
        // For now, return sample data
        return {
            'diagnostic': 'A',
            'engine_repair': 'A',
            'transmission': 'A',
            'electrical': 'A',
            'brakes': 'B',
            'suspension': 'B',
            'ac': 'B',
            'oil_change': 'C',
            'tire_rotation': 'C',
            'basic_maintenance': 'C'
        };
    }

    /**
     * Get skill level required for a labor operation
     */
    getSkillLevelForOperation(operationCode) {
        return this.laborGuideSkillLevels[operationCode] || 'B'; // Default to B
    }

    /**
     * Save technicians to localStorage
     */
    saveTechnicians() {
        localStorage.setItem('vhicl_technicians', JSON.stringify(this.technicians));
    }

    /**
     * Save tech hours to localStorage
     */
    saveTechHours() {
        localStorage.setItem('vhicl_tech_hours', JSON.stringify(this.techHours));
    }
}

// Export for use in other files
// 

