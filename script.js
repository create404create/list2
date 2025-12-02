// DNC Checker - Main JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('DNC Checker initialized');
    initializeApp();
});

// Configuration
const CONFIG = {
    apiEndpoints: {
        tcpa: 'https://api.uspeoplesearch.net/tcpa/v1?x=',
        person: 'https://api.uspeoplesearch.net/person/v3?x=',
        premium: 'https://premium_lookup-1-h4761841.deta.app/person?x=',
        report: 'https://api.uspeoplesearch.net/tcpa/report?x='
    },
    requestDelay: 150,
    timeout: 10000,
    maxRetries: 2
};

// Application State
const AppState = {
    numbers: [],
    results: {
        clean: [],
        dnc: [],
        invalid: []
    },
    isProcessing: false,
    startTime: null,
    stats: {
        total: 0,
        processed: 0,
        timeElapsed: 0
    }
};

// DOM Elements
const Elements = {
    phoneList: document.getElementById('phoneList'),
    checkBtn: document.getElementById('checkBtn'),
    sampleBtn: document.getElementById('sampleBtn'),
    resetBtn: document.getElementById('resetBtn'),
    copyBtn: document.getElementById('copyBtn'),
    statsBtn: document.getElementById('statsBtn'),
    progressContainer: document.getElementById('progressContainer'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    cleanNumbers: document.getElementById('cleanNumbers'),
    dncNumbers: document.getElementById('dncNumbers'),
    invalidNumbers: document.getElementById('invalidNumbers'),
    cleanCount: document.getElementById('cleanCount'),
    dncCount: document.getElementById('dncCount'),
    invalidCount: document.getElementById('invalidCount'),
    totalNumbers: document.getElementById('totalNumbers'),
    cleanPercent: document.getElementById('cleanPercent'),
    timeTaken: document.getElementById('timeTaken')
};

// Initialize Application
function initializeApp() {
    // Event Listeners
    Elements.checkBtn.addEventListener('click', startProcessing);
    Elements.sampleBtn.addEventListener('click', loadSampleNumbers);
    Elements.resetBtn.addEventListener('click', resetApplication);
    Elements.copyBtn.addEventListener('click', copyAllResults);
    
    // Load sample numbers on start
    loadSampleNumbers();
    
    // Load saved state
    loadState();
    
    console.log('App initialized successfully');
}

// Load Sample Numbers
function loadSampleNumbers() {
    const samples = [
        '+12345678901',
        '+12345678902',
        '+12345678903',
        '+12345678904',
        '+12345678905',
        '+12345678906',
        '+12345678907',
        '+12345678908',
        '+12345678909',
        '+12345678910'
    ];
    
    Elements.phoneList.value = samples.join('\n');
    updateStats();
}

// Parse Phone Numbers
function parsePhoneNumbers() {
    const input = Elements.phoneList.value.trim();
    if (!input) {
        alert('Please enter phone numbers to check!');
        return [];
    }
    
    // Split and clean numbers
    let numbers = input.split(/[\n,\s]+/)
        .map(num => num.trim())
        .filter(num => num.length > 0);
    
    // Format numbers
    numbers = numbers.map(num => {
        let cleanNum = num.replace(/[^\d+]/g, '');
        
        if (!cleanNum.startsWith('+')) {
            if (cleanNum.length === 10) {
                cleanNum = '+1' + cleanNum;
            } else if (cleanNum.length === 11 && cleanNum.startsWith('1')) {
                cleanNum = '+' + cleanNum;
            }
        }
        
        return cleanNum;
    });
    
    // Remove duplicates
    numbers = [...new Set(numbers)];
    
    return numbers;
}

// Validate Phone Number
function validatePhoneNumber(number) {
    const usRegex = /^\+1\d{10}$/;
    
    if (!usRegex.test(number)) {
        return { valid: false, reason: 'Invalid format' };
    }
    
    const areaCode = number.substring(2, 5);
    if (areaCode < 200 || areaCode > 999) {
        return { valid: false, reason: 'Invalid area code' };
    }
    
    return { valid: true };
}

// Check Single Number via API
async function checkNumberAPI(phoneNumber) {
    console.log(`Checking: ${phoneNumber}`);
    
    // Local validation first
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
        return {
            number: phoneNumber,
            status: 'invalid',
            reason: validation.reason,
            timestamp: new Date().toISOString()
        };
    }
    
    // Try different endpoints
    for (let [endpointName, endpointUrl] of Object.entries(CONFIG.apiEndpoints)) {
        for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
            try {
                const url = endpointUrl + encodeURIComponent(phoneNumber);
                console.log(`Attempt ${attempt}: ${endpointName} - ${url}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'DNC-Checker/1.0'
                    },
                    signal: controller.signal,
                    mode: 'cors'
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Response from ${endpointName}:`, data);
                    
                    // Analyze response
                    const dncIndicators = [
                        data.dnc, data.dnd, data.tcpa, data.doNotCall,
                        data.wireless === false, data.blocked, data.restricted
                    ];
                    
                    if (dncIndicators.some(indicator => indicator === true)) {
                        return {
                            number: phoneNumber,
                            status: 'dnc',
                            data: data,
                            source: endpointName,
                            timestamp: new Date().toISOString()
                        };
                    }
                    
                    // Check for valid response
                    if (data.status && data.status.toLowerCase() === 'valid') {
                        return {
                            number: phoneNumber,
                            status: 'clean',
                            data: data,
                            source: endpointName,
                            timestamp: new Date().toISOString()
                        };
                    }
                }
            } catch (error) {
                console.log(`${endpointName} attempt ${attempt} failed:`, error.message);
                if (attempt < CONFIG.maxRetries) {
                    await sleep(CONFIG.requestDelay * attempt);
                    continue;
                }
            }
            break;
        }
    }
    
    // All attempts failed
    return {
        number: phoneNumber,
        status: 'invalid',
        reason: 'All API checks failed',
        timestamp: new Date().toISOString()
    };
}

// Start Processing
async function startProcessing() {
    if (AppState.isProcessing) {
        alert('Processing is already in progress!');
        return;
    }
    
    // Parse numbers
    AppState.numbers = parsePhoneNumbers();
    if (AppState.numbers.length === 0) return;
    
    // Reset previous results
    resetResults();
    
    // Setup UI
    AppState.isProcessing = true;
    AppState.startTime = Date.now();
    AppState.stats.total = AppState.numbers.length;
    
    Elements.checkBtn.disabled = true;
    Elements.checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
    Elements.progressContainer.style.display = 'block';
    
    // Save state
    saveState();
    
    // Process numbers
    for (let i = 0; i < AppState.numbers.length; i++) {
        if (!AppState.isProcessing) break;
        
        const number = AppState.numbers[i];
        
        // Update progress
        updateProgress(i + 1, AppState.numbers.length);
        
        // Check number
        const result = await checkNumberAPI(number);
        
        // Display result
        displayResult(result);
        
        // Update stats
        AppState.stats.processed = i + 1;
        updateStats();
        
        // Delay between requests
        if (i < AppState.numbers.length - 1) {
            await sleep(CONFIG.requestDelay);
        }
    }
    
    // Complete processing
    completeProcessing();
}

// Update Progress
function updateProgress(current, total) {
    const percentage = Math.round((current / total) * 100);
    Elements.progressBar.style.width = `${percentage}%`;
    Elements.progressBar.textContent = `${percentage}%`;
    Elements.progressText.innerHTML = `<i class="fas fa-sync-alt fa-spin me-2"></i>Processing ${current} of ${total} numbers...`;
}

// Display Result
function displayResult(result) {
    const item = document.createElement('div');
    item.className = `number-item ${result.status}`;
    
    item.innerHTML = `
        <span>${result.number}</span>
        <span class="number-badge badge-${result.status}">
            ${result.status.toUpperCase()}
        </span>
    `;
    
    switch (result.status) {
        case 'clean':
            AppState.results.clean.push(result);
            Elements.cleanNumbers.appendChild(item);
            Elements.cleanCount.textContent = AppState.results.clean.length;
            break;
            
        case 'dnc':
            AppState.results.dnc.push(result);
            Elements.dncNumbers.appendChild(item);
            Elements.dncCount.textContent = AppState.results.dnc.length;
            break;
            
        case 'invalid':
            AppState.results.invalid.push(result);
            Elements.invalidNumbers.appendChild(item);
            Elements.invalidCount.textContent = AppState.results.invalid.length;
            break;
    }
}

// Complete Processing
function completeProcessing() {
    AppState.isProcessing = false;
    
    Elements.checkBtn.disabled = false;
    Elements.checkBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>Check Complete';
    Elements.progressBar.className = 'progress-bar bg-success';
    Elements.progressText.innerHTML = '<i class="fas fa-check me-2"></i>All numbers processed successfully!';
    
    // Update final stats
    updateStats();
    
    // Save final state
    saveState();
    
    // Show completion alert
    setTimeout(() => {
        const clean = AppState.results.clean.length;
        const dnc = AppState.results.dnc.length;
        const invalid = AppState.results.invalid.length;
        
        alert(`✅ Processing Complete!\n\n📊 Results:\n• Clean: ${clean}\n• DNC: ${dnc}\n• Invalid: ${invalid}\n\nTime: ${Math.round((Date.now() - AppState.startTime) / 1000)} seconds`);
    }, 500);
}

// Update Statistics
function updateStats() {
    Elements.totalNumbers.textContent = AppState.stats.total;
    
    if (AppState.stats.processed > 0) {
        const cleanRate = Math.round((AppState.results.clean.length / AppState.stats.processed) * 100);
        Elements.cleanPercent.textContent = `${cleanRate}%`;
    }
    
    if (AppState.startTime) {
        const elapsed = Math.floor((Date.now() - AppState.startTime) / 1000);
        Elements.timeTaken.textContent = `${elapsed}s`;
        AppState.stats.timeElapsed = elapsed;
    }
}

// Export Data
function exportData(type) {
    const numbers = AppState.results[type];
    if (numbers.length === 0) {
        alert(`No ${type} numbers to export!`);
        return;
    }
    
    const text = numbers.map(item => item.number).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_numbers_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Copy All Results
function copyAllResults() {
    const allResults = [
        '=== CLEAN NUMBERS ===',
        ...AppState.results.clean.map(r => r.number),
        '',
        '=== DNC NUMBERS ===',
        ...AppState.results.dnc.map(r => r.number),
        '',
        '=== INVALID NUMBERS ===',
        ...AppState.results.invalid.map(r => r.number)
    ].join('\n');
    
    navigator.clipboard.writeText(allResults)
        .then(() => alert('✅ All results copied to clipboard!'))
        .catch(err => alert('❌ Failed to copy: ' + err));
}

// Reset Application
function resetApplication() {
    if (AppState.isProcessing && !confirm('Processing is in progress. Reset anyway?')) {
        return;
    }
    
    // Reset state
    AppState.numbers = [];
    AppState.results = { clean: [], dnc: [], invalid: [] };
    AppState.isProcessing = false;
    AppState.startTime = null;
    AppState.stats = { total: 0, processed: 0, timeElapsed: 0 };
    
    // Reset UI
    Elements.phoneList.value = '';
    Elements.progressContainer.style.display = 'none';
    Elements.progressBar.style.width = '0%';
    Elements.progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    Elements.checkBtn.innerHTML = '<i class="fas fa-play-circle me-2"></i>Start Checking';
    Elements.checkBtn.disabled = false;
    
    resetResults();
    updateStats();
    
    // Clear saved state
    localStorage.removeItem('dncCheckerState');
}

// Reset Results Only
function resetResults() {
    AppState.results = { clean: [], dnc: [], invalid: [] };
    
    Elements.cleanNumbers.innerHTML = '';
    Elements.dncNumbers.innerHTML = '';
    Elements.invalidNumbers.innerHTML = '';
    
    Elements.cleanCount.textContent = '0';
    Elements.dncCount.textContent = '0';
    Elements.invalidCount.textContent = '0';
}

// Save State
function saveState() {
    const state = {
        numbers: AppState.numbers,
        results: AppState.results,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('dncCheckerState', JSON.stringify(state));
}

// Load State
function loadState() {
    const saved = localStorage.getItem('dncCheckerState');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            
            // Restore numbers
            if (data.numbers && data.numbers.length > 0) {
                Elements.phoneList.value = data.numbers.join('\n');
            }
            
            // Restore results if recent (1 hour)
            const savedTime = new Date(data.timestamp);
            const currentTime = new Date();
            const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);
            
            if (hoursDiff < 1 && data.results) {
                AppState.results = data.results;
                
                // Redisplay results
                ['clean', 'dnc', 'invalid'].forEach(type => {
                    data.results[type].forEach(result => {
                        displayResult(result);
                    });
                });
                
                updateStats();
            }
        } catch (e) {
            console.log('Error loading state:', e);
        }
    }
}

// Utility Functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Add to global scope for button onclick handlers
window.exportData = exportData;
