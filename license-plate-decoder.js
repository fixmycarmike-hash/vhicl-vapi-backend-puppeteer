/**
 * License Plate Decoder Service
 * Automatically retrieves vehicle information from license plate numbers
 * 
 * Uses free APIs to decode license plates:
 * - US: Plaque API (free tier)
 * - UK: DVLA API
 * 
 * CRITICAL: NO MOCK DATA - Real data only!
 */

class LicensePlateDecoder {
    constructor() {
        // API endpoints
        this.usApiUrl = 'https://plaques-api.p.rapidapi.com/v1/plates';
        this.apiKey = process.env.RAPIDAPI_KEY || '';
        
        // Cache for decoded plates
        this.plateCache = new Map();
    }

    /**
     * Decode a US license plate
     * @param {string} plateNumber - License plate number
     * @param {string} state - State code (e.g., 'CA', 'TX')
     * @returns {Promise<Object>} Vehicle information
     */
    async decodeUSPlate(plateNumber, state = 'CA') {
        const cacheKey = `us_${plateNumber}_${state}`;
        
        // Check cache first
        if (this.plateCache.has(cacheKey)) {
            return this.plateCache.get(cacheKey);
        }

        // Require API key - NO MOCK DATA
        if (!this.apiKey) {
            throw new Error('RapidAPI key required. Please add RAPIDAPI_KEY to environment variables.');
        }

        try {
            // Call Plaque API
            const response = await fetch(`${this.usApiUrl}/${state}/${plateNumber}`, {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': this.apiKey,
                    'X-RapidAPI-Host': 'plaques-api.p.rapidapi.com'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Format the response
            const vehicleInfo = {
                plate: plateNumber,
                state: state,
                vin: data.vin || null,
                make: data.make || null,
                model: data.model || null,
                year: data.year || null,
                color: data.color || null,
                bodyType: data.bodyType || null,
                engine: data.engine || null,
                fuelType: data.fuelType || null,
                transmission: data.transmission || null,
                driveType: data.driveType || null,
                registrationDate: data.registrationDate || null,
                expiryDate: data.expiryDate || null,
                ownerName: data.ownerName || null,
                decodedAt: new Date().toISOString(),
                source: 'plaque-api'
            };

            // Cache the result
            this.plateCache.set(cacheKey, vehicleInfo);

            return vehicleInfo;

        } catch (error) {
            console.error('Error decoding US plate:', error);
            // NO MOCK DATA - Return error
            throw new Error(`Failed to decode license plate: ${error.message}`);
        }
    }

    /**
     * Decode a UK license plate
     * @param {string} plateNumber - UK registration number
     * @returns {Promise<Object>} Vehicle information
     */
    async decodeUKPlate(plateNumber) {
        const cacheKey = `uk_${plateNumber}`;
        
        // Check cache first
        if (this.plateCache.has(cacheKey)) {
            return this.plateCache.get(cacheKey);
        }

        // UK DVLA API - TODO: Implement
        throw new Error('UK license plate decoding not yet implemented. Please use US plates or VIN decoding.');

        // Future implementation:
        // const response = await fetch(`https://uk1.ukvehicledata.co.uk/api/datapackage/VehicleData?v=${plateNumber}&api_nullitems=1&key_api=${this.ukApiKey}`);
        // ...
    }

    /**
     * Generic decode function - auto-detects country based on format
     * @param {string} plateNumber - License plate number
     * @param {string} country - Country code (optional)
     * @returns {Promise<Object>} Vehicle information
     */
    async decodePlate(plateNumber, country = null) {
        // Clean the plate number
        const cleanPlate = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Auto-detect country if not provided
        if (!country) {
            country = this.detectCountry(cleanPlate);
        }

        // Route to appropriate decoder
        switch (country.toLowerCase()) {
            case 'us':
            case 'usa':
                return await this.decodeUSPlate(cleanPlate);
            case 'uk':
                return await this.decodeUKPlate(cleanPlate);
            default:
                return await this.decodeUSPlate(cleanPlate);
        }
    }

    /**
     * Detect country based on plate format
     * @param {string} plateNumber - Cleaned plate number
     * @returns {string} Country code
     */
    detectCountry(plateNumber) {
        // UK plates: 2 letters + 2 numbers + 3 letters (e.g., AB12 CDE)
        if (/^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(plateNumber)) {
            return 'UK';
        }
        
        // Default to US
        return 'US';
    }

    /**
     * Format vehicle information for display
     * @param {Object} vehicleInfo - Vehicle information object
     * @returns {string} Formatted string
     */
    formatVehicleInfo(vehicleInfo) {
        if (!vehicleInfo) {
            return 'No vehicle information available';
        }

        const parts = [];
        
        if (vehicleInfo.year) parts.push(vehicleInfo.year);
        if (vehicleInfo.make) parts.push(vehicleInfo.make);
        if (vehicleInfo.model) parts.push(vehicleInfo.model);
        if (vehicleInfo.color) parts.push(`(${vehicleInfo.color})`);
        if (vehicleInfo.plate) parts.push(`Plate: ${vehicleInfo.plate}`);
        
        return parts.join(' ') || 'Vehicle information not available';
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.plateCache.clear();
        console.log('License plate cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            totalEntries: this.plateCache.size,
            entries: Array.from(this.plateCache.keys())
        };
    }
}

module.exports = LicensePlateDecoder;