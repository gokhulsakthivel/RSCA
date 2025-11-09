/**
 * Base Info Extraction Module
 * Extracts pilot name, train number, section, date, and timing from CSV data
 */

const BaseInfo = {
    /**
     * Extract date from filename using regex pattern
     * @param {string} filename - CSV filename
     * @returns {string|null} Date in YYYY-MM-DD format or null
     */
    extractDateFromFilename(filename) {
        const match = filename.match(/(20\d{2}-\d{2}-\d{2})/);
        if (match) {
            return match[1];
        }
        return null;
    },

    /**
     * Extract pilot name from filename
     * Text before 'PrimaryGPSData' or 'PRIMARY', cleaned and capitalized
     * @param {string} filename - CSV filename
     * @returns {string} Extracted pilot name
     */
    extractPilotName(filename) {
        // Remove file extension
        let baseName = filename.replace(/\.[^/.]+$/, '');
        
        // Find position of 'primarygpsdata' or 'primary' (case-insensitive)
        const lowerName = baseName.toLowerCase();
        let idx = lowerName.indexOf('primarygpsdata');
        if (idx === -1) {
            idx = lowerName.indexOf('primary');
        }
        
        // Extract prefix
        let prefix = idx !== -1 ? baseName.substring(0, idx) : baseName;
        
        // Replace underscores and hyphens with spaces
        prefix = prefix.replace(/[_-]/g, ' ');
        
        // Extract alphabetic sequences
        const words = prefix.match(/[A-Za-z]+/g);
        if (!words || words.length === 0) {
            return 'Unknown Pilot';
        }
        
        // Capitalize words (single letters stay uppercase, others capitalize first letter)
        const cleaned = words.map(word => {
            if (word.length === 1) {
                return word.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        });
        
        // Filter out common generic tokens
        const genericTokens = ['j', 'primary', 'gps', 'data'];
        const filtered = cleaned.filter(word => 
            !genericTokens.includes(word.toLowerCase())
        );
        
        return (filtered.length > 0 ? filtered : cleaned).join(' ');
    },

    /**
     * Parse time from various formats
     * @param {string} timeStr - Time string
     * @returns {string|null} Time in HH:MM:SS format or null
     */
    parseTime(timeStr) {
        if (!timeStr) return null;
        
        const formats = [
            /^\d{1,2}:\d{2}:\d{2}$/,  // HH:MM:SS
            /^\d{1,2}:\d{2}$/,         // HH:MM
            /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(:\d{2})?$/  // Date with time
        ];
        
        for (const format of formats) {
            if (format.test(timeStr.trim())) {
                // Extract time part if it includes date
                if (timeStr.includes('/')) {
                    const parts = timeStr.split(/\s+/);
                    if (parts.length > 1) {
                        const timePart = parts[parts.length - 1];
                        // Ensure HH:MM:SS format
                        if (timePart.split(':').length === 2) {
                            return timePart + ':00';
                        }
                        return timePart;
                    }
                }
                
                // Ensure HH:MM:SS format
                const timeParts = timeStr.trim().split(':');
                if (timeParts.length === 2) {
                    return timeStr.trim() + ':00';
                }
                return timeStr.trim();
            }
        }
        
        return null;
    },

    /**
     * Generate base info from CSV data
     * @param {Object} csvData - Parsed CSV data
     * @param {string} filename - Original filename
     * @param {Object} overrides - Optional overrides for pilot, train, loco, date
     * @returns {Object} Base info object
     */
    generateBaseInfo(csvData, filename, overrides = {}) {
        const { rows, columnMap } = csvData;
        
        // Extract from filename
        let pilot = overrides.pilot || this.extractPilotName(filename);
        let date = overrides.date || this.extractDateFromFilename(filename);
        if (!date) {
            // Use today's date
            const today = new Date();
            date = today.toISOString().split('T')[0];
        }
        
        // Parse first/last times and stations from CSV
        let firstTime = null;
        let lastTime = null;
        let firstStation = null;
        let lastStation = null;
        let deviceId = null;
        
        for (const row of rows) {
            if (!row || row.length === 0) continue;
            
            // Get device ID
            if (!deviceId && row[columnMap.deviceId]) {
                const dev = String(row[columnMap.deviceId]).trim();
                if (dev) {
                    deviceId = dev;
                }
            }
            
            // Get time
            if (row[columnMap.time]) {
                const timeStr = String(row[columnMap.time]).trim();
                const parsed = this.parseTime(timeStr);
                if (parsed) {
                    if (!firstTime) {
                        firstTime = parsed;
                    }
                    lastTime = parsed;
                }
            }
            
            // Get station
            if (row[columnMap.station]) {
                const station = String(row[columnMap.station]).trim();
                if (station) {
                    if (!firstStation) {
                        firstStation = station;
                    }
                    lastStation = station;
                }
            }
        }
        
        // Build section
        let section = '';
        if (firstStation && lastStation) {
            section = `${firstStation} - ${lastStation}`;
        } else if (firstStation) {
            section = `${firstStation} - ${firstStation}`;
        }
        
        // Build timing
        let timing = '';
        if (firstTime && lastTime) {
            timing = `${firstTime} - ${lastTime}`;
        }
        
        // Train number (from device ID or override)
        let trainNumber = overrides.train || deviceId || '';
        
        // Loco number (from override)
        let locoNumber = overrides.loco || '';
        
        return {
            pilot,
            trainNumber,
            locoNumber,
            section,
            date,
            timing
        };
    }
};

