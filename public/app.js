// Vhicl.ai - Professional Vehicle Assessment Tool
// Fixed version with proper sensor validation

// Global variables
let bluetoothDevice = null;
let bluetoothCharacteristic = null;
let currentMode = 'standard';
let vehicleData = {};
let scanResults = {};
let shopInfo = {};

// Sensor data
let audioStream = null;
let audioContext = null;
let audioAnalyser = null;
let audioDataArray = null;
let vibrationData = [];
let soundData = {
    engine: [],
    exhaust: [],
    transmission: [],
    suspension: [],
    brakes: [],
    rearEnd: []
};
let testDriveStartTime = null;
let testDriveActive = false;

// Minimum data thresholds for valid assessment
const MIN_VIBRATION_SAMPLES = 100;  // At least 100 samples (10 seconds at 10Hz)
const MIN_SOUND_SAMPLES = 500;      // At least 500 samples (50 seconds at 10Hz)
const MIN_TEST_DRIVE_DURATION = 60000; // At least 60 seconds

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Vhicl.ai initializing...');
    
    // Load saved shop information
    loadShopInfo();
    
    // Set up event listeners
    document.getElementById('newAssessmentBtn').addEventListener('click', startNewAssessment);
    document.getElementById('quickModeBtn').addEventListener('click', () => selectMode('quick'));
    document.getElementById('standardModeBtn').addEventListener('click', () => selectMode('standard'));
    document.getElementById('fullModeBtn').addEventListener('click', () => selectMode('full'));
    document.getElementById('startAssessmentBtn').addEventListener('click', startAssessment);
    document.getElementById('completeTestDriveBtn').addEventListener('click', completeTestDrive);
    document.getElementById('printReportBtn').addEventListener('click', printReport);
    document.getElementById('emailReportBtn').addEventListener('click', emailReport);
    document.getElementById('newAssessmentBtn2').addEventListener('click', () => location.reload());
    
    // Shop info save button
    document.getElementById('saveShopInfoBtn').addEventListener('click', saveShopInfo);
    
    console.log('✅ App initialized');
});

// Load shop information from localStorage
function loadShopInfo() {
    const saved = localStorage.getItem('vhiclShopInfo');
    if (saved) {
        shopInfo = JSON.parse(saved);
        document.getElementById('shopName').value = shopInfo.name || '';
        document.getElementById('shopPhone').value = shopInfo.phone || '';
        document.getElementById('shopEmail').value = shopInfo.email || '';
        document.getElementById('shopAddress').value = shopInfo.address || '';
        console.log('📋 Shop info loaded');
    }
}

// Save shop information to localStorage
function saveShopInfo() {
    shopInfo = {
        name: document.getElementById('shopName').value,
        phone: document.getElementById('shopPhone').value,
        email: document.getElementById('shopEmail').value,
        address: document.getElementById('shopAddress').value
    };
    localStorage.setItem('vhiclShopInfo', JSON.stringify(shopInfo));
    alert('✅ Shop information saved!');
    console.log('💾 Shop info saved');
}

// Start new assessment
async function startNewAssessment() {
    console.log('🆕 Starting new assessment...');
    
    // Reset all data
    vehicleData = {};
    scanResults = {};
    vibrationData = [];
    soundData = {
        engine: [],
        exhaust: [],
        transmission: [],
        suspension: [],
        brakes: [],
        rearEnd: []
    };
    testDriveActive = false;
    testDriveStartTime = null;
    
    // Show mode selection
    showScreen('modeScreen');
    
    // Try to auto-connect to previously paired device
    await tryAutoConnect();
}

// Try to auto-connect to previously paired Bluetooth device
async function tryAutoConnect() {
    // Check if browser supports getDevices (Chrome 85+)
    if (!navigator.bluetooth.getDevices) {
        console.log('⚠️ Auto-reconnect not supported in this browser');
        return;
    }
    
    try {
        console.log('🔍 Checking for previously paired devices...');
        const devices = await navigator.bluetooth.getDevices();
        
        // Look for KONNWEI device
        const konnweiDevice = devices.find(device => 
            device.name && device.name.includes('KONNWEI')
        );
        
        if (konnweiDevice) {
            console.log('✅ Found previously paired device:', konnweiDevice.name);
            
            // Show connecting banner
            showConnectionBanner('Connecting to ' + konnweiDevice.name + '...');
            
            try {
                // Connect to the device
                if (!konnweiDevice.gatt.connected) {
                    await konnweiDevice.gatt.connect();
                }
                
                bluetoothDevice = konnweiDevice;
                
                // Get the OBD2 service and characteristic
                const service = await bluetoothDevice.gatt.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
                bluetoothCharacteristic = await service.getCharacteristic('0000fff1-0000-1000-8000-00805f9b34fb');
                
                showConnectionBanner('✅ Connected to ' + konnweiDevice.name, 'success');
                console.log('✅ Auto-connected successfully');
                
                // Auto-read VIN
                await autoReadVIN();
                
                return true;
            } catch (error) {
                console.error('❌ Auto-connect failed:', error);
                showConnectionBanner('Auto-connect failed. Please select device manually.', 'error');
                bluetoothDevice = null;
                bluetoothCharacteristic = null;
            }
        } else {
            console.log('ℹ️ No previously paired KONNWEI device found');
        }
    } catch (error) {
        console.error('❌ Error checking for paired devices:', error);
    }
    
    return false;
}

// Show connection status banner
function showConnectionBanner(message, type = 'info') {
    const banner = document.getElementById('connectionBanner');
    const bannerText = document.getElementById('connectionBannerText');
    
    bannerText.textContent = message;
    banner.className = 'connection-banner ' + type;
    banner.style.display = 'block';
    
    // Auto-hide success/error messages after 3 seconds
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            banner.style.display = 'none';
        }, 3000);
    }
}

// Auto-read VIN from connected device
async function autoReadVIN() {
    if (!bluetoothDevice || !bluetoothDevice.gatt.connected) {
        return;
    }
    
    try {
        console.log('📖 Auto-reading VIN...');
        showConnectionBanner('Reading vehicle information...', 'info');
        
        // Send Mode 09 PID 02 command to read VIN
        const vinCommand = new Uint8Array([0x09, 0x02]);
        await bluetoothCharacteristic.writeValue(vinCommand);
        
        // Wait for response
        await delay(2000);
        
        // Read the response
        const response = await bluetoothCharacteristic.readValue();
        const vin = parseVINResponse(response);
        
        if (vin && vin.length === 17) {
            vehicleData.vin = vin;
            document.getElementById('vinInput').value = vin;
            
            // Decode VIN to get Year/Make/Model
            await decodeVIN(vin);
            
            showConnectionBanner('✅ Vehicle info loaded: ' + vin, 'success');
            console.log('✅ VIN auto-read successful:', vin);
        } else {
            console.log('⚠️ Could not read VIN automatically');
            showConnectionBanner('Could not read VIN. Please enter manually.', 'error');
        }
    } catch (error) {
        console.error('❌ VIN auto-read failed:', error);
        showConnectionBanner('Could not read VIN. Please enter manually.', 'error');
    }
}

// Parse VIN from OBD2 response
function parseVINResponse(dataView) {
    // Convert response to string
    let vin = '';
    for (let i = 0; i < dataView.byteLength; i++) {
        const char = String.fromCharCode(dataView.getUint8(i));
        if (char.match(/[A-HJ-NPR-Z0-9]/)) { // Valid VIN characters
            vin += char;
        }
    }
    return vin;
}

// Decode VIN to get Year/Make/Model
async function decodeVIN(vin) {
    try {
        // Use NHTSA VIN decoder API
        const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);
        const data = await response.json();
        
        if (data.Results) {
            const year = data.Results.find(r => r.Variable === 'Model Year')?.Value;
            const make = data.Results.find(r => r.Variable === 'Make')?.Value;
            const model = data.Results.find(r => r.Variable === 'Model')?.Value;
            
            if (year) {
                vehicleData.year = year;
                document.getElementById('yearInput').value = year;
            }
            if (make) {
                vehicleData.make = make;
                document.getElementById('makeInput').value = make;
            }
            if (model) {
                vehicleData.model = model;
                document.getElementById('modelInput').value = model;
            }
            
            console.log('✅ VIN decoded:', { year, make, model });
        }
    } catch (error) {
        console.error('❌ VIN decode failed:', error);
    }
}

// Select assessment mode
function selectMode(mode) {
    currentMode = mode;
    
    // Update button states
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.getElementById(mode + 'ModeBtn').classList.add('selected');
    
    console.log('📋 Mode selected:', mode);
}

// Request sensor permissions
async function requestSensorPermissions() {
    console.log('🎤 Requesting sensor permissions...');
    
    try {
        // Request microphone access
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access granted');
        
        // Set up audio analysis
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(audioStream);
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 2048;
        source.connect(audioAnalyser);
        
        const bufferLength = audioAnalyser.frequencyBinCount;
        audioDataArray = new Uint8Array(bufferLength);
        
        // Request accelerometer access (automatic on mobile)
        window.addEventListener('devicemotion', handleDeviceMotion);
        console.log('✅ Accelerometer access enabled');
        
        return true;
    } catch (error) {
        console.error('❌ Sensor permission denied:', error);
        alert('⚠️ Microphone access is required for vehicle assessment. Please enable it in your browser settings.');
        return false;
    }
}

// Handle device motion events
function handleDeviceMotion(event) {
    if (!testDriveActive) return;
    
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    
    // Calculate vibration magnitude
    const magnitude = Math.sqrt(
        (acc.x || 0) ** 2 + 
        (acc.y || 0) ** 2 + 
        (acc.z || 0) ** 2
    );
    
    // Store vibration data with timestamp
    const timestamp = Date.now() - testDriveStartTime;
    vibrationData.push({
        time: timestamp,
        x: acc.x || 0,
        y: acc.y || 0,
        z: acc.z || 0,
        magnitude: magnitude
    });
}

// Analyze audio frequencies in real-time
function analyzeAudioFrequencies() {
    if (!audioAnalyser || !testDriveActive) return;
    
    audioAnalyser.getByteFrequencyData(audioDataArray);
    
    const timestamp = Date.now() - testDriveStartTime;
    
    // Analyze different frequency ranges for different components
    
    // Rear end noise: 500-2000 Hz (rumble, grinding)
    const rearEndFreq = getAverageFrequency(50, 200);
    soundData.rearEnd.push({ time: timestamp, level: rearEndFreq });
    
    // Engine noise: 100-500 Hz (knock, rough idle)
    const engineFreq = getAverageFrequency(10, 50);
    soundData.engine.push({ time: timestamp, level: engineFreq });
    
    // Exhaust noise: 50-300 Hz (leak, rumble)
    const exhaustFreq = getAverageFrequency(5, 30);
    soundData.exhaust.push({ time: timestamp, level: exhaustFreq });
    
    // Transmission noise: 1000-4000 Hz (whine, grinding)
    const transFreq = getAverageFrequency(100, 400);
    soundData.transmission.push({ time: timestamp, level: transFreq });
    
    // Suspension noise: 200-1000 Hz (clunk, squeak)
    const suspensionFreq = getAverageFrequency(20, 100);
    soundData.suspension.push({ time: timestamp, level: suspensionFreq });
    
    // Brake noise: 8000-16000 Hz (squeal, grinding)
    const brakeFreq = getAverageFrequency(800, 1600);
    soundData.brakes.push({ time: timestamp, level: brakeFreq });
}

// Get average frequency in a range
function getAverageFrequency(startBin, endBin) {
    let sum = 0;
    let count = 0;
    
    for (let i = startBin; i < endBin && i < audioDataArray.length; i++) {
        sum += audioDataArray[i];
        count++;
    }
    
    return count > 0 ? sum / count : 0;
}

// Start test drive monitoring
function startTestDriveMonitoring() {
    console.log('🚗 Starting test drive monitoring...');
    
    testDriveActive = true;
    testDriveStartTime = Date.now();
    
    // Reset data arrays
    vibrationData = [];
    soundData = {
        engine: [],
        exhaust: [],
        transmission: [],
        suspension: [],
        brakes: [],
        rearEnd: []
    };
    
    // Start audio analysis loop (10 times per second)
    const audioInterval = setInterval(() => {
        if (!testDriveActive) {
            clearInterval(audioInterval);
            return;
        }
        analyzeAudioFrequencies();
    }, 100);
}

// Stop test drive monitoring
function stopTestDriveMonitoring() {
    console.log('🛑 Stopping test drive monitoring...');
    testDriveActive = false;
    
    // Analyze collected data
    analyzeSensorData();
}

// Analyze sensor data
function analyzeSensorData() {
    console.log('🔍 Analyzing sensor data...');
    
    // Analyze vibration
    const vibrationScore = analyzeVibration();
    console.log('Vibration score:', vibrationScore);
    
    // Analyze sounds
    const soundScores = analyzeSounds();
    console.log('Sound scores:', soundScores);
    
    // Store results
    scanResults.vibrationScore = vibrationScore;
    scanResults.soundScores = soundScores;
    scanResults.sensorDataCollected = true;
}

// Analyze vibration data
function analyzeVibration() {
    if (vibrationData.length === 0) {
        return { score: null, status: 'No vibration data collected', dataValid: false };
    }
    
    // Check if we have enough data
    if (vibrationData.length < MIN_VIBRATION_SAMPLES) {
        return { 
            score: null, 
            status: `Insufficient data (${vibrationData.length} samples, need ${MIN_VIBRATION_SAMPLES})`,
            dataValid: false
        };
    }
    
    // Calculate average vibration magnitude
    const avgMagnitude = vibrationData.reduce((sum, d) => sum + d.magnitude, 0) / vibrationData.length;
    
    // Calculate peak vibration
    const peakMagnitude = Math.max(...vibrationData.map(d => d.magnitude));
    
    // Score based on vibration levels
    let score = 100;
    let status = 'Normal';
    let issues = [];
    
    if (avgMagnitude > 5.0) {
        score = 25;
        status = 'Excessive vibration detected';
        issues.push('Severe mechanical issues - immediate attention required');
    } else if (avgMagnitude > 3.0) {
        score = 50;
        status = 'High vibration detected';
        issues.push('Significant vibration - check engine mounts, wheels, drivetrain');
    } else if (avgMagnitude > 1.5) {
        score = 75;
        status = 'Moderate vibration';
        issues.push('Minor vibration - may need wheel balance or alignment');
    }
    
    if (peakMagnitude > 8.0) {
        issues.push('Severe vibration spikes detected - possible impact damage');
    }
    
    return {
        score: score,
        status: status,
        avgMagnitude: avgMagnitude.toFixed(2),
        peakMagnitude: peakMagnitude.toFixed(2),
        issues: issues,
        dataValid: true,
        sampleCount: vibrationData.length
    };
}

// Analyze sound data
function analyzeSounds() {
    const scores = {};
    
    // Analyze rear end noise (CRITICAL for test vehicle)
    scores.rearEnd = analyzeSoundComponent(soundData.rearEnd, 'Rear End', 80, 120);
    
    // Analyze engine noise
    scores.engine = analyzeSoundComponent(soundData.engine, 'Engine', 60, 100);
    
    // Analyze exhaust noise
    scores.exhaust = analyzeSoundComponent(soundData.exhaust, 'Exhaust', 50, 90);
    
    // Analyze transmission noise
    scores.transmission = analyzeSoundComponent(soundData.transmission, 'Transmission', 40, 80);
    
    // Analyze suspension noise
    scores.suspension = analyzeSoundComponent(soundData.suspension, 'Suspension', 30, 70);
    
    // Analyze brake noise
    scores.brakes = analyzeSoundComponent(soundData.brakes, 'Brakes', 100, 150);
    
    return scores;
}

// Analyze individual sound component
function analyzeSoundComponent(data, componentName, normalThreshold, criticalThreshold) {
    if (data.length === 0) {
        return { score: null, status: 'No data', issues: [], dataValid: false };
    }
    
    // Check if we have enough data
    if (data.length < MIN_SOUND_SAMPLES) {
        return { 
            score: null, 
            status: `Insufficient data (${data.length} samples, need ${MIN_SOUND_SAMPLES})`,
            issues: [],
            dataValid: false
        };
    }
    
    // Calculate average sound level
    const avgLevel = data.reduce((sum, d) => sum + d.level, 0) / data.length;
    
    // Calculate peak sound level
    const peakLevel = Math.max(...data.map(d => d.level));
    
    let score = 100;
    let status = 'Normal';
    let issues = [];
    
    if (peakLevel > criticalThreshold) {
        score = 25;
        status = 'Critical abnormal noise detected';
        issues.push(`${componentName}: Severe noise detected - immediate inspection required`);
    } else if (avgLevel > normalThreshold) {
        score = 60;
        status = 'Abnormal noise detected';
        issues.push(`${componentName}: Unusual noise levels - recommend inspection`);
    } else if (avgLevel > normalThreshold * 0.8) {
        score = 80;
        status = 'Minor noise';
        issues.push(`${componentName}: Slight noise - monitor condition`);
    }
    
    return {
        score: score,
        status: status,
        avgLevel: avgLevel.toFixed(1),
        peakLevel: peakLevel.toFixed(1),
        issues: issues,
        dataValid: true,
        sampleCount: data.length
    };
}

// Start assessment
async function startAssessment() {
    console.log('▶️ Starting assessment...');
    
    // Get vehicle information
    vehicleData.vin = document.getElementById('vinInput').value;
    vehicleData.year = document.getElementById('yearInput').value;
    vehicleData.make = document.getElementById('makeInput').value;
    vehicleData.model = document.getElementById('modelInput').value;
    vehicleData.mileage = document.getElementById('mileageInput').value;
    vehicleData.customerName = document.getElementById('customerNameInput').value;
    
    // Validate required fields
    if (!vehicleData.vin || !vehicleData.year || !vehicleData.make || !vehicleData.model) {
        alert('⚠️ Please fill in all vehicle information fields');
        return;
    }
    
    // Request sensor permissions
    const sensorsGranted = await requestSensorPermissions();
    if (!sensorsGranted) {
        return;
    }
    
    // Start scanning
    await startScanning();
}

async function startScanning() {
    showScreen('scanScreen');
    
    const statusDiv = document.getElementById('scanStatus');
    const moduleList = document.getElementById('moduleList');
    
    scanResults = {};
    moduleList.innerHTML = '';
    
    // Step 1: Read OBD2 codes if connected
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        statusDiv.textContent = '🔧 Reading OBD2 codes from vehicle...';
        await delay(2000);
        
        try {
            // Try to read actual codes
            await readActualOBD2Codes();
        } catch (error) {
            console.error('Failed to read OBD2 codes:', error);
            statusDiv.textContent = '⚠️ Could not read codes from dongle';
            await delay(1000);
        }
    } else {
        statusDiv.textContent = '⚠️ No dongle connected - proceeding with sensor assessment only';
        await delay(2000);
    }
    
    // Step 2: Start test drive
    statusDiv.textContent = '🚗 Ready for test drive!';
    await delay(1000);
    
    // Show test drive instructions
    showTestDriveInstructions();
}

// Show test drive instructions
function showTestDriveInstructions() {
    const statusDiv = document.getElementById('scanStatus');
    const moduleList = document.getElementById('moduleList');
    
    moduleList.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; text-align: center;">
            <h2 style="margin: 0 0 20px 0;">🚗 5-Minute Test Drive</h2>
            <p style="font-size: 18px; margin: 15px 0;">The app is now listening and monitoring:</p>
            <div style="text-align: left; max-width: 400px; margin: 20px auto;">
                <p>🎤 <strong>Microphone:</strong> Listening for abnormal sounds</p>
                <p>📱 <strong>Accelerometer:</strong> Monitoring vibrations</p>
                <p>🔧 <strong>OBD2:</strong> Reading diagnostic codes</p>
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0;">Test Drive Instructions:</h3>
                <ol style="text-align: left; margin: 0; padding-left: 20px;">
                    <li style="margin: 10px 0;">Start the vehicle and let it idle (30 seconds)</li>
                    <li style="margin: 10px 0;">Drive normally for 2-3 minutes</li>
                    <li style="margin: 10px 0;">Accelerate and brake several times</li>
                    <li style="margin: 10px 0;">Listen for any unusual noises</li>
                    <li style="margin: 10px 0;">Return and click "Complete Test Drive"</li>
                </ol>
            </div>
            <p style="font-size: 16px; margin: 20px 0;">⏱️ Minimum test drive: 60 seconds</p>
            <button id="completeTestDriveBtn" class="btn" style="background: white; color: #667eea; font-size: 18px; padding: 15px 40px; margin-top: 10px;">
                ✅ Complete Test Drive
            </button>
        </div>
    `;
    
    // Re-attach event listener
    document.getElementById('completeTestDriveBtn').addEventListener('click', completeTestDrive);
    
    // Start monitoring
    startTestDriveMonitoring();
    
    statusDiv.textContent = '🎤 Monitoring in progress... Drive the vehicle now!';
}

// Complete test drive
async function completeTestDrive() {
    const testDriveDuration = Date.now() - testDriveStartTime;
    
    // Validate minimum test drive duration
    if (testDriveDuration < MIN_TEST_DRIVE_DURATION) {
        const remainingSeconds = Math.ceil((MIN_TEST_DRIVE_DURATION - testDriveDuration) / 1000);
        alert(`⚠️ Test drive too short! Please continue for at least ${remainingSeconds} more seconds.`);
        return;
    }
    
    console.log('✅ Test drive completed:', testDriveDuration, 'ms');
    
    const statusDiv = document.getElementById('scanStatus');
    statusDiv.textContent = '📊 Analyzing test drive data...';
    
    // Stop monitoring and analyze
    stopTestDriveMonitoring();
    
    await delay(2000);
    
    // Show results
    showResults();
}

// Read actual OBD2 codes
async function readActualOBD2Codes() {
    if (!bluetoothCharacteristic) {
        console.log('⚠️ No Bluetooth characteristic available');
        return;
    }
    
    try {
        // Send Mode 03 command to read DTCs
        const command = new Uint8Array([0x03]);
        await bluetoothCharacteristic.writeValue(command);
        
        // Wait for response
        await delay(1000);
        
        // Read response
        const response = await bluetoothCharacteristic.readValue();
        const codes = parseDTCResponse(response);
        
        if (codes && codes.length > 0) {
            scanResults.obd2Codes = codes;
            console.log('✅ Read', codes.length, 'OBD2 codes:', codes);
        } else {
            scanResults.obd2Codes = [];
            console.log('✅ No OBD2 codes found');
        }
    } catch (error) {
        console.error('❌ Failed to read OBD2 codes:', error);
        scanResults.obd2Codes = [];
    }
}

// Parse DTC response
function parseDTCResponse(dataView) {
    const codes = [];
    
    // Parse response bytes into DTC codes
    for (let i = 0; i < dataView.byteLength - 1; i += 2) {
        const byte1 = dataView.getUint8(i);
        const byte2 = dataView.getUint8(i + 1);
        
        if (byte1 === 0 && byte2 === 0) continue;
        
        // Convert to DTC format (P0XXX, C0XXX, B0XXX, U0XXX)
        const firstChar = ['P', 'C', 'B', 'U'][byte1 >> 6];
        const code = firstChar + ((byte1 & 0x3F) << 8 | byte2).toString(16).toUpperCase().padStart(4, '0');
        codes.push(code);
    }
    
    return codes;
}

function showResults() {
    showScreen('resultsScreen');
        
        // Stop sensor monitoring and analyze data
        stopTestDriveMonitoring();
    
    // Update shop information in report
    document.getElementById('reportShopName').textContent = document.getElementById('shopName').value;
    document.getElementById('reportShopPhone').textContent = document.getElementById('shopPhone').value;
    document.getElementById('reportShopEmail').textContent = document.getElementById('shopEmail').value;
    document.getElementById('reportShopAddress').textContent = document.getElementById('shopAddress').value;
    
    // CRITICAL: Validate that we have sufficient sensor data
    const hasValidVibrationData = scanResults.vibrationScore && scanResults.vibrationScore.dataValid;
    const hasValidSoundData = scanResults.soundScores && 
        Object.values(scanResults.soundScores).some(s => s.dataValid);
    const hasOBD2Data = scanResults.obd2Codes !== undefined;
    
    // Check if we have ANY valid data
    if (!hasValidVibrationData && !hasValidSoundData && !hasOBD2Data) {
        // NO VALID DATA - Show error
        document.getElementById('finalScore').textContent = '--';
        document.getElementById('finalRating').textContent = 'INSUFFICIENT DATA';
        document.getElementById('finalRating').style.color = '#f44336';
        
        const resultsDiv = document.getElementById('reportModules');
        resultsDiv.innerHTML = `
            <div style="background: #f8d7da; padding: 30px; border-radius: 15px; text-align: center; margin: 20px 0;">
                <h2 style="color: #721c24; margin: 0 0 20px 0;">❌ Assessment Failed</h2>
                <p style="font-size: 18px; margin: 15px 0;">No valid sensor data was collected during the test drive.</p>
                <div style="text-align: left; max-width: 500px; margin: 20px auto; background: white; padding: 20px; border-radius: 10px;">
                    <h3 style="margin: 0 0 15px 0;">Possible Issues:</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li style="margin: 10px 0;">Test drive was too short (minimum 60 seconds required)</li>
                        <li style="margin: 10px 0;">Microphone permission was not granted</li>
                        <li style="margin: 10px 0;">Device accelerometer is not available</li>
                        <li style="margin: 10px 0;">OBD2 dongle is not connected</li>
                    </ul>
                </div>
                <p style="font-size: 16px; margin: 20px 0;">Please try again and ensure:</p>
                <ul style="text-align: left; max-width: 400px; margin: 0 auto; padding-left: 20px;">
                    <li>Microphone access is enabled</li>
                    <li>Test drive lasts at least 60 seconds</li>
                    <li>Vehicle is actually running during test</li>
                </ul>
            </div>
        `;
        
        console.error('❌ Assessment failed: No valid sensor data');
        return;
    }
    
    // Calculate comprehensive score from all VALID data sources
    let obd2Score = null;
    let soundScore = null;
    let vibrationScore = null;
    let totalWeight = 0;
    
    // OBD2 codes score (30% weight if available)
    if (hasOBD2Data) {
        if (scanResults.obd2Codes.length === 0) {
            obd2Score = 100;
        } else {
            obd2Score = Math.max(0, 100 - (scanResults.obd2Codes.length * 15));
        }
        totalWeight += 0.30;
    }
    
    // Sound analysis score (50% weight if available)
    if (hasValidSoundData) {
        const validSoundScores = Object.values(scanResults.soundScores)
            .filter(s => s.dataValid && s.score !== null)
            .map(s => s.score);
        
        if (validSoundScores.length > 0) {
            soundScore = validSoundScores.reduce((a, b) => a + b, 0) / validSoundScores.length;
            totalWeight += 0.50;
        }
    }
    
    // Vibration score (20% weight if available)
    if (hasValidVibrationData && scanResults.vibrationScore.score !== null) {
        vibrationScore = scanResults.vibrationScore.score;
        totalWeight += 0.20;
    }
    
    // Calculate weighted score based on available data
    let score = 0;
    if (obd2Score !== null) score += obd2Score * (0.30 / totalWeight);
    if (soundScore !== null) score += soundScore * (0.50 / totalWeight);
    if (vibrationScore !== null) score += vibrationScore * (0.20 / totalWeight);
    
    score = Math.round(score);
    
    let rating = 'Poor';
    let ratingColor = '#f44336';
    if (score >= 90) { 
        rating = 'Excellent'; 
        ratingColor = '#4CAF50';
    } else if (score >= 75) { 
        rating = 'Good'; 
        ratingColor = '#2196F3';
    } else if (score >= 60) { 
        rating = 'Fair'; 
        ratingColor = '#FF9800';
    }
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalRating').textContent = rating;
    document.getElementById('finalRating').style.color = ratingColor;
    
    // Generate report ID
    const reportId = 'VHC-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    document.getElementById('reportId').textContent = reportId;
    
    // Show vehicle details
    document.getElementById('reportVIN').textContent = vehicleData.vin;
    document.getElementById('reportVehicle').textContent = `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`;
    document.getElementById('reportMileage').textContent = `${vehicleData.mileage} miles`;
    document.getElementById('reportDate').textContent = new Date().toLocaleDateString();
    document.getElementById('reportMode').textContent = currentMode.toUpperCase() + ' Assessment';
    document.getElementById('reportCustomer').textContent = vehicleData.customerName || 'Walk-in Customer';
    
    // Show comprehensive results
    const resultsDiv = document.getElementById('reportModules');
    let html = '';
    
    // Data availability warning
    if (totalWeight < 1.0) {
        html += '<div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0;">';
        html += '<strong>⚠️ Partial Data Assessment</strong><br>';
        html += 'Some sensors did not collect sufficient data. Score is based on available data only.<br>';
        html += '<small>';
        if (!hasOBD2Data) html += '• No OBD2 connection<br>';
        if (!hasValidSoundData) html += '• Insufficient sound data<br>';
        if (!hasValidVibrationData) html += '• Insufficient vibration data<br>';
        html += '</small>';
        html += '</div>';
    }
    
    // OBD2 Codes Section
    html += '<h3 style="margin-top: 20px;">🔧 OBD2 Diagnostic Codes</h3>';
    if (hasOBD2Data) {
        if (scanResults.obd2Codes.length > 0) {
            html += '<div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0;">';
            html += `<strong>⚠️ ${scanResults.obd2Codes.length} code(s) detected:</strong><br>`;
            html += scanResults.obd2Codes.join(', ');
            html += '</div>';
        } else {
            html += '<div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 10px 0;">';
            html += '✅ No diagnostic codes found';
            html += '</div>';
        }
    } else {
        html += '<div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 10px 0;">';
        html += '❌ No OBD2 dongle connected';
        html += '</div>';
    }
    
    // Sound Analysis Section
    html += '<h3 style="margin-top: 20px;">🎤 Sound Analysis</h3>';
    if (hasValidSoundData) {
        for (const [component, data] of Object.entries(scanResults.soundScores)) {
            if (!data.dataValid || data.score === null) {
                html += `<div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 10px 0;">`;
                html += `<strong>❌ ${component.charAt(0).toUpperCase() + component.slice(1)}:</strong> ${data.status}`;
                html += '</div>';
                continue;
            }
            
            const bgColor = data.score >= 80 ? '#d4edda' : data.score >= 60 ? '#fff3cd' : '#f8d7da';
            const icon = data.score >= 80 ? '✅' : data.score >= 60 ? '⚠️' : '❌';
            
            html += `<div style="background: ${bgColor}; padding: 15px; border-radius: 8px; margin: 10px 0;">`;
            html += `<strong>${icon} ${component.charAt(0).toUpperCase() + component.slice(1)}:</strong> `;
            html += `Score ${data.score}/100 - ${data.status}<br>`;
            html += `<small>Samples: ${data.sampleCount} | Avg: ${data.avgLevel} | Peak: ${data.peakLevel}</small><br>`;
            if (data.issues && data.issues.length > 0) {
                html += `<small>${data.issues.join('<br>')}</small>`;
            }
            html += '</div>';
        }
    } else {
        html += '<div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 10px 0;">';
        html += '❌ No valid sound data collected - microphone may not have been enabled or test drive was too short';
        html += '</div>';
    }
    
    // Vibration Analysis Section
    html += '<h3 style="margin-top: 20px;">📱 Vibration Analysis</h3>';
    if (hasValidVibrationData) {
        const vib = scanResults.vibrationScore;
        const bgColor = vib.score >= 80 ? '#d4edda' : vib.score >= 60 ? '#fff3cd' : '#f8d7da';
        const icon = vib.score >= 80 ? '✅' : vib.score >= 60 ? '⚠️' : '❌';
        
        html += `<div style="background: ${bgColor}; padding: 15px; border-radius: 8px; margin: 10px 0;">`;
        html += `<strong>${icon} Vibration Score:</strong> ${vib.score}/100 - ${vib.status}<br>`;
        html += `<small>Samples: ${vib.sampleCount} | Average: ${vib.avgMagnitude} m/s² | Peak: ${vib.peakMagnitude} m/s²</small><br>`;
        if (vib.issues && vib.issues.length > 0) {
            html += `<small>${vib.issues.join('<br>')}</small>`;
        }
        html += '</div>';
    } else {
        html += '<div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 10px 0;">';
        html += '❌ ' + (scanResults.vibrationScore ? scanResults.vibrationScore.status : 'No vibration data collected');
        html += '</div>';
    }
    
    // Overall Summary
    html += '<div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">';
    html += `<h3 style="margin: 0 0 10px 0;">📊 Overall Assessment</h3>`;
    html += `<p style="font-size: 18px; margin: 5px 0;">Score: <strong>${score}/100</strong> (${rating})</p>`;
    html += `<p style="margin: 5px 0;">`;
    if (obd2Score !== null) html += `OBD2: ${obd2Score}/100 | `;
    if (soundScore !== null) html += `Sound: ${Math.round(soundScore)}/100 | `;
    if (vibrationScore !== null) html += `Vibration: ${vibrationScore}/100`;
    html += `</p>`;
    html += '<p style="font-size: 14px; margin: 10px 0; opacity: 0.9;">Score based on available data sources</p>';
    html += '</div>';
    
    resultsDiv.innerHTML = html;
    
    console.log(`📊 Assessment complete: ${score} (${rating})`);
    console.log(`Data sources: OBD2=${obd2Score !== null}, Sound=${soundScore !== null}, Vibration=${vibrationScore !== null}`);
}

// Report Generation Functions
async function printReport() {
    // Add print styles
    const printStyles = document.createElement('style');
    printStyles.textContent = `
        @media print {
            body { background: white; padding: 20px; }
            .action-buttons, .btn { display: none !important; }
            .report-preview { border: none; box-shadow: none; }
            .container { box-shadow: none; }
        }
    `;
    document.head.appendChild(printStyles);
    
    // Print dialog
    window.print();
    
    // Remove print styles
    setTimeout(() => {
        document.head.removeChild(printStyles);
    }, 1000);
    
    console.log('🖨️ Print dialog opened');
}

async function emailReport() {
    // Generate PDF
    console.log('📧 Generating PDF for email...');
    
    const shopName = document.getElementById('shopName').value;
    const reportId = document.getElementById('reportId').textContent;
    const score = document.getElementById('finalScore').textContent;
    
    // Create email content
    const subject = `Vehicle Assessment Report - ${reportId}`;
    const body = `Dear Customer,\n\nPlease find attached your vehicle assessment report from ${shopName}.\n\nReport Summary:\n- Overall Score: ${score}/100\n- Report ID: ${reportId}\n- Vehicle: ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}\n- Assessment Date: ${new Date().toLocaleDateString()}\n\nFor questions about this report or to schedule service, please contact us at:\n${document.getElementById('shopPhone').value}\n${document.getElementById('shopEmail').value}\n\n${document.getElementById('shopAddress').value}\n\nThank you for choosing ${shopName}!\n`;
    
    // Create mailto link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    
    console.log('📧 Email client opened');
}

// Utility functions
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show selected screen
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
        console.log('📱 Showing screen:', screenId);
    } else {
        console.error('❌ Screen not found:', screenId);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Service Worker for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('✅ Service Worker registered:', registration.scope);
            })
            .catch(error => {
                console.error('❌ Service Worker registration failed:', error);
            });
    });
}
