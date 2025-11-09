/**
 * Overspeed Detection Module
 * Detects and reports speed limit violations
 */

const OverspeedDetector = {
    /**
     * Detect overspeed violations
     * @param {Object} processedData - Time/speed/station data
     * @param {number} maxSpeed - Speed threshold in km/h
     * @returns {Array} Array of overspeed violations
     */
    detectOverspeeds(processedData, maxSpeed) {
        const violations = [];
        const { times, speeds, stations } = processedData;
        
        let i = 0;
        while (i < speeds.length) {
            if (speeds[i] > maxSpeed) {
                const startIdx = i;
                const startTime = times[i];
                const startStation = stations[i];
                
                // Find consecutive overspeed records
                let maxSpeedInSegment = speeds[i];
                while (i < speeds.length && speeds[i] > maxSpeed) {
                    if (speeds[i] > maxSpeedInSegment) {
                        maxSpeedInSegment = speeds[i];
                    }
                    i++;
                }
                
                const endIdx = i - 1;
                const endTime = times[endIdx];
                const endStation = stations[endIdx];
                const duration = (endTime - startTime) / 1000; // seconds
                
                // Create station range string
                let stationRange;
                if (!startStation && !endStation) {
                    stationRange = 'Unknown';
                } else if (startStation === endStation || !endStation) {
                    stationRange = startStation || 'Unknown';
                } else {
                    stationRange = `${startStation} - ${endStation}`;
                }
                
                violations.push({
                    startTime: this.formatTime(startTime),
                    endTime: this.formatTime(endTime),
                    duration: Math.round(duration),
                    maxSpeed: Math.round(maxSpeedInSegment * 10) / 10,
                    stationRange: stationRange,
                    startStation: startStation,
                    endStation: endStation
                });
            } else {
                i++;
            }
        }
        
        console.log(`Detected ${violations.length} overspeed violations`);
        return violations;
    },

    /**
     * Format time for display
     * @param {Date} datetime - Date object
     * @returns {string} Formatted time string
     */
    formatTime(datetime) {
        const hours = String(datetime.getHours()).padStart(2, '0');
        const minutes = String(datetime.getMinutes()).padStart(2, '0');
        const seconds = String(datetime.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    },

    /**
     * Format duration in seconds to readable format
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration
     */
    formatDuration(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    },

    /**
     * Generate overspeed table HTML
     * @param {Array} violations - Array of violation objects
     * @param {HTMLElement} container - Container element
     */
    displayOverspeedTable(violations, container) {
        if (!violations || violations.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #28a745; padding: 20px; font-weight: 600;">✓ No overspeed violations detected</p>';
            return;
        }

        const table = document.createElement('table');
        
        // Header
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const headers = ['Start Time', 'End Time', 'Duration', 'Max Speed (km/h)', 'Station Range'];
        
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        
        // Body
        const tbody = table.createTBody();
        violations.forEach(violation => {
            const row = tbody.insertRow();
            
            [
                violation.startTime,
                violation.endTime,
                this.formatDuration(violation.duration),
                violation.maxSpeed.toFixed(1),
                violation.stationRange
            ].forEach(value => {
                const cell = row.insertCell();
                cell.textContent = value;
            });
            
            // Highlight if speed is significantly over limit
            if (violation.maxSpeed > 120) {
                row.style.backgroundColor = '#fff3cd';
            }
        });
        
        // Summary
        const totalDuration = violations.reduce((sum, v) => sum + v.duration, 0);
        const maxViolation = Math.max(...violations.map(v => v.maxSpeed));
        
        const summary = document.createElement('div');
        summary.style.marginTop = '15px';
        summary.style.padding = '15px';
        summary.style.background = '#f8f9ff';
        summary.style.borderRadius = '8px';
        summary.innerHTML = `
            <strong>Summary:</strong> 
            ${violations.length} violation(s) detected | 
            Total duration: ${this.formatDuration(totalDuration)} | 
            Maximum speed reached: ${maxViolation.toFixed(1)} km/h
        `;
        
        container.innerHTML = '';
        container.appendChild(table);
        container.appendChild(summary);
    }
};

