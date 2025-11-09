/**
 * Data Processor Module
 * Processes GPS data with time parsing, second distribution, and validation
 */

const DataProcessor = {
    /**
     * Parse time string with multiple format support
     * @param {string} timeStr - Time string to parse
     * @param {Date} baseDate - Base date for time-only formats
     * @returns {Object|null} { datetime: Date, hadSeconds: boolean } or null
     */
    parseTimeFlexible(timeStr, baseDate) {
        if (!timeStr) return null;
        
        const formats = [
            { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/, type: 'DD/MM/YYYY HH:MM' },
            { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/, type: 'DD/MM/YYYY HH:MM:SS' },
            { regex: /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/, type: 'YYYY-MM-DD HH:MM:SS' },
            { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/, type: 'DD/MM/YY HH:MM:SS' },
            { regex: /^(\d{1,2}):(\d{2}):(\d{2})$/, type: 'HH:MM:SS' },
            { regex: /^(\d{1,2}):(\d{2})$/, type: 'HH:MM' },
            { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/, type: 'MM/DD/YY HH:MM' }
        ];
        
        for (const format of formats) {
            const match = timeStr.trim().match(format.regex);
            if (match) {
                let datetime;
                let hadSeconds = false;
                
                switch (format.type) {
                    case 'DD/MM/YYYY HH:MM':
                        datetime = new Date(
                            parseInt(match[3]), 
                            parseInt(match[2]) - 1, 
                            parseInt(match[1]),
                            parseInt(match[4]), 
                            parseInt(match[5]), 
                            0
                        );
                        hadSeconds = false;
                        break;
                        
                    case 'DD/MM/YYYY HH:MM:SS':
                        datetime = new Date(
                            parseInt(match[3]), 
                            parseInt(match[2]) - 1, 
                            parseInt(match[1]),
                            parseInt(match[4]), 
                            parseInt(match[5]), 
                            parseInt(match[6])
                        );
                        hadSeconds = true;
                        break;
                        
                    case 'YYYY-MM-DD HH:MM:SS':
                        datetime = new Date(
                            parseInt(match[1]), 
                            parseInt(match[2]) - 1, 
                            parseInt(match[3]),
                            parseInt(match[4]), 
                            parseInt(match[5]), 
                            parseInt(match[6])
                        );
                        hadSeconds = true;
                        break;
                        
                    case 'DD/MM/YY HH:MM:SS':
                        const year = parseInt(match[3]) + 2000;
                        datetime = new Date(
                            year, 
                            parseInt(match[2]) - 1, 
                            parseInt(match[1]),
                            parseInt(match[4]), 
                            parseInt(match[5]), 
                            parseInt(match[6])
                        );
                        hadSeconds = true;
                        break;
                        
                    case 'HH:MM:SS':
                        datetime = new Date(
                            baseDate.getFullYear(),
                            baseDate.getMonth(),
                            baseDate.getDate(),
                            parseInt(match[1]),
                            parseInt(match[2]),
                            parseInt(match[3])
                        );
                        hadSeconds = true;
                        break;
                        
                    case 'HH:MM':
                        datetime = new Date(
                            baseDate.getFullYear(),
                            baseDate.getMonth(),
                            baseDate.getDate(),
                            parseInt(match[1]),
                            parseInt(match[2]),
                            0
                        );
                        hadSeconds = false;
                        break;
                        
                    case 'MM/DD/YY HH:MM':
                        const yr = parseInt(match[3]) + 2000;
                        datetime = new Date(
                            yr,
                            parseInt(match[1]) - 1,
                            parseInt(match[2]),
                            parseInt(match[4]),
                            parseInt(match[5]),
                            0
                        );
                        hadSeconds = false;
                        break;
                }
                
                if (datetime && !isNaN(datetime.getTime())) {
                    return { datetime, hadSeconds };
                }
            }
        }
        
        return null;
    },

    /**
     * Process CSV data to extract times, speeds, stations, and distances
     * @param {Object} csvData - Parsed CSV data
     * @param {Date} baseDate - Base date for time parsing
     * @returns {Object} { times, speeds, stations, distances }
     */
    processData(csvData, baseDate) {
        const { rows, columnMap } = csvData;
        
        // First pass: parse all data
        const rawData = [];
        
        for (const row of rows) {
            if (!row || row.length === 0) continue;
            if (row.every(cell => !String(cell).trim())) continue;
            
            const timeStr = row[columnMap.time] ? String(row[columnMap.time]).trim() : '';
            const speedStr = row[columnMap.speed] ? String(row[columnMap.speed]).trim() : '';
            const station = row[columnMap.station] ? String(row[columnMap.station]).trim() : '';
            const distStr = row[columnMap.distance] ? String(row[columnMap.distance]).trim() : '';
            
            if (!timeStr || !speedStr) continue;
            
            const timeObj = this.parseTimeFlexible(timeStr, baseDate);
            if (!timeObj) continue;
            
            let speed = parseFloat(speedStr);
            if (isNaN(speed)) continue;
            if (speed < 0.7) speed = 0.0;
            
            let distance = parseFloat(distStr) || 0.0;
            
            rawData.push({
                datetime: timeObj.datetime,
                hadSeconds: timeObj.hadSeconds,
                speed,
                station,
                distance
            });
        }
        
        console.log(`Parsed ${rawData.length} raw records`);
        
        // Second pass: group by minute and distribute seconds
        const minuteGroups = {};
        
        rawData.forEach((record, idx) => {
            const minuteKey = this.getMinuteKey(record.datetime);
            if (!minuteGroups[minuteKey]) {
                minuteGroups[minuteKey] = [];
            }
            minuteGroups[minuteKey].push({ idx, record });
        });
        
        // Distribute seconds for entries lacking them
        for (const minuteKey in minuteGroups) {
            const group = minuteGroups[minuteKey];
            const noSeconds = group.filter(item => !item.record.hadSeconds);
            
            if (noSeconds.length > 1) {
                // Distribute seconds evenly across 0-59 range
                noSeconds.forEach((item, i) => {
                    const seconds = Math.round(i * 59.0 / (noSeconds.length - 1));
                    const dt = new Date(item.record.datetime);
                    dt.setSeconds(seconds);
                    item.record.datetime = dt;
                });
            }
        }
        
        // Final pass: ensure monotonic time and build output arrays
        const times = [];
        const speeds = [];
        const stations = [];
        const distances = [];
        let prevDatetime = null;
        
        for (const record of rawData) {
            // Skip backwards time jumps
            if (prevDatetime && record.datetime < prevDatetime) {
                continue;
            }
            
            prevDatetime = record.datetime;
            times.push(record.datetime);
            speeds.push(record.speed);
            stations.push(record.station);
            distances.push(record.distance);
        }
        
        console.log(`Processed ${times.length} valid records`);
        
        return {
            times,
            speeds,
            stations,
            distances
        };
    },

    /**
     * Get minute key for grouping (datetime with seconds set to 0)
     * @param {Date} datetime - DateTime object
     * @returns {string} Minute key
     */
    getMinuteKey(datetime) {
        const dt = new Date(datetime);
        dt.setSeconds(0);
        dt.setMilliseconds(0);
        return dt.toISOString();
    },

    /**
     * Filter data by station range
     * @param {Object} data - Processed data object
     * @param {string} startStation - Start station code (empty for beginning)
     * @param {string} endStation - End station code (empty for end)
     * @returns {Object} Filtered data
     */
    filterDataByStations(data, startStation, endStation) {
        // If no stations specified, return all data
        if (!startStation && !endStation) {
            console.log('No station filtering applied - using all data');
            return data;
        }

        const { times, speeds, stations, distances } = data;
        
        // Find indices of start and end stations
        let startIdx = 0;
        let endIdx = stations.length - 1;
        
        if (startStation) {
            startIdx = stations.findIndex(s => s === startStation);
            if (startIdx === -1) {
                console.warn(`Start station "${startStation}" not found, using beginning`);
                startIdx = 0;
            }
        }
        
        if (endStation) {
            // Find last occurrence of end station
            for (let i = stations.length - 1; i >= 0; i--) {
                if (stations[i] === endStation) {
                    endIdx = i;
                    break;
                }
            }
            if (endIdx < startIdx) {
                console.warn(`End station "${endStation}" comes before start station, using end`);
                endIdx = stations.length - 1;
            }
        }
        
        console.log(`Filtering data from index ${startIdx} to ${endIdx} (${endIdx - startIdx + 1} records)`);
        
        return {
            times: times.slice(startIdx, endIdx + 1),
            speeds: speeds.slice(startIdx, endIdx + 1),
            stations: stations.slice(startIdx, endIdx + 1),
            distances: distances.slice(startIdx, endIdx + 1)
        };
    },

    /**
     * Get unique stations from data
     * @param {Array<string>} stations - Array of station codes
     * @returns {Array<string>} Unique station codes in order of appearance
     */
    getUniqueStations(stations) {
        const seen = new Set();
        const unique = [];
        
        for (const station of stations) {
            if (station && !seen.has(station)) {
                seen.add(station);
                unique.push(station);
            }
        }
        
        return unique;
    }
};

