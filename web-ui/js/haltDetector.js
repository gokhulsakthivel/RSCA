/**
 * Halt Detection Module
 * Detects station stops and generates halt arrival table
 */

const HaltDetector = {
    MIN_STOP_DURATION_SECONDS: 1,

    /**
     * Detect station stop segments
     * @param {Array<Date>} times - Array of timestamps
     * @param {Array<number>} speeds - Array of speeds
     * @param {Array<string>} stations - Array of station codes
     * @param {number} minDuration - Minimum stop duration in seconds
     * @returns {Array} Array of stop segments
     */
    detectStationStopSegments(times, speeds, stations, minDuration = this.MIN_STOP_DURATION_SECONDS) {
        const segments = [];
        const n = speeds.length;
        let i = 0;
        
        while (i < n) {
            if (speeds[i] === 0) {
                const startIdx = i;
                const startTime = times[i];
                const station = stations[i];
                
                // Find consecutive zero-speed records at same station
                let j = i + 1;
                while (j < n && speeds[j] === 0 && stations[j] === station) {
                    j++;
                }
                
                const endIdx = j - 1;
                const endTime = times[endIdx];
                const durationSeconds = (endTime - startTime) / 1000;
                
                if (station && durationSeconds >= minDuration) {
                    segments.push({
                        station,
                        startTime,
                        endTime,
                        startIdx,
                        endIdx,
                        duration: durationSeconds
                    });
                }
                
                i = j;
            } else {
                i++;
            }
        }
        
        console.log(`Detected ${segments.length} halt segments`);
        return segments;
    },

    /**
     * Detect halt arrivals (first occurrence of each station stop)
     * @param {Object} processedData - Processed data from DataProcessor
     * @param {Object} csvData - Original CSV data for full row access
     * @param {Object} baseInfo - Base info for loco number
     * @param {number} minStop - Minimum stop duration
     * @returns {Array} Array of halt records
     */
    detectHalts(processedData, csvData, baseInfo, minStop = this.MIN_STOP_DURATION_SECONDS) {
        const { times, speeds, stations } = processedData;
        const { rows, columnMap } = csvData;
        
        // First, find all halt stations
        const segments = this.detectStationStopSegments(times, speeds, stations, minStop);
        const haltStations = new Set(segments.map(seg => seg.station));
        
        console.log(`Found ${haltStations.size} unique halt stations`);
        
        // Build index map from processed data back to original rows
        const processedToOriginal = this.buildIndexMap(times, speeds, stations, rows, columnMap);
        
        // Find first occurrence of each halt station
        const seenStations = new Set();
        const haltRecords = [];
        
        for (let i = 0; i < stations.length; i++) {
            const station = stations[i];
            
            if (!station || !haltStations.has(station) || seenStations.has(station)) {
                continue;
            }
            
            seenStations.add(station);
            
            // Get corresponding original row
            const originalIdx = processedToOriginal.get(i);
            let deviceId = '';
            let speedRaw = speeds[i].toString();
            let lat = '';
            let lon = '';
            
            if (originalIdx !== undefined && originalIdx < rows.length) {
                const row = rows[originalIdx];
                deviceId = row[columnMap.deviceId] ? String(row[columnMap.deviceId]).trim() : '';
                speedRaw = row[columnMap.speed] ? String(row[columnMap.speed]).trim() : speedRaw;
                lat = row[columnMap.latitude] ? String(row[columnMap.latitude]).trim() : '';
                lon = row[columnMap.longitude] ? String(row[columnMap.longitude]).trim() : '';
            }
            
            haltRecords.push({
                deviceId,
                locoNumber: baseInfo.locoNumber || '',
                speed: speedRaw,
                station,
                time: this.formatDateTime(times[i]),
                eventType: 'ARRIVAL(HALT)',
                latitude: lat,
                longitude: lon
            });
        }
        
        console.log(`Generated ${haltRecords.length} halt arrival records`);
        return haltRecords;
    },

    /**
     * Build index map from processed data to original rows
     * @param {Array<Date>} times - Processed times
     * @param {Array<number>} speeds - Processed speeds
     * @param {Array<string>} stations - Processed stations
     * @param {Array} rows - Original CSV rows
     * @param {Object} columnMap - Column mapping
     * @returns {Map} Map from processed index to original row index
     */
    buildIndexMap(times, speeds, stations, rows, columnMap) {
        const map = new Map();
        let processedIdx = 0;
        
        for (let originalIdx = 0; originalIdx < rows.length; originalIdx++) {
            const row = rows[originalIdx];
            if (!row || row.length === 0) continue;
            if (row.every(cell => !String(cell).trim())) continue;
            
            const station = row[columnMap.station] ? String(row[columnMap.station]).trim() : '';
            const speedStr = row[columnMap.speed] ? String(row[columnMap.speed]).trim() : '';
            
            if (!speedStr) continue;
            
            // Match by station (simple heuristic)
            if (processedIdx < stations.length && stations[processedIdx] === station) {
                map.set(processedIdx, originalIdx);
                processedIdx++;
            }
        }
        
        return map;
    },

    /**
     * Format datetime for display
     * @param {Date} datetime - Date object
     * @returns {string} Formatted as YYYY-MM-DD HH:MM:SS
     */
    formatDateTime(datetime) {
        const year = datetime.getFullYear();
        const month = String(datetime.getMonth() + 1).padStart(2, '0');
        const day = String(datetime.getDate()).padStart(2, '0');
        const hours = String(datetime.getHours()).padStart(2, '0');
        const minutes = String(datetime.getMinutes()).padStart(2, '0');
        const seconds = String(datetime.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
};

