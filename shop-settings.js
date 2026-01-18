/**
 * Shop Settings Management
 * - Store shop information
 * - Store API credentials
 * - Nexpart credentials
 * - Auto Labor Experts credentials
 */

// Shop settings storage key
const SHOP_SETTINGS_KEY = 'vhicl_shop_settings';

// Default shop settings
const DEFAULT_SETTINGS = {
    shopName: '',
    shopAddress: '',
    shopPhone: '',
    shopEmail: '',
    laborRate: 100,
    taxRate: 0.08, // 8% default
    partsLookup: {
        enabled: false,
        name: '',
        url: '',
        username: '',
        password: ''
    },
    laborGuide: {
        enabled: false,
        name: '',
        url: '',
        username: '',
        password: ''
    },
    // Legacy support (will be migrated)
    nexpart: {
        username: '',
        password: '',
        enabled: false
    },
    autoLabor: {
        email: '',
        password: '',
        enabled: false
    },
    performance: {
        enabled: true,
        vehicleWeight: null // Will be estimated if not provided
    },
    pricing: {
        partsMarkup: 30,           // 30% markup on parts
        diagnosticFee: 125,        // Standard diagnostic fee
        shopSuppliesFee: 5,        // 5% shop supplies fee
        environmentalFee: 3.50,    // Flat environmental fee
        minimumLabor: 50,          // Minimum labor charge
        oilChangePrice: 45,        // Oil change service
        brakeInspectionPrice: 0,   // Free brake inspection
        tireRotationPrice: 25,     // Tire rotation
        batteryTestPrice: 0,       // Free battery test
        multiPointPrice: 0         // Free multi-point inspection
    }
};

// Load shop settings
function loadShopSettings() {
    try {
        const stored = localStorage.getItem(SHOP_SETTINGS_KEY);
        if (stored) {
            const settings = JSON.parse(stored);
            // Deep merge with defaults to ensure all nested fields exist
            return {
                ...DEFAULT_SETTINGS,
                ...settings,
                nexpart: { ...DEFAULT_SETTINGS.nexpart, ...(settings.nexpart || {}) },
                autoLabor: { ...DEFAULT_SETTINGS.autoLabor, ...(settings.autoLabor || {}) },
                performance: { ...DEFAULT_SETTINGS.performance, ...(settings.performance || {}) }
            };
        }
    } catch (error) {
        console.error('Error loading shop settings:', error);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); // Return a copy
}

// Make it globally available
window.loadShopSettings = loadShopSettings;

// Save shop settings
function saveShopSettings(settings) {
    console.log('💾💾💾 saveShopSettings() CALLED with:', settings);
    try {
        const jsonString = JSON.stringify(settings);
        console.log('📝 JSON string to save:', jsonString);
        localStorage.setItem(SHOP_SETTINGS_KEY, jsonString);
        console.log('✅ localStorage.setItem() completed');
        
        // Verify it was saved
        const verify = localStorage.getItem(SHOP_SETTINGS_KEY);
        console.log('🔍 Verification - read back from localStorage:', verify);
        
        return true;
    } catch (error) {
        console.error('❌ Error saving shop settings:', error);
        return false;
    }
}

// Get specific setting
function getSetting(key) {
    const settings = loadShopSettings();
    return key.split('.').reduce((obj, k) => obj?.[k], settings);
}

// Update specific setting
function updateSetting(key, value) {
    const settings = loadShopSettings();
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => {
        if (!obj[k]) obj[k] = {};
        return obj[k];
    }, settings);
    target[lastKey] = value;
    return saveShopSettings(settings);
}

// Show settings modal
window.showShopSettings = function() {
    alert('🔧 FUNCTION IS RUNNING! If you see this alert, the function works!');
    console.log('🔧 🔧 🔧 showShopSettings() CALLED - BUTTON CLICKED! 🔧 🔧 🔧');
    console.log('📋 Loading settings...');
    const settings = loadShopSettings();
    console.log('📋 Loaded settings:', settings);
    console.log('🎨 About to create modal...');
    
    console.log('🎨 Creating modal element');
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    console.log('📝 Building modal HTML');
    modal.innerHTML = `
        <div class="settings-modal">
            <div class="settings-header">
                <h2>⚙️ Shop Settings</h2>
                <button class="close-btn" onclick="this.closest('.settings-modal-overlay').remove()">✕</button>
            </div>
            
            <div class="settings-content">
                <!-- Shop Information -->
                <div class="settings-section">
                    <h3>🏪 Shop Information</h3>
                    <div class="form-group">
                        <label>Shop Name:</label>
                        <input type="text" id="setting-shopName" value="${settings.shopName}" placeholder="Your Shop Name">
                    </div>
                    <div class="form-group">
                        <label>Address:</label>
                        <input type="text" id="setting-shopAddress" value="${settings.shopAddress}" placeholder="123 Main St, City, ST 12345">
                    </div>
                    <div class="form-group">
                        <label>Phone:</label>
                        <input type="tel" id="setting-shopPhone" value="${settings.shopPhone}" placeholder="(555) 123-4567">
                    </div>
                    <div class="form-group">
                        <label>Email:</label>
                        <input type="email" id="setting-shopEmail" value="${settings.shopEmail}" placeholder="shop@example.com">
                    </div>
                    <div class="form-group">
                        <label>Labor Rate ($/hour):</label>
                        <input type="number" id="setting-laborRate" value="${settings.laborRate}" min="0" step="5">
                    </div>
                    <div class="form-group">
                        <label>Tax Rate (%):</label>
                        <input type="number" id="setting-taxRate" value="${(settings.taxRate * 100).toFixed(2)}" min="0" max="100" step="0.1">
                    </div>
                </div>
                
                <!-- Parts Store Configuration -->
                <div class="settings-section">
                    <h3>📞 Parts Store Call Configuration</h3>
                    <p>Configure which stores Grok calls, in what order, and with proper terminology</p>
                    <button onclick="if(window.partsStoreConfig && window.partsStoreConfig.showConfigEditor) { window.partsStoreConfig.showConfigEditor(); } else { alert('Parts Store Config not loaded yet. Please refresh the page.'); }" class="btn" style="background:#10b981;">
                        ⚙️ Configure Parts Stores &amp; Call Order
                    </button>
                </div>
                
                <!-- Parts Lookup System -->
                <div class="settings-section">
                    <h3>🔧 Parts Lookup System</h3>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="setting-parts-enabled" ${settings.partsLookup?.enabled ? 'checked' : ''}>
                            Enable Parts Lookup Integration
                        </label>
                    </div>
                    <div class="form-group">
                        <label>System Name:</label>
                        <input type="text" id="setting-parts-name" value="${settings.partsLookup?.name || ''}" placeholder="e.g., Nexpart, NAPA, AutoZone, Local Supplier">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Display name for the parts system
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Login URL:</label>
                        <input type="url" id="setting-parts-url" value="${settings.partsLookup?.url || ''}" placeholder="https://www.yourpartssupplier.com/login">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Full URL to the login page of your parts system
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Username/Email:</label>
                        <input type="text" id="setting-parts-username" value="${settings.partsLookup?.username || ''}" placeholder="Your username or email">
                    </div>
                    <div class="form-group">
                        <label>Password:</label>
                        <input type="password" id="setting-parts-password" value="${settings.partsLookup?.password || ''}" placeholder="Your password">
                    </div>
                    <p class="help-text">
                        💡 Works with ANY parts system: Nexpart, NAPA, AutoZone, O'Reilly, local suppliers, etc.
                    </p>
                </div>
                
                <!-- Labor Guide System -->
                <div class="settings-section">
                    <h3>⏱️ Labor Guide System</h3>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="setting-labor-enabled" ${settings.laborGuide?.enabled ? 'checked' : ''}>
                            Enable Labor Guide Integration
                        </label>
                    </div>
                    <div class="form-group">
                        <label>System Name:</label>
                        <input type="text" id="setting-labor-name" value="${settings.laborGuide?.name || ''}" placeholder="e.g., Alldata, Mitchell, Identifix">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Display name for the labor guide system
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Login URL:</label>
                        <input type="url" id="setting-labor-url" value="${settings.laborGuide?.url || ''}" placeholder="https://www.alldatadiy.com/login">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Full URL to the login page of your labor guide system
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Username/Email:</label>
                        <input type="text" id="setting-labor-username" value="${settings.laborGuide?.username || ''}" placeholder="Your username or email">
                    </div>
                    <div class="form-group">
                        <label>Password:</label>
                        <input type="password" id="setting-labor-password" value="${settings.laborGuide?.password || ''}" placeholder="Your password">
                    </div>
                    <p class="help-text">
                        💡 Works with ANY labor guide: Alldata, Mitchell, Identifix, Auto Labor Experts, etc.
                    </p>
                </div>
                
                <!-- Performance Testing -->
                <div class="settings-section">
                    <h3>🏁 Performance Testing</h3>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="setting-performance-enabled" ${settings.performance.enabled ? 'checked' : ''}>
                            Enable Performance Testing
                        </label>
                    </div>
                    <p class="help-text">
                        💡 Enables 0-60 MPH, braking, and G-force testing features.
                    </p>
                </div>
                
                <!-- Pricing Structure -->
                <div class="settings-section">
                    <h3>💰 Pricing Structure</h3>
                    
                    <div class="form-group">
                        <label>Parts Markup (%):</label>
                        <input type="number" id="setting-partsMarkup" value="${settings.pricing?.partsMarkup || 30}" min="0" max="200" step="5">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Standard markup on parts (e.g., 30% = cost × 1.30)
                        </small>
                        <button onclick="if(window.partsMatrix && window.partsMatrix.showMatrixEditor) { window.partsMatrix.showMatrixEditor(); } else { alert('Parts Matrix not loaded yet. Please refresh the page.'); }" style="margin-top: 10px; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%;">
                            💰 Configure Advanced Markup Matrix
                        </button>
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Use tiered markup: Higher % for cheap parts, lower % for expensive parts
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Diagnostic Fee ($):</label>
                        <input type="number" id="setting-diagnosticFee" value="${settings.pricing?.diagnosticFee || 125}" min="0" step="5">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Standard diagnostic/inspection fee
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Shop Supplies Fee (%):</label>
                        <input type="number" id="setting-shopSuppliesFee" value="${settings.pricing?.shopSuppliesFee || 5}" min="0" max="20" step="0.5">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Percentage added for shop supplies (fluids, rags, etc.)
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Environmental Fee ($):</label>
                        <input type="number" id="setting-environmentalFee" value="${settings.pricing?.environmentalFee || 3.50}" min="0" step="0.50">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Flat fee for hazardous waste disposal
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Minimum Labor Charge ($):</label>
                        <input type="number" id="setting-minimumLabor" value="${settings.pricing?.minimumLabor || 50}" min="0" step="5">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Minimum charge for any labor (e.g., 0.5 hour minimum)
                        </small>
                    </div>
                    
                    <h4 style="margin-top: 20px; color: #1e40af;">Service Package Pricing</h4>
                    
                    <div class="form-group">
                        <label>Oil Change Service ($):</label>
                        <input type="number" id="setting-oilChangePrice" value="${settings.pricing?.oilChangePrice || 45}" min="0" step="5">
                    </div>
                    
                    <div class="form-group">
                        <label>Brake Inspection ($):</label>
                        <input type="number" id="setting-brakeInspectionPrice" value="${settings.pricing?.brakeInspectionPrice || 0}" min="0" step="5">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Set to 0 for free with other services
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Tire Rotation ($):</label>
                        <input type="number" id="setting-tireRotationPrice" value="${settings.pricing?.tireRotationPrice || 25}" min="0" step="5">
                    </div>
                    
                    <div class="form-group">
                        <label>Battery Test ($):</label>
                        <input type="number" id="setting-batteryTestPrice" value="${settings.pricing?.batteryTestPrice || 0}" min="0" step="5">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Set to 0 for free service
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Multi-Point Inspection ($):</label>
                        <input type="number" id="setting-multiPointPrice" value="${settings.pricing?.multiPointPrice || 0}" min="0" step="5">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Set to 0 for free with other services
                        </small>
                    </div>
                    
                    <p class="help-text">
                        💡 These pricing settings will be used in quotes and estimates throughout the system.
                    </p>
                </div>
                
                <!-- Local Trusted Parts Stores -->
                <div class="settings-section">
                    <h3>🏪 Local Trusted Parts Stores</h3>
                    <p>Add your go-to local parts suppliers for quick reference</p>
                    
                    <div id="local-parts-stores-list"></div>
                    
                    <button onclick="addLocalPartsStore()" class="btn" style="background:#3b82f6; color:white; margin-top:10px;">
                        + Add Local Parts Store
                    </button>
                </div>
                
                <!-- VAPI Phone System -->
                <div class="settings-section">
                    <h3>📞 VAPI Phone System</h3>
                    <p>AI-powered phone answering system</p>
                    
                    <div class="form-group">
                        <label>VAPI Phone Number:</label>
                        <input type="tel" id="setting-vapiPhoneNumber" value="${settings.vapiPhoneNumber || ''}" placeholder="+1 (555) 123-4567">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Your VAPI phone number (get free number from VAPI dashboard)
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>VAPI Assistant ID:</label>
                        <input type="text" id="setting-vapiAssistantId" value="${settings.vapiAssistantId || ''}" placeholder="asst_xxxxxxxxxxxxx">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Your VAPI assistant ID (from VAPI dashboard)
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>VAPI Backend Server URL:</label>
                        <input type="url" id="setting-vapiServerUrl" value="${settings.vapiServerUrl || ''}" placeholder="https://your-server.onrender.com">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Backend server URL (will be provided after deployment)
                        </small>
                    </div>
                    
                    <p class="help-text">
                        💡 <strong>Setup Instructions:</strong><br>
                        1. Get free phone number from VAPI dashboard<br>
                        2. Create AI assistant in VAPI<br>
                        3. Forward your cell phone to VAPI number<br>
                        4. AI answers all calls automatically!<br>
                        <br>
                        📖 <strong>See VAPI_PHONE_SETUP_GUIDE.md for detailed setup</strong><br>
                        • All calls logged in AI Phone Dashboard<br>
                        • No webhooks needed - uses Google Voice API workaround
                    </p>
                </div>
                
                <!-- AI Script Editor -->
                <div class="settings-section">
                    <h3>📝 AI Script Editor</h3>
                    <p>Edit AI phone scripts and prompts for Grok and VAPI</p>
                    
                    <button onclick="openAIScriptEditor()" class="btn" style="background:#8b5cf6; color:white; width:100%;">
                        ✏️ Edit AI Scripts &amp; Prompts
                    </button>
                    
                    <p class="help-text">
                        💡 Customize how your AI assistant talks to customers, handles calls, and checks parts availability
                    </p>
                </div>
                
                <!-- PayPal Integration -->
                <div class="settings-section">
                    <h3>💳 PayPal Integration</h3>
                    <p>Accept payments and send invoices with PayPal</p>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="setting-paypal-enabled" ${settings.paypalEnabled ? 'checked' : ''}>
                            Enable PayPal Payments
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>PayPal Client ID:</label>
                        <input type="password" id="setting-paypal-client-id" value="${settings.paypalClientId || ''}" placeholder="Your PayPal Client ID">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Get from <a href="https://developer.paypal.com" target="_blank">PayPal Developer Dashboard</a>
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>PayPal Business Email:</label>
                        <input type="email" id="setting-paypal-email" value="${settings.paypalEmail || ''}" placeholder="your-business@example.com">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Email associated with your PayPal business account
                        </small>
                    </div>
                    
                    <p class="help-text">
                        💡 <strong>Features:</strong><br>
                        • Email invoices with PayPal payment link<br>
                        • Accept credit cards through PayPal<br>
                        • Automatic payment confirmation<br>
                        • Secure checkout process
                    </p>
                </div>
                
                <!-- Email Configuration -->
                <div class="settings-section">
                    <h3>📧 Email Configuration</h3>
                    <p>Configure email settings for sending invoices and notifications</p>
                    
                    <div class="form-group">
                        <label>From Email Address:</label>
                        <input type="email" id="setting-email-from" value="${settings.emailFrom || settings.shopEmail || ''}" placeholder="shop@example.com">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Email address customers will see invoices from
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Email Signature:</label>
                        <textarea id="setting-email-signature" style="min-height:100px;" placeholder="Thank you for your business!
${settings.shopName || 'Your Shop'}
${settings.shopPhone || ''}
${settings.shopAddress || ''}">${settings.emailSignature || ''}</textarea>
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            Appears at the bottom of all emails
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="setting-auto-send-invoice" ${settings.autoSendInvoice ? 'checked' : ''}>
                            Automatically email invoice when job is complete
                        </label>
                    </div>
                    
                    <p class="help-text">
                        💡 Invoices are sent as PDF attachments with PayPal payment link
                    </p>
                </div>
                
                <!-- API Keys Section -->
                <div class="settings-section">
                    <h3>🔑 API Keys</h3>
                    
                    <div class="form-group">
                        <label>Grok API Key:</label>
                        <input type="password" id="setting-grokApiKey" value="${settings.grokApiKey || ''}" placeholder="Enter your Grok API key">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            For AI-powered diagnostics, analysis, and automated phone calls
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>VAPI API Key:</label>
                        <input type="password" id="setting-vapiApiKey" value="${settings.vapiApiKey || ''}" placeholder="Enter your VAPI API key">
                        <small style="color: #64748b; display: block; margin-top: 5px;">
                            For AI phone system integration and customer notifications
                        </small>
                    </div>
                    
                    <p class="help-text">
                        💡 Get your API keys from:<br>
                        • Grok: <a href="https://x.ai" target="_blank">x.ai</a><br>
                        • VAPI: <a href="https://vapi.ai" target="_blank">vapi.ai</a>
                    </p>
                </div>
            </div>
            
            <div class="settings-footer">
                <button class="btn btn-secondary" onclick="this.closest('.settings-modal-overlay').remove()">
                    Cancel
                </button>
                <button class="btn" onclick="saveSettingsFromModal()">
                    💾 Save Settings
                </button>
            </div>
        </div>
    `;
    
    console.log('✅ Appending modal to body');
    document.body.appendChild(modal);
    console.log('🎉 Modal should now be visible!');
}

// Save settings from modal
window.saveSettingsFromModal = function() {
    console.log('💾 Saving settings from modal...');
    
       const nexpartEnabled = document.getElementById('setting-nexpart-enabled')?.checked || false;
       const autoLaborEnabled = document.getElementById('setting-autoLabor-enabled')?.checked || false;
    
    console.log('🔧 Nexpart enabled checkbox:', nexpartEnabled);
    console.log('⏱️ Auto Labor enabled checkbox:', autoLaborEnabled);
    
    const settings = {
        shopName: document.getElementById('setting-shopName').value,
        shopAddress: document.getElementById('setting-shopAddress').value,
        shopPhone: document.getElementById('setting-shopPhone').value,
        shopEmail: document.getElementById('setting-shopEmail').value,
        laborRate: parseFloat(document.getElementById('setting-laborRate').value) || 100,
        taxRate: (parseFloat(document.getElementById('setting-taxRate').value) || 0) / 100,
        partsLookup: {
            enabled: document.getElementById('setting-parts-enabled')?.checked || false,
            name: document.getElementById('setting-parts-name')?.value || '',
            url: document.getElementById('setting-parts-url')?.value || '',
            username: document.getElementById('setting-parts-username')?.value || '',
            password: document.getElementById('setting-parts-password')?.value || ''
        },
        laborGuide: {
            enabled: document.getElementById('setting-labor-enabled')?.checked || false,
            name: document.getElementById('setting-labor-name')?.value || '',
            url: document.getElementById('setting-labor-url')?.value || '',
            username: document.getElementById('setting-labor-username')?.value || '',
            password: document.getElementById('setting-labor-password')?.value || ''
        },
        // Keep legacy for backward compatibility
        nexpart: {
            username: document.getElementById('setting-parts-username')?.value || '',
            password: document.getElementById('setting-parts-password')?.value || '',
            enabled: document.getElementById('setting-parts-enabled')?.checked || false
        },
        autoLabor: {
            email: document.getElementById('setting-labor-username')?.value || '',
            password: document.getElementById('setting-labor-password')?.value || '',
            enabled: document.getElementById('setting-labor-enabled')?.checked || false
        },
        performance: {
            enabled: document.getElementById('setting-performance-enabled').checked,
            vehicleWeight: null
        },
        pricing: {
            partsMarkup: parseFloat(document.getElementById('setting-partsMarkup').value) || 30,
            diagnosticFee: parseFloat(document.getElementById('setting-diagnosticFee').value) || 125,
            shopSuppliesFee: parseFloat(document.getElementById('setting-shopSuppliesFee').value) || 5,
            environmentalFee: parseFloat(document.getElementById('setting-environmentalFee').value) || 3.50,
            minimumLabor: parseFloat(document.getElementById('setting-minimumLabor').value) || 50,
            oilChangePrice: parseFloat(document.getElementById('setting-oilChangePrice').value) || 45,
            brakeInspectionPrice: parseFloat(document.getElementById('setting-brakeInspectionPrice').value) || 0,
            tireRotationPrice: parseFloat(document.getElementById('setting-tireRotationPrice').value) || 25,
            batteryTestPrice: parseFloat(document.getElementById('setting-batteryTestPrice').value) || 0,
            multiPointPrice: parseFloat(document.getElementById('setting-multiPointPrice').value) || 0
        },
        vapiPhoneNumber: document.getElementById('setting-vapiPhoneNumber')?.value || '',
        vapiAssistantId: document.getElementById('setting-vapiAssistantId')?.value || '',
        vapiServerUrl: document.getElementById('setting-vapiServerUrl')?.value || '',
        paypalEnabled: document.getElementById('setting-paypal-enabled')?.checked || false,
        paypalClientId: document.getElementById('setting-paypal-client-id')?.value || '',
        paypalEmail: document.getElementById('setting-paypal-email')?.value || '',
        emailFrom: document.getElementById('setting-email-from')?.value || '',
        emailSignature: document.getElementById('setting-email-signature')?.value || '',
        autoSendInvoice: document.getElementById('setting-auto-send-invoice')?.checked || false,
        grokApiKey: document.getElementById('setting-grokApiKey')?.value || '',
        vapiApiKey: document.getElementById('setting-vapiApiKey')?.value || ''
    };
    
    console.log('📋 Settings object to save:', settings);
    console.log('🔧 Nexpart in settings:', settings.nexpart);
    console.log('⏱️ Auto Labor in settings:', settings.autoLabor);
    
    console.log('💾 About to call saveShopSettings()...');
    const saveResult = saveShopSettings(settings);
    console.log('💾 saveShopSettings() returned:', saveResult);
    
    if (saveResult) {
        console.log('✅ Settings saved to localStorage');
        
        // Verify what was saved
        const saved = loadShopSettings();
        console.log('🔍 Loaded back from localStorage:', saved);
        console.log('🔧 Nexpart after load:', saved.nexpart);
        console.log('⏱️ Auto Labor after load:', saved.autoLabor);
        
        alert('✅ Settings saved successfully!');
        document.querySelector('.settings-modal-overlay').remove();
    } else {
        console.error('❌ Save failed!');
        alert('❌ Error saving settings. Please try again.');
    }
};

// Initialize settings on load
window.shopSettings = loadShopSettings();

console.log('✅ Shop settings system loaded');
// Local Parts Stores Management
function loadLocalPartsStores() {
    const settings = loadShopSettings();
    const stores = settings.localPartsStores || [];
    const container = document.getElementById('local-parts-stores-list');
    
    if (!container) return;
    
    if (stores.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic;">No local parts stores added yet.</p>';
        return;
    }
    
    container.innerHTML = stores.map((store, index) => `
        <div style="background:#f9fafb; padding:15px; border-radius:8px; margin-bottom:10px; border-left:4px solid ${store.aiEnabled ? '#10b981' : '#3b82f6'};">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <h4 style="margin:0; color:#1f2937;">${store.name}</h4>
                        ${store.aiEnabled ? `<span style="background:#10b981; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:bold;">🤖 AI ENABLED - Priority ${store.priority || 1}</span>` : ''}
                    </div>
                    <p style="margin:5px 0; color:#4b5563;"><strong>📞 Phone:</strong> ${store.phone}</p>
                    ${store.address ? `<p style="margin:5px 0; color:#4b5563;"><strong>📍 Address:</strong> ${store.address}</p>` : ''}
                    ${store.website ? `<p style="margin:5px 0; color:#4b5563;"><strong>🌐 Website:</strong> <a href="${store.website}" target="_blank">${store.website}</a></p>` : ''}
                    ${store.accountNumber ? `<p style="margin:5px 0; color:#4b5563;"><strong>🔢 Account #:</strong> ${store.accountNumber}</p>` : ''}
                    ${store.notes ? `<p style="margin:5px 0; color:#4b5563;"><strong>📝 Notes:</strong> ${store.notes}</p>` : ''}
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="editLocalPartsStore(${index})" style="padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer;">✏️ Edit</button>
                    <button onclick="deleteLocalPartsStore(${index})" style="padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer;">🗑️ Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

window.addLocalPartsStore = function() {
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    modal.innerHTML = `
        <div class="settings-modal" style="max-width:600px;">
            <div class="settings-header">
                <h2>Add Local Parts Store</h2>
                <button class="close-btn" onclick="this.closest('.settings-modal-overlay').remove()">✕</button>
            </div>
            
            <div style="padding:20px;">
                <div class="form-group">
                    <label>Store Name *</label>
                    <input type="text" id="local-store-name" placeholder="e.g., AutoZone, O'Reilly, Local Parts Supply" required>
                </div>
                
                <div class="form-group">
                    <label>Phone Number *</label>
                    <input type="tel" id="local-store-phone" placeholder="(555) 123-4567" required>
                </div>
                
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" id="local-store-address" placeholder="123 Main St, City, State ZIP">
                </div>
                
                <div class="form-group">
                    <label>Website</label>
                    <input type="url" id="local-store-website" placeholder="https://example.com">
                </div>
                
                <div class="form-group">
                    <label>Account Number</label>
                    <input type="text" id="local-store-account" placeholder="Your account number with this store">
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="local-store-notes" placeholder="Special instructions, contact person, hours, etc." style="min-height:80px;"></textarea>
                </div>
                
                <div style="background:#eff6ff; padding:15px; border-radius:8px; margin-top:20px; border-left:4px solid #3b82f6;">
                    <h4 style="margin:0 0 10px 0; color:#1e40af;">🤖 AI Calling Settings</h4>
                    <div class="form-group" style="margin-bottom:10px;">
                        <label style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" id="local-store-ai-enabled">
                            <span>Include this store in AI calling system</span>
                        </label>
                        <small style="color:#64748b; display:block; margin-top:5px;">
                            When enabled, Grok AI will call this store to check parts availability
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Call Priority (1 = First)</label>
                        <input type="number" id="local-store-priority" min="1" max="99" value="1" placeholder="1">
                        <small style="color:#64748b; display:block; margin-top:5px;">
                            Lower numbers = called first (1, 2, 3...)
                        </small>
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:20px;">
                    <button class="btn btn-secondary" onclick="this.closest('.settings-modal-overlay').remove()">Cancel</button>
                    <button class="btn" onclick="saveLocalPartsStore()">💾 Save Store</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.saveLocalPartsStore = function(editIndex = null) {
    const name = document.getElementById('local-store-name').value.trim();
    const phone = document.getElementById('local-store-phone').value.trim();
    
    if (!name || !phone) {
        alert('Please enter store name and phone number');
        return;
    }
    
    const store = {
        name: name,
        phone: phone,
        address: document.getElementById('local-store-address').value.trim(),
        website: document.getElementById('local-store-website').value.trim(),
        accountNumber: document.getElementById('local-store-account').value.trim(),
        notes: document.getElementById('local-store-notes').value.trim(),
        aiEnabled: document.getElementById('local-store-ai-enabled').checked,
        priority: parseInt(document.getElementById('local-store-priority').value) || 1
    };
    
    const settings = loadShopSettings();
    if (!settings.localPartsStores) {
        settings.localPartsStores = [];
    }
    
    if (editIndex !== null) {
        settings.localPartsStores[editIndex] = store;
    } else {
        settings.localPartsStores.push(store);
    }
    
    saveShopSettings(settings);
    
    // Close modal
    document.querySelector('.settings-modal-overlay').remove();
    
    // Reload the list
    loadLocalPartsStores();
    
    alert('✅ Local parts store saved!');
};

window.editLocalPartsStore = function(index) {
    const settings = loadShopSettings();
    const store = settings.localPartsStores[index];
    
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    modal.innerHTML = `
        <div class="settings-modal" style="max-width:600px;">
            <div class="settings-header">
                <h2>Edit Local Parts Store</h2>
                <button class="close-btn" onclick="this.closest('.settings-modal-overlay').remove()">✕</button>
            </div>
            
            <div style="padding:20px;">
                <div class="form-group">
                    <label>Store Name *</label>
                    <input type="text" id="local-store-name" value="${store.name}" required>
                </div>
                
                <div class="form-group">
                    <label>Phone Number *</label>
                    <input type="tel" id="local-store-phone" value="${store.phone}" required>
                </div>
                
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" id="local-store-address" value="${store.address || ''}">
                </div>
                
                <div class="form-group">
                    <label>Website</label>
                    <input type="url" id="local-store-website" value="${store.website || ''}">
                </div>
                
                <div class="form-group">
                    <label>Account Number</label>
                    <input type="text" id="local-store-account" value="${store.accountNumber || ''}">
                </div>
                
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="local-store-notes" style="min-height:80px;">${store.notes || ''}</textarea>
                </div>
                
                <div style="background:#eff6ff; padding:15px; border-radius:8px; margin-top:20px; border-left:4px solid #3b82f6;">
                    <h4 style="margin:0 0 10px 0; color:#1e40af;">🤖 AI Calling Settings</h4>
                    <div class="form-group" style="margin-bottom:10px;">
                        <label style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" id="local-store-ai-enabled" ${store.aiEnabled ? 'checked' : ''}>
                            <span>Include this store in AI calling system</span>
                        </label>
                        <small style="color:#64748b; display:block; margin-top:5px;">
                            When enabled, Grok AI will call this store to check parts availability
                        </small>
                    </div>
                    <div class="form-group">
                        <label>Call Priority (1 = First)</label>
                        <input type="number" id="local-store-priority" min="1" max="99" value="${store.priority || 1}" placeholder="1">
                        <small style="color:#64748b; display:block; margin-top:5px;">
                            Lower numbers = called first (1, 2, 3...)
                        </small>
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:20px;">
                    <button class="btn btn-secondary" onclick="this.closest('.settings-modal-overlay').remove()">Cancel</button>
                    <button class="btn" onclick="saveLocalPartsStore(${index})">💾 Update Store</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.deleteLocalPartsStore = function(index) {
    if (!confirm('Are you sure you want to delete this parts store?')) {
        return;
    }
    
    const settings = loadShopSettings();
    settings.localPartsStores.splice(index, 1);
    saveShopSettings(settings);
    
    loadLocalPartsStores();
    alert('✅ Parts store deleted!');
};

// Load local parts stores when settings modal opens
const originalShowShopSettings = window.showShopSettings;
window.showShopSettings = function() {
    originalShowShopSettings();
    setTimeout(() => {
        loadLocalPartsStores();
    }, 100);
};

console.log('✅ Local Parts Stores management loaded');

// Get AI-enabled stores for Grok calling
window.getAIEnabledPartsStores = function() {
    const settings = loadShopSettings();
    const stores = settings.localPartsStores || [];
    
    // Filter only AI-enabled stores and sort by priority
    const aiStores = stores
        .filter(store => store.aiEnabled)
        .sort((a, b) => (a.priority || 99) - (b.priority || 99))
        .map(store => ({
            name: store.name,
            phone: store.phone,
            address: store.address,
            accountNumber: store.accountNumber,
            notes: store.notes,
            priority: store.priority || 99
        }));
    
    console.log('🤖 AI-enabled parts stores:', aiStores);
    return aiStores;
};

// Export for Grok AI to use
window.getPartsStoresForAI = window.getAIEnabledPartsStores;

console.log('✅ AI calling integration loaded');

// AI Script Editor
window.openAIScriptEditor = function() {
    const settings = loadShopSettings();
    
    // Default AI scripts
    const defaultScripts = {
        phoneGreeting: settings.aiScripts?.phoneGreeting || "Hello! Thank you for calling [SHOP_NAME]. This is our AI assistant. How can I help you today?",
        partsCheckScript: settings.aiScripts?.partsCheckScript || "I'll check parts availability for you. Let me call our suppliers and get back to you with pricing and availability.",
        appointmentScript: settings.aiScripts?.appointmentScript || "I'd be happy to schedule an appointment for you. What day and time works best?",
        estimateFollowUp: settings.aiScripts?.estimateFollowUp || "Your estimate is ready. The total comes to [AMOUNT]. Would you like me to email it to you?",
        carReadyNotification: settings.aiScripts?.carReadyNotification || "Good news! Your [VEHICLE] is ready for pickup. We're open until [CLOSING_TIME]. Would you like to leave a review for 5% off?",
        grokSystemPrompt: settings.aiScripts?.grokSystemPrompt || "You are a helpful auto shop assistant. Be professional, friendly, and efficient. Always confirm customer information before proceeding."
    };
    
    const modal = document.createElement('div');
    modal.className = 'settings-modal-overlay';
    modal.innerHTML = `
        <div class="settings-modal" style="max-width:900px; max-height:90vh; overflow-y:auto;">
            <div class="settings-header">
                <h2>📝 AI Script Editor</h2>
                <button class="close-btn" onclick="this.closest('.settings-modal-overlay').remove()">✕</button>
            </div>
            
            <div style="padding:20px;">
                <p style="background:#eff6ff; padding:15px; border-radius:8px; margin-bottom:20px; border-left:4px solid #3b82f6;">
                    <strong>💡 Available Variables:</strong><br>
                    <code>[SHOP_NAME]</code> - Your shop name<br>
                    <code>[VEHICLE]</code> - Customer's vehicle<br>
                    <code>[AMOUNT]</code> - Estimate amount<br>
                    <code>[CLOSING_TIME]</code> - Shop closing time<br>
                    <code>[CUSTOMER_NAME]</code> - Customer's name
                </p>
                
                <div class="form-group">
                    <label><strong>📞 Phone Greeting</strong></label>
                    <textarea id="ai-script-greeting" style="min-height:80px; font-family:monospace;">${defaultScripts.phoneGreeting}</textarea>
                    <small style="color:#64748b;">First thing customers hear when they call</small>
                </div>
                
                <div class="form-group">
                    <label><strong>🔧 Parts Check Script</strong></label>
                    <textarea id="ai-script-parts" style="min-height:100px; font-family:monospace;">${defaultScripts.partsCheckScript}</textarea>
                    <small style="color:#64748b;">What AI says when checking parts availability</small>
                </div>
                
                <div class="form-group">
                    <label><strong>📅 Appointment Booking Script</strong></label>
                    <textarea id="ai-script-appointment" style="min-height:80px; font-family:monospace;">${defaultScripts.appointmentScript}</textarea>
                    <small style="color:#64748b;">How AI handles appointment requests</small>
                </div>
                
                <div class="form-group">
                    <label><strong>💰 Estimate Follow-Up Script</strong></label>
                    <textarea id="ai-script-estimate" style="min-height:80px; font-family:monospace;">${defaultScripts.estimateFollowUp}</textarea>
                    <small style="color:#64748b;">When estimate is ready for customer</small>
                </div>
                
                <div class="form-group">
                    <label><strong>✅ Car Ready Notification</strong></label>
                    <textarea id="ai-script-ready" style="min-height:100px; font-family:monospace;">${defaultScripts.carReadyNotification}</textarea>
                    <small style="color:#64748b;">Notification when car is ready for pickup (includes review discount offer)</small>
                </div>
                
                <div class="form-group">
                    <label><strong>🤖 Grok System Prompt (Advanced)</strong></label>
                    <textarea id="ai-script-system" style="min-height:120px; font-family:monospace;">${defaultScripts.grokSystemPrompt}</textarea>
                    <small style="color:#64748b;">Core instructions for how Grok AI should behave</small>
                </div>
                
                <div style="background:#fef3c7; padding:15px; border-radius:8px; margin:20px 0; border-left:4px solid #f59e0b;">
                    <strong>⚠️ Tips:</strong><br>
                    • Keep scripts natural and conversational<br>
                    • Use variables for dynamic content<br>
                    • Test changes with a few calls first<br>
                    • Save often - changes take effect immediately
                </div>
                
                <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:20px;">
                    <button class="btn btn-secondary" onclick="this.closest('.settings-modal-overlay').remove()">Cancel</button>
                    <button class="btn" onclick="saveAIScripts()" style="background:#8b5cf6;">💾 Save AI Scripts</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.saveAIScripts = function() {
    const settings = loadShopSettings();
    
    settings.aiScripts = {
        phoneGreeting: document.getElementById('ai-script-greeting').value,
        partsCheckScript: document.getElementById('ai-script-parts').value,
        appointmentScript: document.getElementById('ai-script-appointment').value,
        estimateFollowUp: document.getElementById('ai-script-estimate').value,
        carReadyNotification: document.getElementById('ai-script-ready').value,
        grokSystemPrompt: document.getElementById('ai-script-system').value
    };
    
    saveShopSettings(settings);
    
    // Close modal
    document.querySelector('.settings-modal-overlay').remove();
    
    alert('✅ AI scripts saved successfully!\n\nChanges will take effect immediately for new calls.');
};

// Export AI scripts for use by AI systems
window.getAIScripts = function() {
    const settings = loadShopSettings();
    return settings.aiScripts || {};
};

console.log('✅ AI Script Editor loaded');
