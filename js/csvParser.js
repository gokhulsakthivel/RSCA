/**
 * CSV Parser Module
 * Handles CSV parsing with flexible column mapping
 */

const CSVParser = {
    /**
     * Column mapping definitions (case-insensitive)
     */
    columnMappings: {
        deviceId: {
            keys: ['device id', 'device_id', 'dev', 'device'],
            default: 0
        },
        time: {
            keys: ['logging time', 'time', 'event_detection_time', 'event_time'],
            default: 1
        },
        speed: {
            keys: ['speed', 'loco_speed', 'speed(kmph)'],
            default: 5
        },
        latitude: {
            keys: ['latitude', 'lat'],
            default: 3
        },
        longitude: {
            keys: ['longitude', 'lon'],
            default: 4
        },
        station: {
            keys: ['last/cur stationcode', 'station_code', 'station', 'stationname', 'station_name'],
            default: 8
        },
        distance: {
            keys: ['distance', 'dist', 'distancefromprev', 'distfromprev'],
            default: 6
        }
    },

    /**
     * Find column index by matching against possible keys
     * @param {Object} headerMap - Map of lowercase header names to indices
     * @param {Array} keys - Possible key names to match
     * @param {number} defaultIndex - Default index if no match found
     * @returns {number} Column index
     */
    findColumnIndex(headerMap, keys, defaultIndex) {
        for (const key of keys) {
            if (headerMap.hasOwnProperty(key)) {
                return headerMap[key];
            }
        }
        return defaultIndex;
    },

    /**
     * Parse CSV file content
     * @param {string} csvContent - Raw CSV file content
     * @returns {Promise<Object>} Parsed data with headers, rows, and column map
     */
    parseCSV(csvContent) {
        return new Promise((resolve, reject) => {
            Papa.parse(csvContent, {
                header: false,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: (results) => {
                    try {
                        if (!results.data || results.data.length === 0) {
                            reject(new Error('CSV file is empty'));
                            return;
                        }

                        // First row is header
                        const headers = results.data[0];
                        const rows = results.data.slice(1);

                        // Build header map (lowercase)
                        const headerMap = {};
                        headers.forEach((header, index) => {
                            const normalizedHeader = header.trim().toLowerCase();
                            headerMap[normalizedHeader] = index;
                        });

                        // Build column map using flexible matching
                        const columnMap = {};
                        for (const [fieldName, config] of Object.entries(this.columnMappings)) {
                            columnMap[fieldName] = this.findColumnIndex(
                                headerMap,
                                config.keys,
                                config.default
                            );
                        }

                        console.log('CSV parsed successfully:', {
                            headers: headers.length,
                            rows: rows.length,
                            columnMap
                        });

                        resolve({
                            headers,
                            rows,
                            columnMap
                        });
                    } catch (error) {
                        reject(new Error('Error processing CSV data: ' + error.message));
                    }
                },
                error: (error) => {
                    reject(new Error('Error parsing CSV: ' + error.message));
                }
            });
        });
    }
};

