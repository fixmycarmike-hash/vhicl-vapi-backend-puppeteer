/**
 * Nexpart VIN Decoder & Vehicle Lookup Service
 * Decodes VINs and retrieves vehicle information from Nexpart
 * 
 * Uses Nexpart's ACES catalog for accurate vehicle identification
 */

const puppeteer = require('puppeteer');

class NexpartVINDecoder {
    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.baseUrl = 'https://www.nexpart.com';
        this.acesUrl = 'https://www.nexpart.com/acesCat.php';
        console.log('🔍 Nexpart VIN Decoder initialized');
    }

    /**
     * Decode VIN and get vehicle information
     * @param {string} vin - Vehicle Identification Number
     * @returns {Promise<Object>} Vehicle information
     */
    async decodeVIN(vin) {
        console.log(`🔍 Decoding VIN: ${vin}`);
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            
            // Step 1: Navigate to ACES catalog
            console.log('🌐 Navigating to Nexpart ACES catalog...');
            await page.goto(this.acesUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // Step 2: Login if needed
            console.log('🔐 Logging in...');
            await this.login(page);

            // Step 3: Enter VIN
            console.log('🔎 Looking up VIN...');
            const vehicleInfo = await this.lookupByVIN(page, vin);

            if (vehicleInfo) {
                console.log(`✅ VIN decoded: ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`);
                return {
                    success: true,
                    vehicle: vehicleInfo,
                    vin: vin,
                    source: 'Nexpart ACES',
                    decodedAt: new Date().toISOString()
                };
            } else {
                return {
                    success: false,
                    error: 'VIN not found in Nexpart database',
                    vin: vin,
                    source: 'Nexpart ACES'
                };
            }

        } catch (error) {
            console.error('❌ Error decoding VIN:', error);
            return {
                success: false,
                error: error.message,
                vin: vin,
                source: 'Nexpart ACES'
            };
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Lookup vehicle by VIN
     */
    async lookupByVIN(page, vin) {
        try {
            // Look for VIN input field
            const vinSelectors = [
                'input[name="vin"]',
                'input[id="vin"]',
                'input[placeholder*="VIN"]',
                'input[type="text"][maxlength="17"]'
            ];

            let vinField = null;
            for (const selector of vinSelectors) {
                try {
                    vinField = await page.$(selector);
                    if (vinField) {
                        console.log(`Found VIN field: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!vinField) {
                throw new Error('Could not find VIN input field');
            }

            // Enter VIN
            await page.type(selector, vin);
            
            // Look for VIN lookup/submit button
            const lookupButtonSelectors = [
                'button:contains("Lookup VIN")',
                'button:contains("Decode VIN")',
                'button[type="submit"]',
                'input[type="submit"]',
                '.vin-lookup-button',
                '#vin-lookup'
            ];

            // Click lookup button
            await page.click(lookupButtonSelectors[0]);
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });

            // Extract vehicle information
            const vehicleInfo = await page.evaluate(() => {
                const year = document.querySelector('#year, select[name="year"]')?.value || '';
                const make = document.querySelector('#make, select[name="make"]')?.value || '';
                const model = document.querySelector('#model, select[name="model"]')?.value || '';
                const engine = document.querySelector('#engine, select[name="engine"]')?.value || '';
                const trim = document.querySelector('#trim, select[name="trim"]')?.value || '';
                const bodyType = document.querySelector('#bodyType, select[name="bodyType"]')?.value || '';
                const driveType = document.querySelector('#driveType, select[name="driveType"]')?.value || '';
                const transmission = document.querySelector('#transmission, select[name="transmission"]')?.value || '';
                const fuelType = document.querySelector('#fuelType, select[name="fuelType"]')?.value || '';

                return {
                    year: year ? parseInt(year) : null,
                    make: make || 'Unknown',
                    model: model || 'Unknown',
                    engine: engine || 'Unknown',
                    trim: trim || 'Unknown',
                    bodyType: bodyType || 'Unknown',
                    driveType: driveType || 'Unknown',
                    transmission: transmission || 'Unknown',
                    fuelType: fuelType || 'Unknown'
                };
            });

            return vehicleInfo;

        } catch (error) {
            console.error('VIN lookup error:', error.message);
            return null;
        }
    }

    /**
     * Login to Nexpart
     */
    async login(page) {
        try {
            // Check if already logged in
            const loggedIn = await page.$('.logout-button, .user-info, [data-logged-in="true"]');
            if (loggedIn) {
                console.log('✓ Already logged in');
                return;
            }

            // Wait for login form
            await page.waitForSelector('input[name="username"], input[name="user"]', { timeout: 10000 });

            // Enter username
            await page.type('input[name="username"], input[name="user"]', this.username);
            
            // Enter password
            await page.type('input[name="password"], input[name="pass"]', this.password);
            
            // Click login
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
            
            console.log('✓ Logged in successfully');
        } catch (error) {
            console.error('Login error:', error.message);
            throw error;
        }
    }

    /**
     * Get all compatible vehicles for a make/model/year
     * Useful when you have partial vehicle info
     */
    async getCompatibleVehicles(year, make, model) {
        console.log(`🔍 Getting compatible vehicles: ${year} ${make} ${model}`);
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            
            await page.goto(this.acesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.login(page);

            // Select vehicle
            await page.select('#year, select[name="year"]', year.toString());
            await page.waitForTimeout(1000);
            await page.select('#make, select[name="make"]', make);
            await page.waitForTimeout(1000);
            await page.select('#model, select[name="model"]', model);
            await page.waitForTimeout(1000);

            // Get all engine options
            const engines = await page.evaluate(() => {
                const engineSelect = document.querySelector('#engine, select[name="engine"]');
                if (!engineSelect) return [];
                
                return Array.from(engineSelect.options).map(option => ({
                    value: option.value,
                    text: option.text
                }));
            });

            // Get all trim options
            const trims = await page.evaluate(() => {
                const trimSelect = document.querySelector('#trim, select[name="trim"]');
                if (!trimSelect) return [];
                
                return Array.from(trimSelect.options).map(option => ({
                    value: option.value,
                    text: option.text
                }));
            });

            browser.close();

            return {
                success: true,
                year: year,
                make: make,
                model: model,
                engines: engines,
                trims: trims,
                totalCombinations: engines.length * trims.length
            };

        } catch (error) {
            console.error('❌ Error getting compatible vehicles:', error);
            if (browser) await browser.close();
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate VIN checksum (optional validation)
     */
    static validateVIN(vin) {
        // VIN must be 17 characters
        if (!vin || vin.length !== 17) {
            return { valid: false, error: 'VIN must be 17 characters' };
        }

        // VIN should only contain alphanumeric characters (except I, O, Q)
        const validChars = /^[A-HJ-NPR-Z0-9]+$/;
        if (!validChars.test(vin)) {
            return { valid: false, error: 'VIN contains invalid characters' };
        }

        return { valid: true };
    }

    /**
     * Extract basic info from VIN (without API call)
     * Based on VIN structure (WMI, VDS, VIS)
     */
    static extractBasicInfo(vin) {
        const validation = NexpartVINDecoder.validateVIN(vin);
        if (!validation.valid) {
            return validation;
        }

        const wmi = vin.substring(0, 3); // World Manufacturer Identifier
        const vds = vin.substring(3, 9); // Vehicle Descriptor Section
        const vis = vin.substring(9, 17); // Vehicle Identifier Section

        const yearChar = vis.charAt(0); // 10th character = model year
        const plantCode = vis.charAt(1); // 11th character = plant code
        const serialNumber = vis.substring(2); // Last 6 digits = serial number

        // Year code mapping (standard)
        const yearCodes = {
            'A': 1980, 'B': 1981, 'C': 1982, 'D': 1983, 'E': 1984, 'F': 1985, 'G': 1986, 'H': 1987,
            'J': 1988, 'K': 1989, 'L': 1990, 'M': 1991, 'N': 1992, 'P': 1993, 'R': 1994, 'S': 1995,
            'T': 1996, 'V': 1997, 'W': 1998, 'X': 1999, 'Y': 2000, '1': 2001, '2': 2002, '3': 2003,
            '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009, 'A': 2010, 'B': 2011,
            'C': 2012, 'D': 2013, 'E': 2014, 'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
            'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025, 'T': 2026, 'V': 2027,
            'W': 2028, 'X': 2029, 'Y': 2030, '1': 2031, '2': 2032, '3': 2033, '4': 2034, '5': 2035,
            '6': 2036, '7': 2037, '8': 2038, '9': 2039
        };

        const estimatedYear = yearCodes[yearChar] || null;

        return {
            valid: true,
            wmi: wmi,
            vds: vds,
            vis: vis,
            estimatedYear: estimatedYear,
            plantCode: plantCode,
            serialNumber: serialNumber,
            region: wmi.charAt(0), // First char = region (1-5 = North America)
            note: 'Basic info extracted from VIN structure. Use decodeVIN() for full details.'
        };
    }
}

module.exports = NexpartVINDecoder;