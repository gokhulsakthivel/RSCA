/**
 * Multi-Train Comparison Module
 * Handles multi-file upload, common station detection, and comparison chart generation
 */

const MultiCompare = {
    /** Store parsed data for each uploaded file */
    files: [],

    /** Color palette for differentiating trains */
    trainColors: [
        '#6C5CE7', // Primary purple
        '#E74C3C', // Red
        '#27AE60', // Green
        '#F39C12', // Orange
        '#3498DB', // Blue
        '#8E44AD', // Dark purple
        '#1ABC9C', // Teal
        '#E67E22', // Dark orange
        '#2ECC71', // Light green
        '#9B59B6', // Violet
    ],

    /**
     * Reset state for a new comparison session
     */
    reset() {
        this.files = [];
    },

    /**
     * Add a parsed file to the comparison set
     * @param {string} filename - Original filename
     * @param {Object} csvData - Parsed CSV data from CSVParser
     * @param {Object} processedData - Processed data from DataProcessor
     * @param {Object} baseInfo - Base info from BaseInfo
     */
    addFile(filename, csvData, processedData, baseInfo) {
        this.files.push({
            filename,
            csvData,
            processedData,
            baseInfo,
            label: this.buildLabel(filename, baseInfo)
        });
    },

    /**
     * Build a short label for a train from filename/baseInfo
     * @param {string} filename
     * @param {Object} baseInfo
     * @returns {string}
     */
    buildLabel(filename, baseInfo) {
        const parts = [];
        if (baseInfo.trainNumber) parts.push(baseInfo.trainNumber);
        if (baseInfo.pilot) parts.push(baseInfo.pilot);
        if (parts.length > 0) return parts.join(' - ');
        // Fallback: use filename without extension
        return filename.replace(/\.csv$/i, '');
    },

    /**
     * Get all unique stations for a single file's processed data
     * @param {Object} processedData
     * @returns {Set<string>}
     */
    getStationsSet(processedData) {
        const stations = new Set();
        for (const s of processedData.stations) {
            if (s && s.trim()) stations.add(s.trim());
        }
        return stations;
    },

    /**
     * Get halt stations (where train actually stops) for a file
     * @param {Object} processedData
     * @returns {Set<string>}
     */
    getHaltStations(processedData) {
        const { times, speeds, stations } = processedData;
        const segments = HaltDetector.detectStationStopSegments(times, speeds, stations, 1);
        return new Set(segments.map(s => s.station));
    },

    /**
     * Find common halt stations across all uploaded files
     * @returns {Array<string>} Array of common station codes (in order of first appearance)
     */
    findCommonHaltStations() {
        if (this.files.length === 0) return [];

        // Get halt stations for each file
        const haltSets = this.files.map(f => this.getHaltStations(f.processedData));

        // Intersect all sets
        let common = new Set(haltSets[0]);
        for (let i = 1; i < haltSets.length; i++) {
            common = new Set([...common].filter(s => haltSets[i].has(s)));
        }

        // Return in order they appear in the first file
        const ordered = [];
        const seen = new Set();
        for (const s of this.files[0].processedData.stations) {
            if (s && common.has(s) && !seen.has(s)) {
                ordered.push(s);
                seen.add(s);
            }
        }
        return ordered;
    },

    /**
     * Extract deceleration segment data for a given station from a file's processed data
     * @param {Object} processedData - Processed data
     * @param {string} station - Station code
     * @param {number} decelDistance - Distance in meters before halt to extract
     * @returns {Object|null} { times, speeds, distances, haltTime } or null
     */
    extractDecelSegment(processedData, station, decelDistance) {
        const { times, speeds, stations, distances } = processedData;

        // Find halt segments for this station
        const segments = HaltDetector.detectStationStopSegments(times, speeds, stations, 1);
        const seg = segments.find(s => s.station === station);
        if (!seg) return null;

        const startIdx = seg.startIdx;

        // Walk backward from halt to collect decelDistance meters
        let distSum = 0.0;
        let decelStart = startIdx;

        for (let i = startIdx - 1; i >= 0; i--) {
            // Stop at a previous halt (zero-speed region) — don't include data
            // from before that halt, but keep what we've accumulated so far
            if (speeds[i] === 0) {
                decelStart = i + 1;
                break;
            }

            const dist = distances[i] || 0.0;
            distSum += dist;
            decelStart = i;

            if (distSum >= decelDistance) break;
        }

        if (decelStart >= startIdx) return null;

        return {
            times: times.slice(decelStart, startIdx + 1),
            speeds: speeds.slice(decelStart, startIdx + 1),
            distances: distances.slice(decelStart, startIdx + 1),
            haltTime: times[startIdx]
        };
    },

    /**
     * Convert deceleration segment to distance-based x-axis (distance to stop in meters)
     * Going from decelDistance → 0
     * @param {Object} segment - { times, speeds, distances }
     * @returns {Object} { distToStop: Array<number>, speeds: Array<number> }
     */
    convertToDistanceBased(segment) {
        const { speeds, distances } = segment;

        // Calculate cumulative distance from end (halt point)
        const distToStop = [];
        let cumDist = 0;

        // Build distance-to-stop from end
        for (let i = distances.length - 1; i >= 0; i--) {
            distToStop[i] = cumDist;
            cumDist += (distances[i] || 0);
        }

        return {
            distToStop,
            speeds
        };
    },

    /**
     * Generate comparison deceleration chart for a single station
     * @param {string} station - Station code
     * @param {HTMLElement} container - Container element to append chart to
     * @param {Object} config - { decelDistance, decelMarkers }
     */
    generateComparisonChart(station, container, config = {}) {
        const decelDistance = config.decelDistance || 1000;
        const decelMarkers = config.decelMarkers || [120, 60];

        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'decel-chart-item';
        const chartId = `compare-chart-${station}`;
        const chartDiv = document.createElement('div');
        chartDiv.id = chartId;
        chartDiv.style.width = '100%';
        chartDiv.style.minHeight = '500px';
        wrapperDiv.appendChild(chartDiv);
        container.appendChild(wrapperDiv);

        const traces = [];
        let globalMaxSpeed = 0;

        this.files.forEach((file, idx) => {
            const segment = this.extractDecelSegment(file.processedData, station, decelDistance);
            if (!segment) return;

            const { distToStop, speeds } = this.convertToDistanceBased(segment);
            const maxSpeed = Math.max(...speeds);
            if (maxSpeed > globalMaxSpeed) globalMaxSpeed = maxSpeed;

            const color = this.trainColors[idx % this.trainColors.length];

            traces.push({
                x: distToStop,
                y: speeds,
                type: 'scatter',
                mode: 'lines',
                name: file.label,
                line: {
                    color: color,
                    width: 2.5,
                    shape: 'spline',
                    smoothing: 1.0
                },
                hovertemplate: `<b>${file.label}</b><br>Dist to stop: %{x:.0f}m<br>Speed: %{y:.1f} km/h<extra></extra>`
            });
        });

        if (traces.length === 0) {

            wrapperDiv.innerHTML = `<p style="color: var(--color-text-muted); text-align: center; padding: 40px;">No deceleration data available for station ${station}</p>`;
            return;
        }

        // Marker shapes (vertical lines at specific distances to stop)
        const shapes = [];
        const markerColors = ['#3498DB', '#27AE60', '#F39C12', '#6C5CE7', '#8D6E63'];

        // Add halt line at 0
        shapes.push({
            type: 'line',
            x0: 0, x1: 0,
            y0: 0, y1: globalMaxSpeed,
            line: { color: '#E74C3C', width: 2, dash: 'dash' }
        });

        // Add marker lines
        decelMarkers.forEach((markerDist, mIdx) => {
            shapes.push({
                type: 'line',
                x0: markerDist, x1: markerDist,
                y0: 0, y1: globalMaxSpeed,
                line: {
                    color: markerColors[mIdx % markerColors.length],
                    width: 1.5,
                    dash: 'dot'
                }
            });
        });

        // Legend traces for markers
        traces.push({
            x: [null], y: [null],
            type: 'scatter', mode: 'lines',
            name: 'Halt (0m)',
            line: { color: '#E74C3C', width: 2, dash: 'dash' },
            showlegend: true
        });

        decelMarkers.forEach((markerDist, mIdx) => {
            traces.push({
                x: [null], y: [null],
                type: 'scatter', mode: 'lines',
                name: `${markerDist}m to stop`,
                line: {
                    color: markerColors[mIdx % markerColors.length],
                    width: 1.5,
                    dash: 'dot'
                },
                showlegend: true
            });
        });

        const base = ChartGenerator.baseLayout();
        const layout = {
            ...base,
            title: {
                text: `Deceleration Comparison at ${station} (Last ${decelDistance}m)`,
                font: { size: 14, color: '#1A1A2E', family: "'Inter', sans-serif" },
                x: 0,
                xanchor: 'left',
                pad: { l: 8 }
            },
            xaxis: {
                ...base.xaxis,
                title: { text: 'Distance to Stop (m)', font: { color: '#6B7280', size: 12 } },
                range: [decelDistance, 0],
                fixedrange: false
            },
            yaxis: {
                ...base.yaxis,
                title: { text: 'Speed (km/h)', font: { color: '#6B7280', size: 12 } },
                rangemode: 'tozero'
            },
            shapes,
            height: 500,
            showlegend: true,
            legend: {
                x: 0.5,
                xanchor: 'center',
                y: -0.2,
                yanchor: 'top',
                orientation: 'h',
                font: { size: 11, color: '#6B7280' }
            },
            margin: { b: 120, t: 56, l: 56, r: 24 },
            hovermode: 'x unified'
        };

        const plotConfig = {
            responsive: true,
            displayModeBar: false,
            displaylogo: false
        };

        Plotly.newPlot(chartId, traces, layout, plotConfig);
    },

    /**
     * Generate all comparison charts for selected stations
     * @param {Array<string>} selectedStations - Array of station codes
     * @param {string} containerId - DOM element ID for charts container
     * @param {Object} config - { decelDistance, decelMarkers }
     */
    generateAllComparisonCharts(selectedStations, containerId, config) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        if (selectedStations.length === 0) {
            container.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 40px;">Select at least one station to generate comparison charts.</p>';
            return;
        }

        selectedStations.forEach(station => {
            this.generateComparisonChart(station, container, config);
        });

        console.log(`Generated ${selectedStations.length} comparison charts`);
    }
};
