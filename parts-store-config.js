/**
 * Parts Store Configuration & Call Management
 * Configure which stores to call, in what order, and proper parts terminology
 */

class PartsStoreConfig {
    constructor() {
        this.defaultConfig = {
            stores: [
                {
                    id: 'autozone',
                    name: 'AutoZone',
                    phone: '1-800-288-6966',
                    priority: 1,
                    enabled: true,
                    localPhone: '', // Shop can add local store number
                    accountNumber: ''
                },
                {
                    id: 'napa',
                    name: 'NAPA Auto Parts',
                    phone: '1-877-627-2872',
                    priority: 2,
                    enabled: true,
                    localPhone: '',
                    accountNumber: ''
                },
                {
                    id: 'oreilly',
                    name: "O'Reilly Auto Parts",
                    phone: '1-800-755-6759',
                    priority: 3,
                    enabled: true,
                    localPhone: '',
                    accountNumber: ''
                },
                {
                    id: 'advance',
                    name: 'Advance Auto Parts',
                    phone: '1-877-238-2623',
                    priority: 4,
                    enabled: false,
                    localPhone: '',
                    accountNumber: ''
                },
                {
                    id: 'rockauto',
                    name: 'RockAuto',
                    phone: '1-866-762-5288',
                    priority: 5,
                    enabled: false,
                    localPhone: '',
                    accountNumber: ''
                }
            ],
            
            // Proper automotive parts terminology
            partsTerminology: {
                // Common misspellings/variations → Correct professional term
                'cv axle': 'CV Axle Assembly',
                'cv joint': 'CV Joint Boot Kit',
                'drive axle': 'CV Axle Assembly',
                'axle': 'CV Axle Assembly',
                
                'brake pad': 'Disc Brake Pad Set',
                'brake pads': 'Disc Brake Pad Set',
                'pads': 'Disc Brake Pad Set',
                
                'brake rotor': 'Disc Brake Rotor',
                'rotors': 'Disc Brake Rotor',
                
                'oil filter': 'Engine Oil Filter',
                'oil': '5 Quarts Motor Oil',
                
                'air filter': 'Engine Air Filter',
                'cabin filter': 'Cabin Air Filter',
                
                'spark plug': 'Spark Plug Set',
                'plugs': 'Spark Plug Set',
                
                'battery': 'Automotive Battery',
                
                'alternator': 'Alternator',
                'starter': 'Starter Motor',
                
                'water pump': 'Engine Water Pump',
                'thermostat': 'Engine Coolant Thermostat',
                
                'serpentine belt': 'Serpentine Belt',
                'drive belt': 'Serpentine Belt',
                
                'timing belt': 'Timing Belt Kit',
                'timing chain': 'Timing Chain Kit',
                
                'fuel pump': 'Electric Fuel Pump',
                'fuel filter': 'Fuel Filter',
                
                'oxygen sensor': 'Oxygen Sensor',
                'o2 sensor': 'Oxygen Sensor',
                
                'catalytic converter': 'Catalytic Converter',
                'cat converter': 'Catalytic Converter',
                
                'muffler': 'Exhaust Muffler',
                'exhaust': 'Exhaust System Component',
                
                'strut': 'Front Strut Assembly',
                'shock': 'Rear Shock Absorber',
                
                'tie rod': 'Tie Rod End',
                'ball joint': 'Ball Joint',
                'control arm': 'Control Arm',
                
                'wheel bearing': 'Wheel Hub Bearing Assembly',
                'hub bearing': 'Wheel Hub Bearing Assembly'
            },
            
            // Vehicle-specific terminology
            vehicleSpecific: {
                'front': 'Front',
                'rear': 'Rear',
                'left': 'Driver Side',
                'right': 'Passenger Side',
                'driver': 'Driver Side',
                'passenger': 'Passenger Side',
                'upper': 'Upper',
                'lower': 'Lower',
                'inner': 'Inner',
                'outer': 'Outer'
            },
            
            // Call script template
            callScript: {
                greeting: "Hi, this is {shopName}. I need to check pricing and availability on a part.",
                vehicleInfo: "It's for a {year} {make} {model}.",
                partRequest: "I need a {partName} for the {location}.",
                questions: [
                    "What's your best price on that?",
                    "Do you have it in stock?",
                    "How long to get it if you need to order?",
                    "Is there a core charge?"
                ],
                closing: "Great, thank you. I'll call back if we need it."
            }
        };
    }

    initialize() {
        // Load saved config or use defaults
        const saved = localStorage.getItem('partsStoreConfig');
        this.config = saved ? JSON.parse(saved) : this.defaultConfig;
        console.log('✅ Parts Store Config loaded');
    }

    saveConfig() {
        localStorage.setItem('partsStoreConfig', JSON.stringify(this.config));
    }

    getEnabledStores() {
        return this.config.stores
            .filter(s => s.enabled)
            .sort((a, b) => a.priority - b.priority);
    }

    translatePartName(userInput) {
        const lower = userInput.toLowerCase();
        
        // Check terminology dictionary
        for (const [key, value] of Object.entries(this.config.partsTerminology)) {
            if (lower.includes(key)) {
                return value;
            }
        }
        
        // Return original if no match
        return userInput;
    }

    parseLocation(userInput) {
        const lower = userInput.toLowerCase();
        let location = '';
        
        // Check for position indicators
        for (const [key, value] of Object.entries(this.config.vehicleSpecific)) {
            if (lower.includes(key)) {
                location += value + ' ';
            }
        }
        
        return location.trim() || 'Standard';
    }

    buildCallScript(partDescription, vehicle) {
        const settings = JSON.parse(localStorage.getItem('shopSettings') || '{}');
        const shopName = settings.shopName || 'the shop';
        
        const partName = this.translatePartName(partDescription);
        const location = this.parseLocation(partDescription);
        
        const script = {
            greeting: this.config.callScript.greeting.replace('{shopName}', shopName),
            vehicleInfo: this.config.callScript.vehicleInfo
                .replace('{year}', vehicle.year)
                .replace('{make}', vehicle.make)
                .replace('{model}', vehicle.model),
            partRequest: this.config.callScript.partRequest
                .replace('{partName}', partName)
                .replace('{location}', location),
            questions: this.config.callScript.questions,
            closing: this.config.callScript.closing
        };
        
        return script;
    }

    showConfigEditor() {
        const modal = document.createElement('div');
        modal.className = 'parts-config-modal';
        modal.innerHTML = `
            <div class="modal-content large">
                <h2>⚙️ Parts Store Configuration</h2>
                
                <div class="config-section">
                    <h3>Store Priority & Settings</h3>
                    <p>Drag to reorder, toggle to enable/disable</p>
                    <div id="stores-list">
                        ${this.config.stores.map((store, index) => `
                            <div class="store-config-row" data-store-id="${store.id}">
                                <input type="checkbox" ${store.enabled ? 'checked' : ''} 
                                       onchange="window.partsStoreConfig.toggleStore('${store.id}')">
                                <span class="priority">#${store.priority}</span>
                                <strong>${store.name}</strong>
                                <input type="tel" placeholder="Local phone" value="${store.localPhone || ''}"
                                       onchange="window.partsStoreConfig.updateStorePhone('${store.id}', this.value)">
                                <input type="text" placeholder="Account #" value="${store.accountNumber || ''}"
                                       onchange="window.partsStoreConfig.updateStoreAccount('${store.id}', this.value)">
                                <button onclick="window.partsStoreConfig.moveStoreUp(${index})">↑</button>
                                <button onclick="window.partsStoreConfig.moveStoreDown(${index})">↓</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="config-section">
                    <h3>Test Call Script</h3>
                    <button onclick="window.partsStoreConfig.testCallScript()" class="btn">
                        📞 Preview Call Script
                    </button>
                </div>
                
                <div class="modal-actions">
                    <button onclick="window.partsStoreConfig.closeConfigEditor()">Close</button>
                    <button onclick="window.partsStoreConfig.saveAndClose()" class="btn-primary">Save Settings</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    toggleStore(storeId) {
        const store = this.config.stores.find(s => s.id === storeId);
        if (store) {
            store.enabled = !store.enabled;
        }
    }

    updateStorePhone(storeId, phone) {
        const store = this.config.stores.find(s => s.id === storeId);
        if (store) {
            store.localPhone = phone;
        }
    }

    updateStoreAccount(storeId, account) {
        const store = this.config.stores.find(s => s.id === storeId);
        if (store) {
            store.accountNumber = account;
        }
    }

    moveStoreUp(index) {
        if (index > 0) {
            const temp = this.config.stores[index];
            this.config.stores[index] = this.config.stores[index - 1];
            this.config.stores[index - 1] = temp;
            
            // Update priorities
            this.config.stores.forEach((s, i) => s.priority = i + 1);
            this.showConfigEditor();
        }
    }

    moveStoreDown(index) {
        if (index < this.config.stores.length - 1) {
            const temp = this.config.stores[index];
            this.config.stores[index] = this.config.stores[index + 1];
            this.config.stores[index + 1] = temp;
            
            // Update priorities
            this.config.stores.forEach((s, i) => s.priority = i + 1);
            this.showConfigEditor();
        }
    }

    testCallScript() {
        const script = this.buildCallScript('left front cv axle', {
            year: '1999',
            make: 'Kia',
            model: 'Sportage'
        });
        
        const fullScript = `
${script.greeting}

${script.vehicleInfo}

${script.partRequest}

${script.questions.join('\n')}

${script.closing}
        `;
        
        alert('📞 Call Script Preview:\n\n' + fullScript);
    }

    saveAndClose() {
        this.saveConfig();
        this.closeConfigEditor();
        alert('✅ Parts store settings saved!');
    }

    closeConfigEditor() {
        const modal = document.querySelector('.parts-config-modal');
        if (modal) modal.remove();
    }
}

// Initialize
window.partsStoreConfig = new PartsStoreConfig();
window.partsStoreConfig.initialize();

console.log('✅ Parts Store Config system loaded');