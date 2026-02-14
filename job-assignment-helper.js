// Job Assignment Helper
// Automatically assigns jobs to technicians based on skill requirements and availability

class JobAssignmentHelper {
    constructor(techService) {
        this.techService = techService;
    }

    /**
     * Assign a job to the best available technician
     * This is the main function that service advisors would use
     */
    assignJob(jobDetails) {
        const {
            laborOperation,
            skillLevelRequired,
            specialty,
            forceTechId = null,
            vehicleInfo = null
        } = jobDetails;

        // If a specific tech is forced, validate they can handle it
        if (forceTechId) {
            const canHandle = this.techService.canTechHandleJob(
                forceTechId,
                skillLevelRequired,
                specialty
            );

            if (!canHandle) {
                throw new Error(`Technician does not have the required skill level (${skillLevelRequired}) for this job`);
            }

            return this.assignToTech(forceTechId, jobDetails);
        }

        // Auto-assign to best available tech
        const bestTech = this.techService.getBestAvailableTech(skillLevelRequired, specialty);

        if (!bestTech) {
            return {
                success: false,
                message: 'No available technicians with required skill level',
                recommendedTechs: this.techService.getRecommendedTechsForJob(skillLevelRequired, specialty)
            };
        }

        return this.assignToTech(bestTech.id, jobDetails);
    }

    /**
     * Assign job to a specific technician and start tracking hours
     */
    assignToTech(techId, jobDetails) {
        const {
            jobId,
            jobIdType = 'vehicle',
            description
        } = jobDetails;

        // Start tracking hours for this job
        const jobEntry = this.techService.startJob(techId, jobId, jobIdType);

        return {
            success: true,
            technicianId: techId,
            jobId: jobEntry.jobId,
            startTime: jobEntry.startTime,
            message: 'Job assigned successfully'
        };
    }

    /**
     * Get assignment recommendations for a job
     * Shows all eligible technicians ranked by suitability
     */
    getAssignmentRecommendations(jobDetails) {
        const {
            skillLevelRequired,
            specialty
        } = jobDetails;

        const recommendedTechs = this.techService.getRecommendedTechsForJob(
            skillLevelRequired,
            specialty
        );

        // Add additional info for each tech
        return recommendedTechs.map(tech => {
            const todayHours = this.techService.getTechHoursToday(tech.id);
            const activeJob = this.techService.getTechActiveJob(tech.id);

            return {
                ...tech,
                todayHours: todayHours.totalHours,
                isAvailable: activeJob === null,
                currentJob: activeJob,
                recommendationScore: this.calculateRecommendationScore(tech, skillLevelRequired, todayHours.totalHours)
            };
        }).sort((a, b) => b.recommendationScore - a.recommendationScore);
    }

    /**
     * Calculate a recommendation score for a technician
     * Higher score = better match
     */
    calculateRecommendationScore(tech, skillLevelRequired, todayHours) {
        const skillMatch = this.getSkillMatchBonus(tech.id, skillLevelRequired);
        
        // Prefer techs with fewer hours today (load balancing)
        const hoursBalance = Math.max(0, 10 - todayHours); // 10 bonus points if 0 hours, 0 if 10+ hours
        
        // Availability bonus
        const isActive = this.techService.getTechActiveJob(tech.id) === null ? 5 : 0;

        return skillMatch + hoursBalance + isActive;
    }

    /**
     * Get skill match bonus
     * Perfect skill match gets higher bonus
     */
    getSkillMatchBonus(techId, skillLevelRequired) {
        const tech = this.techService.getTechnicianById(techId, true);
        if (!tech) return 0;

        const ratingValue = { 'A': 3, 'B': 2, 'C': 1 };
        const requiredValue = { 'A': 3, 'B': 2, 'C': 1 };

        const techValue = ratingValue[tech.skillRating];
        const requiredValue = requiredValue[skillLevelRequired];

        if (techValue >= requiredValue) {
            // Tech is qualified - give bonus based on how well matched they are
            // Exact match gets highest bonus, overqualified gets slightly less
            if (techValue === requiredValue) {
                return 15; // Perfect match
            } else {
                return 10; // Overqualified (still good)
            }
        }

        return 0; // Not qualified
    }

    /**
     * Validate if a job assignment is appropriate
     */
    validateAssignment(techId, jobDetails) {
        const {
            skillLevelRequired,
            specialty
        } = jobDetails;

        const tech = this.techService.getTechnicianById(techId, true);
        if (!tech) {
            return {
                valid: false,
                reason: 'Technician not found'
            };
        }

        if (!tech.isActive) {
            return {
                valid: false,
                reason: 'Technician is inactive'
            };
        }

        const canHandle = this.techService.canTechHandleJob(techId, skillLevelRequired, specialty);
        if (!canHandle) {
            return {
                valid: false,
                reason: `Technician skill level (${tech.skillRating}) is insufficient for this job (requires ${skillLevelRequired})`
            };
        }

        const activeJob = this.techService.getTechActiveJob(techId);
        if (activeJob) {
            return {
                valid: false,
                reason: 'Technician is currently working on another job',
                currentJob: activeJob
            };
        }

        return {
            valid: true,
            technician: tech
        };
    }

    /**
     * Get job assignment rules for display
     */
    getAssignmentRules() {
        return {
            skillLevelRules: {
                'A': {
                    label: 'Expert Level',
                    description: 'Can handle any job including complex diagnostics',
                    canHandle: ['diagnostic', 'engine_repair', 'transmission', 'electrical', 'brakes', 'suspension', 'ac', 'oil_change', 'tire_rotation', 'basic_maintenance'],
                    technicianRatings: ['A']
                },
                'B': {
                    label: 'Advanced Level',
                    description: 'Can handle most repairs, but not complex diagnostics',
                    canHandle: ['brakes', 'suspension', 'ac', 'oil_change', 'tire_rotation', 'basic_maintenance'],
                    technicianRatings: ['A', 'B']
                },
                'C': {
                    label: 'Basic Level',
                    description: 'Basic maintenance only',
                    canHandle: ['oil_change', 'tire_rotation', 'basic_maintenance'],
                    technicianRatings: ['A', 'B', 'C']
                }
            },
            assignmentPriorities: [
                '1. Skill level match (must meet or exceed requirement)',
                '2. Specialty match (if required)',
                '3. Current availability',
                '4. Load balancing (prefer techs with fewer hours today)'
            ]
        };
    }

    /**
     * Batch assign multiple jobs
     * Useful for morning job distribution
     */
    batchAssignJobs(jobs) {
        const results = [];
        const assignedTechIds = new Set();

        for (const job of jobs) {
            try {
                // Try to assign to a tech who hasn't been assigned yet (load balancing)
                const availableTechs = this.techService.getRecommendedTechsForJob(
                    job.skillLevelRequired,
                    job.specialty
                ).filter(tech => 
                    !assignedTechIds.has(tech.id) &&
                    this.techService.getTechActiveJob(tech.id) === null
                );

                let result;
                if (availableTechs.length > 0) {
                    result = this.assignJob({
                        ...job,
                        forceTechId: availableTechs[0].id
                    });
                } else {
                    result = this.assignJob(job);
                }

                if (result.success) {
                    assignedTechIds.add(result.technicianId);
                }

                results.push({
                    job,
                    result
                });
            } catch (error) {
                results.push({
                    job,
                    result: {
                        success: false,
                        error: error.message
                    }
                });
            }
        }

        return results;
    }

    /**
     * Get real-time technician availability status
     */
    getTechAvailability() {
        const techs = this.techService.getActiveTechnicians(true);
        
        return techs.map(tech => {
            const todayHours = this.techService.getTechHoursToday(tech.id);
            const activeJob = this.techService.getTechActiveJob(tech.id);

            return {
                id: tech.id,
                name: tech.name,
                skillRating: tech.skillRating,
                specialties: tech.specialties,
                isActive: tech.isActive,
                isAvailable: activeJob === null,
                todayHours: todayHours.totalHours,
                currentJob: activeJob,
                canHandleDiag: tech.skillRating === 'A',
                canHandleAdvanced: ['A', 'B'].includes(tech.skillRating),
                canHandleBasic: ['A', 'B', 'C'].includes(tech.skillRating)
            };
        }).sort((a, b) => {
            // Sort by availability first, then skill level
            if (a.isAvailable && !b.isAvailable) return -1;
            if (!a.isAvailable && b.isAvailable) return 1;
            
            const ratingOrder = { 'A': 1, 'B': 2, 'C': 3 };
            return ratingOrder[a.skillRating] - ratingOrder[b.skillRating];
        });
    }
}

// Export for use in other files
// 

}