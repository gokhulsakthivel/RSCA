/**
 * Main Application Module
 * Orchestrates file upload, analysis workflow, and UI updates
 */

// Global state
let appState = {
    filename: '',
    csvData: null,
    baseInfo: null,
    processedData: null,
    haltRecords: null,
    segments: null,
    currentStep: 1
};

/**
 * Update step indicator UI
 * @param {number} activeStep - The currently active step (1, 2, or 3)
 */
function updateStepIndicator(activeStep) {
    appState.currentStep = activeStep;
    const steps = document.querySelectorAll('.step');
    const lines = document.querySelectorAll('.step-line');

    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        if (stepNum < activeStep) {
            step.classList.add('completed');
        } else if (stepNum === activeStep) {
            step.classList.add('active');
        }
    });

    lines.forEach((line, index) => {
        line.classList.remove('completed');
        if (index < activeStep - 1) {
            line.classList.add('completed');
        }
    });
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for external libraries to load
    setTimeout(() => {
        initializeApp();
        checkLibraries();
    }, 500);
});

/**
 * Check if required libraries are loaded
 */
function checkLibraries() {
    console.log('Checking libraries...');
    console.log('Papa Parse:', typeof Papa !== 'undefined' ? '✓' : '✗');
    console.log('Plotly:', typeof Plotly !== 'undefined' ? '✓' : '✗');
    console.log('docx:', typeof window.docx !== 'undefined' ? '✓' : '✗');
    console.log('FileSaver:', typeof saveAs !== 'undefined' ? '✓' : '✗');
    console.log('html2canvas:', typeof html2canvas !== 'undefined' ? '✓' : '✗');
    
    if (typeof window.docx === 'undefined') {
        console.warn('Warning: docx library not loaded. Word export will not work.');
    }
}

/**
 * Initialize application
 */
function initializeApp() {
    console.log('Initializing GPS Speed Chart Analysis application...');
    
    // Get DOM elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const downloadBtn = document.getElementById('downloadPdfBtn');
    
    // Set up drag and drop handlers
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    // Word document download button handler
    downloadBtn.addEventListener('click', () => {
        if (appState.baseInfo && appState.haltRecords) {
            showDownloadProgress('Generating Word document...');
            PDFGenerator.generatePDF(appState.baseInfo, appState.haltRecords, appState.overspeedViolations, appState.config)
                .then(() => {
                    hideDownloadProgress();
                })
                .catch(error => {
                    hideDownloadProgress();
                    showError('Error generating Word document: ' + error.message);
                });
        }
    });
    
    // Generate Analysis button handler
    const generateBtn = document.getElementById('generateAnalysisBtn');
    generateBtn.addEventListener('click', () => {
        generateAnalysis();
    });
    
    // Initialize compare mode
    initCompareMode();
    
    console.log('Application initialized');
}

/**
 * Handle file selection
 * @param {File} file - Selected file
 */
function handleFileSelect(file) {
    if (!file.name.endsWith('.csv')) {
        showError('Please select a CSV file');
        return;
    }
    
    console.log('File selected:', file.name);
    appState.filename = file.name;
    
    showProgress('Reading file...');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        processCSV(content);
    };
    reader.onerror = () => {
        hideProgress();
        showError('Error reading file');
    };
    reader.readAsText(file);
}

/**
 * Process CSV content
 * @param {string} csvContent - CSV file content
 */
async function processCSV(csvContent) {
    try {
        showProgress('Parsing CSV...');
        
        // Step 1: Parse CSV
        const csvData = await CSVParser.parseCSV(csvContent);
        appState.csvData = csvData;
        console.log('CSV parsed:', csvData.rows.length, 'rows');
        
        showProgress('Extracting base information...');
        
        // Get user overrides
        const overrides = {
            pilot: document.getElementById('pilotName').value.trim(),
            train: document.getElementById('trainNumber').value.trim(),
            loco: document.getElementById('locoNumber').value.trim(),
            date: document.getElementById('serviceDate').value.trim()
        };
        
        // Step 2: Extract base info
        const baseInfo = BaseInfo.generateBaseInfo(csvData, appState.filename, overrides);
        appState.baseInfo = baseInfo;
        console.log('Base info:', baseInfo);
        
        showProgress('Processing data...');
        
        // Determine base date
        const baseDate = baseInfo.date ? new Date(baseInfo.date) : new Date();
        
        // Step 3: Process data
        const processedData = DataProcessor.processData(csvData, baseDate);
        appState.processedData = processedData;
        console.log('Data processed:', processedData.times.length, 'records');
        
        if (processedData.times.length === 0) {
            hideProgress();
            showError('No valid data found in CSV file');
            return;
        }
        
        hideProgress();
        
        // Step 4: Show configuration form

        updateStepIndicator(2);
        showConfigurationForm(processedData);
        
    } catch (error) {
        console.error('Error processing CSV:', error);
        hideProgress();
        showError('Error processing CSV: ' + error.message);
    }
}

/**
 * Show configuration form
 * @param {Object} processedData - Processed data
 */
function showConfigurationForm(processedData) {
    const configSection = document.getElementById('configSection');
    
    // Populate station dropdowns
    const uniqueStations = DataProcessor.getUniqueStations(processedData.stations);
    const startStationSelect = document.getElementById('startStation');
    const endStationSelect = document.getElementById('endStation');
    
    // Clear existing options except the first one
    startStationSelect.innerHTML = '<option value="">-- All Stations (From Beginning) --</option>';
    endStationSelect.innerHTML = '<option value="">-- All Stations (To End) --</option>';
    
    // Add station options
    uniqueStations.forEach(station => {
        const option1 = document.createElement('option');
        option1.value = station;
        option1.textContent = station;
        startStationSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = station;
        option2.textContent = station;
        endStationSelect.appendChild(option2);
    });
    
    // Show configuration section
    configSection.style.display = 'block';
    
    // Scroll to configuration section
    configSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    console.log(`Configuration form ready with ${uniqueStations.length} stations`);
}

/**
 * Generate analysis with configuration
 */
function generateAnalysis() {
    try {
        showProgress('Applying configuration...');
        
        // Get configuration values
        const config = {
            startStation: document.getElementById('startStation').value,
            endStation: document.getElementById('endStation').value,
            decelDistance: parseInt(document.getElementById('decelDistance').value) || 1000,
            decelMarkers: parseMarkers(document.getElementById('decelMarkers').value),
            maxSpeed: parseInt(document.getElementById('maxSpeed').value) || 110
        };
        
        console.log('Configuration:', config);
        
        // Validate configuration
        if (config.decelDistance < 100) {
            showError('Deceleration distance must be at least 100 meters');
            hideProgress();
            return;
        }
        
        if (config.maxSpeed < 1) {
            showError('Maximum speed must be at least 1 km/h');
            hideProgress();
            return;
        }
        
        // Store config in appState
        appState.config = config;
        
        showProgress('Filtering data by station range...');
        
        // Filter data by station range
        const filteredData = DataProcessor.filterDataByStations(
            appState.processedData,
            config.startStation,
            config.endStation
        );
        
        showProgress('Detecting halts...');
        
        // Detect halts on filtered data
        const haltRecords = HaltDetector.detectHalts(filteredData, appState.csvData, appState.baseInfo);
        appState.haltRecords = haltRecords;
        console.log('Halt records:', haltRecords.length);
        
        showProgress('Detecting overspeeds...');
        
        // Detect overspeeds on filtered data
        const overspeedViolations = OverspeedDetector.detectOverspeeds(filteredData, config.maxSpeed);
        appState.overspeedViolations = overspeedViolations;
        console.log('Overspeed violations:', overspeedViolations.length);
        
        showProgress('Generating charts...');
        
        // Display results with filtered data

        updateStepIndicator(3);
        displayResults(filteredData, config);
        
        hideProgress();
        
    } catch (error) {
        console.error('Error generating analysis:', error);
        hideProgress();
        showError('Error generating analysis: ' + error.message);
    }
}

/**
 * Parse marker string to array of numbers
 * @param {string} markerStr - Comma-separated marker distances
 * @returns {Array<number>} Array of marker distances
 */
function parseMarkers(markerStr) {
    if (!markerStr || !markerStr.trim()) {
        return [120, 60]; // Default
    }
    
    const markers = markerStr.split(',')
        .map(m => parseInt(m.trim()))
        .filter(m => !isNaN(m) && m > 0);
    
    return markers.length > 0 ? markers : [120, 60];
}

/**
 * Display results
 * @param {Object} data - Filtered processed data
 * @param {Object} config - Configuration object
 */
function displayResults(data, config) {
    data = data || appState.processedData;
    config = config || appState.config || {};
    // Show results container
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.style.display = 'block';
    
    // Display base info table
    displayBaseInfoTable();
    
    // Generate main speed chart
    const segments = ChartGenerator.generateMainSpeedChart(
        data,
        'mainSpeedChart'
    );
    appState.segments = segments;
    
    // Generate deceleration charts if there are segments
    if (segments && segments.length > 0) {
        document.getElementById('decelChartsSection').style.display = 'block';
        ChartGenerator.generateDecelerationCharts(
            data,
            segments,
            'decelChartsContainer',
            config
        );
    }
    
    // Display overspeed violations
    if (appState.overspeedViolations) {
        document.getElementById('overspeedSection').style.display = 'block';
        const overspeedContainer = document.getElementById('overspeedTableContainer');
        OverspeedDetector.displayOverspeedTable(appState.overspeedViolations, overspeedContainer);
    }
    
    // Display halt arrival table
    if (appState.haltRecords && appState.haltRecords.length > 0) {
        document.getElementById('haltTableSection').style.display = 'block';
        displayHaltTable();
    }
    
    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Display base info summary table
 */
function displayBaseInfoTable() {
    const container = document.getElementById('baseInfoTable');
    const info = appState.baseInfo;
    
    const table = document.createElement('table');
    
    const summaryPairs = [
        ['LOCO_PILOT', info.pilot, 'SECTION', info.section],
        ['TRAIN_NUMBER', info.trainNumber, 'DATE', info.date],
        ['LOCO_NUMBER', info.locoNumber, 'TIMING', info.timing]
    ];
    
    summaryPairs.forEach(([labelA, valueA, labelB, valueB]) => {
        const row = table.insertRow();
        
        const cellA1 = row.insertCell();
        cellA1.textContent = labelA;
        
        const cellA2 = row.insertCell();
        cellA2.textContent = valueA;
        
        const cellB1 = row.insertCell();
        cellB1.textContent = labelB;
        
        const cellB2 = row.insertCell();
        cellB2.textContent = valueB;
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * Display halt arrival table
 */
function displayHaltTable() {
    const container = document.getElementById('haltTableContainer');
    
    const table = document.createElement('table');
    
    // Header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const headers = ['DEVICE_ID', 'LOCO_NUMBER', 'LOCO_SPEED', 'STATION_CODE', 'EVENT_DETECTION_TIME', 'EVENT_TYPE_FLAG', 'LATITUDE', 'LONGITUDE'];
    
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    // Body
    const tbody = table.createTBody();
    appState.haltRecords.forEach(record => {
        const row = tbody.insertRow();
        
        [
            record.deviceId,
            record.locoNumber,
            record.speed,
            record.station,
            record.time,
            record.eventType,
            record.latitude,
            record.longitude
        ].forEach(value => {
            const cell = row.insertCell();
            cell.textContent = value;
        });
    });
    
    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * Show progress bar with message
 * @param {string} message - Progress message
 */
function showProgress(message) {
    const progressBar = document.getElementById('progressBar');
    const progressText = progressBar.querySelector('.progress-text');
    
    progressText.textContent = message;
    progressBar.style.display = 'block';
}

/**
 * Hide progress bar
 */
function hideProgress() {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.display = 'none';
}

/**
 * Show download progress bar with message
 * @param {string} message - Progress message
 */
function showDownloadProgress(message) {
    const progressBar = document.getElementById('downloadProgressBar');
    const progressText = progressBar.querySelector('.progress-text');
    
    progressText.textContent = message;
    progressBar.style.display = 'block';
}

/**
 * Hide download progress bar
 */
function hideDownloadProgress() {
    const progressBar = document.getElementById('downloadProgressBar');
    progressBar.style.display = 'none';
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    alert('Error: ' + message);
    console.error(message);
}

// ============================================================
// MULTI-TRAIN COMPARE MODE
// ============================================================

/** Current mode: 'single' or 'compare' */
let currentMode = 'single';

/** Selected common stations for comparison */
let selectedCompareStations = new Set();

/**
 * Switch between Single Analysis and Multi-Train Compare modes
 * @param {string} mode - 'single' or 'compare'
 */
function switchMode(mode) {
    currentMode = mode;
    const singleSection = document.getElementById('singleSection');
    const compareSection = document.getElementById('compareSection');
    const modeSingleBtn = document.getElementById('modeSingle');
    const modeCompareBtn = document.getElementById('modeCompare');

    if (mode === 'single') {
        singleSection.style.display = 'block';
        compareSection.style.display = 'none';
        modeSingleBtn.classList.add('active');
        modeCompareBtn.classList.remove('active');
    } else {
        singleSection.style.display = 'none';
        compareSection.style.display = 'block';
        modeSingleBtn.classList.remove('active');
        modeCompareBtn.classList.add('active');
    }
}

/**
 * Initialize compare mode event listeners
 */
function initCompareMode() {
    const compareDropZone = document.getElementById('compareDropZone');
    const compareFileInput = document.getElementById('compareFileInput');

    if (!compareDropZone || !compareFileInput) return;

    compareDropZone.addEventListener('click', (e) => {
        // Avoid triggering if the upload-link anchor was clicked (it handles its own click)
        if (e.target.closest('.upload-link')) return;
        compareFileInput.click();
    });

    compareDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        compareDropZone.classList.add('drag-over');
    });

    compareDropZone.addEventListener('dragleave', () => {
        compareDropZone.classList.remove('drag-over');
    });

    compareDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        compareDropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleCompareFiles(files);
        }
    });

    compareFileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleCompareFiles(files);
        }
    });

    // Generate comparison button
    const generateCompareBtn = document.getElementById('generateCompareBtn');
    if (generateCompareBtn) {
        generateCompareBtn.addEventListener('click', () => {
            generateComparison();
        });
    }
}

/**
 * Handle multiple file selection for comparison
 * @param {FileList} files - Selected files
 */
async function handleCompareFiles(files) {
    const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));

    if (csvFiles.length < 2) {
        showError('Please select at least 2 CSV files for comparison');
        return;
    }

    MultiCompare.reset();
    showCompareProgress('Processing files...');

    // Hide previous results
    document.getElementById('compareConfigSection').style.display = 'none';
    document.getElementById('compareResultsContainer').style.display = 'none';

    try {
        for (let i = 0; i < csvFiles.length; i++) {
            const file = csvFiles[i];
            showCompareProgress(`Parsing file ${i + 1} of ${csvFiles.length}: ${file.name}`);

            const content = await readFileAsync(file);
            const csvData = await CSVParser.parseCSV(content);

            const overrides = {};
            const baseInfo = BaseInfo.generateBaseInfo(csvData, file.name, overrides);

            const baseDate = baseInfo.date ? new Date(baseInfo.date) : new Date();
            const processedData = DataProcessor.processData(csvData, baseDate);

            if (processedData.times.length === 0) {
                console.warn(`File ${file.name} has no valid data, skipping`);
                continue;
            }

            MultiCompare.addFile(file.name, csvData, processedData, baseInfo);
        }

        hideCompareProgress();

        if (MultiCompare.files.length < 2) {
            showError('Need at least 2 valid CSV files for comparison');
            return;
        }

        // Show uploaded file list
        displayCompareFileList();

        // Find common halt stations and show config
        showCompareConfig();

    } catch (error) {
        hideCompareProgress();
        showError('Error processing files: ' + error.message);
        console.error(error);
    }
}

/**
 * Read a file as text (promise-based)
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Error reading file: ' + file.name));
        reader.readAsText(file);
    });
}

/**
 * Display list of uploaded files with color indicators
 */
function displayCompareFileList() {
    const listContainer = document.getElementById('compareFileList');
    const itemsContainer = document.getElementById('compareFileItems');
    itemsContainer.innerHTML = '';

    MultiCompare.files.forEach((file, idx) => {
        const color = MultiCompare.trainColors[idx % MultiCompare.trainColors.length];
        const item = document.createElement('div');
        item.className = 'compare-file-item';
        item.innerHTML = `
            <span class="compare-file-color" style="background: ${color};"></span>
            <span class="compare-file-name">${file.label}</span>
            <span class="compare-file-records">${file.processedData.times.length.toLocaleString()} records</span>
        `;
        itemsContainer.appendChild(item);
    });

    listContainer.style.display = 'block';
}

/**
 * Show compare configuration with common stations
 */
function showCompareConfig() {
    const commonStations = MultiCompare.findCommonHaltStations();
    const configSection = document.getElementById('compareConfigSection');
    const chipsContainer = document.getElementById('commonStationChips');
    chipsContainer.innerHTML = '';
    selectedCompareStations.clear();

    if (commonStations.length === 0) {
        chipsContainer.innerHTML = '<p style="color: var(--color-text-muted);">No common halt stations found across all uploaded files.</p>';
        configSection.style.display = 'block';
        configSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    // Create chips for each common station
    commonStations.forEach(station => {
        const chip = document.createElement('button');
        chip.className = 'station-chip';
        chip.textContent = station;
        chip.dataset.station = station;
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            if (selectedCompareStations.has(station)) {
                selectedCompareStations.delete(station);
            } else {
                selectedCompareStations.add(station);
            }
            updateSelectAllState();
        });
        chipsContainer.appendChild(chip);
    });

    // "Select All" button
    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'station-chip select-all-chip';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.id = 'selectAllChip';
    selectAllBtn.addEventListener('click', () => {
        const allSelected = selectedCompareStations.size === commonStations.length;
        const chips = chipsContainer.querySelectorAll('.station-chip:not(.select-all-chip)');
        if (allSelected) {
            // Deselect all
            selectedCompareStations.clear();
            chips.forEach(c => c.classList.remove('selected'));
            selectAllBtn.classList.remove('selected');
            selectAllBtn.textContent = 'Select All';
        } else {
            // Select all
            commonStations.forEach(s => selectedCompareStations.add(s));
            chips.forEach(c => c.classList.add('selected'));
            selectAllBtn.classList.add('selected');
            selectAllBtn.textContent = 'Deselect All';
        }
    });
    chipsContainer.prepend(selectAllBtn);

    configSection.style.display = 'block';
    configSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Update Select All button state based on current selection
 */
function updateSelectAllState() {
    const commonStations = MultiCompare.findCommonHaltStations();
    const selectAllBtn = document.getElementById('selectAllChip');
    if (!selectAllBtn) return;

    if (selectedCompareStations.size === commonStations.length) {
        selectAllBtn.classList.add('selected');
        selectAllBtn.textContent = 'Deselect All';
    } else {
        selectAllBtn.classList.remove('selected');
        selectAllBtn.textContent = 'Select All';
    }
}

/**
 * Generate comparison charts for selected stations
 */
function generateComparison() {
    if (selectedCompareStations.size === 0) {
        showError('Please select at least one station');
        return;
    }

    const config = {
        decelDistance: parseInt(document.getElementById('compareDecelDistance').value) || 1000,
        decelMarkers: parseMarkers(document.getElementById('compareDecelMarkers').value)
    };

    const stations = Array.from(selectedCompareStations);

    // Generate charts
    MultiCompare.generateAllComparisonCharts(stations, 'compareChartsContainer', config);

    // Show train legend
    displayCompareTrainLegend();

    // Show results
    const resultsContainer = document.getElementById('compareResultsContainer');
    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Display the train legend in comparison results
 */
function displayCompareTrainLegend() {
    const container = document.getElementById('compareTrainLegend');
    container.innerHTML = '';

    MultiCompare.files.forEach((file, idx) => {
        const color = MultiCompare.trainColors[idx % MultiCompare.trainColors.length];
        const item = document.createElement('div');
        item.className = 'compare-legend-item';
        item.innerHTML = `
            <span class="compare-legend-color" style="background: ${color};"></span>
            <span class="compare-legend-label">${file.label}</span>
            <span class="compare-legend-detail">${file.baseInfo.section || ''} &middot; ${file.baseInfo.date || ''}</span>
        `;
        container.appendChild(item);
    });
}

/**
 * Show compare progress
 * @param {string} message
 */
function showCompareProgress(message) {
    const bar = document.getElementById('compareProgressBar');
    const text = bar.querySelector('.progress-text');
    text.textContent = message;
    bar.style.display = 'block';
}

/**
 * Hide compare progress
 */
function hideCompareProgress() {
    const bar = document.getElementById('compareProgressBar');
    bar.style.display = 'none';
}

