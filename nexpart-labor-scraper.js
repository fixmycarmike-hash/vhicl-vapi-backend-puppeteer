/**
 * Nexpart Labor Guide Scraper
 * Scrapes labor times from Nexpart ACES catalog
 * FREE labor guide for all makes and models
 */

const puppeteer = require('puppeteer');

class NexpartLaborScraper {
    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.acesUrl = 'https://www.nexpart.com/acesCat.php';
        console.log('🔧 Nexpart Labor Scraper initialized');
    }

    /**
     * Search for labor operation time
     */
    async getLaborTime(year, make, model, operation) {
        console.log(`🔍 Searching Nexpart for labor: ${operation} - ${year} ${make} ${model}`);
        
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

            // Step 3: Select vehicle
            console.log('🚗 Selecting vehicle...');
            await this.selectVehicle(page, year, make, model);

            // Step 4: Search for operation
            console.log('🔎 Searching for operation...');
            const laborData = await this.searchOperation(page, operation);

            console.log(`✅ Found labor time: ${laborData.hours} hours`);
            
            return {
                success: true,
                labor: laborData,
                vehicle: `${year} ${make} ${model}`,
                operation: operation
            };

        } catch (error) {
            console.error('❌ Error getting labor time:', error);
            return {
                success: false,
                error: error.message,
                labor: null
            };
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Login to Nexpart
     */
    async login(page) {
        try {
            // Check if already logged in
            const loggedIn = await page.$('.logout-button, .user-info');
            if (loggedIn) {
                console.log('✓ Already logged in');
                return;
            }

            // Wait for login form
            await page.waitForSelector('input[name="username"], input[name="user"], #username', { timeout: 10000 });

            // Enter username
            await page.type('input[name="username"], input[name="user"], #username', this.username);
            
            // Enter password
            await page.type('input[name="password"], input[name="pass"], #password', this.password);
            
            // Click login
            await page.click('button[type="submit"], input[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
            
            console.log('✓ Logged in successfully');
        } catch (error) {
            console.error('Login error:', error.message);
            throw error;
        }
    }

    /**
     * Select vehicle (year, make, model)
     */
    async selectVehicle(page, year, make, model) {
        try {
            // Select year
            await page.select('#year, select[name="year"]', year.toString());
            
            // Wait for makes to load
            await page.waitForTimeout(1000);
            
            // Select make
            await page.select('#make, select[name="make"]', make);
            
            // Wait for models to load
            await page.waitForTimeout(1000);
            
            // Select model
            await page.select('#model, select[name="model"]', model);
            
            // Submit vehicle selection
            await page.click('button[type="submit"], .submit-button');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
            
            console.log(`✓ Selected vehicle: ${year} ${make} ${model}`);
        } catch (error) {
            console.error('Vehicle selection error:', error.message);
            throw error;
        }
    }

    /**
     * Search for specific operation
     */
    async searchOperation(page, operation) {
        try {
            // Search in labor section
            await page.waitForSelector('.labor-section, #labor-guide', { timeout: 10000 });
            
            // Search for operation text
            const operationText = operation.toLowerCase();
            
            // Look for labor operations
            const operations = await page.evaluate((op) => {
                const laborItems = document.querySelectorAll('.labor-item, .operation-item, tr');
                for (const item of laborItems) {
                    const text = item.textContent.toLowerCase();
                    if (text.includes(op)) {
                        // Try to extract hours from the item
                        const hoursMatch = text.match(/(\d+\.?\d*)\s*hours?|(\d+\.?\d*)\s*hrs?/i);
                        if (hoursMatch) {
                            const hours = parseFloat(hoursMatch[1] || hoursMatch[2]);
                            return {
                                hours: hours,
                                operation: item.textContent.trim(),
                                source: 'Nexpart ACES'
                            };
                        }
                    }
                }
                return null;
            }, operationText);

            if (operations) {
                return operations;
            }

            // If no exact match, try to find closest match
            return await page.evaluate((op) => {
                const laborItems = document.querySelectorAll('.labor-item, .operation-item, tr');
                let bestMatch = null;
                let bestScore = 0;

                for (const item of laborItems) {
                    const text = item.textContent.toLowerCase();
                    const score = op.split(' ').filter(word => text.includes(word)).length;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        const hoursMatch = text.match(/(\d+\.?\d*)\s*hours?|(\d+\.?\d*)\s*hrs?/i);
                        if (hoursMatch) {
                            bestMatch = {
                                hours: parseFloat(hoursMatch[1] || hoursMatch[2]),
                                operation: item.textContent.trim(),
                                source: 'Nexpart ACES',
                                matchScore: score
                            };
                        }
                    }
                }

                return bestMatch;
            }, operationText);

        } catch (error) {
            console.error('Operation search error:', error.message);
            return {
                hours: 0,
                operation: operation,
                source: 'Nexpart ACES',
                error: error.message
            };
        }
    }

    /**
     * Get all labor operations for a vehicle
     */
    async getAllLaborOperations(year, make, model) {
        console.log(`🔍 Getting all labor operations for: ${year} ${make} ${model}`);
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            
            await page.goto(this.acesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.login(page);
            await this.selectVehicle(page, year, make, model);

            // Get all operations
            const operations = await page.evaluate(() => {
                const laborItems = document.querySelectorAll('.labor-item, .operation-item, tr');
                const results = [];
                
                for (const item of laborItems) {
                    const text = item.textContent.trim();
                    const hoursMatch = text.match(/(\d+\.?\d*)\s*hours?|(\d+\.?\d*)\s*hrs?/i);
                    
                    if (hoursMatch) {
                        results.push({
                            operation: text,
                            hours: parseFloat(hoursMatch[1] || hoursMatch[2]),
                            source: 'Nexpart ACES'
                        });
                    }
                }

                return results;
            });

            console.log(`✅ Found ${operations.length} labor operations`);
            
            return {
                success: true,
                operations: operations,
                vehicle: `${year} ${make} ${model}`
            };

        } catch (error) {
            console.error('❌ Error getting all operations:', error);
            return {
                success: false,
                error: error.message,
                operations: []
            };
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

module.exports = NexpartLaborScraper;