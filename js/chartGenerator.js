/**
 * Chart Generator Module
 * Generates speed charts and deceleration charts using Plotly.js
 */

const ChartGenerator = {
    MIN_STOP_DURATION_SECONDS: 1,

    /**
     * Generate main speed vs time chart
     * @param {Object} processedData - Processed data
     * @param {string} containerId - DOM element ID for chart
     * @returns {Array} Stop segments
     */
    generateMainSpeedChart(processedData, containerId) {
        const { times, speeds, stations } = processedData;
        
        if (times.length === 0) {
            console.error('No data to plot');
            return [];
        }

        // Downsample if too many points (for performance)
        let plotTimes = times;
        let plotSpeeds = speeds;
        let plotStations = stations;
        
        if (times.length > 20000) {
            const step = Math.ceil(times.length / 20000);
            plotTimes = times.filter((_, i) => i % step === 0);
            plotSpeeds = speeds.filter((_, i) => i % step === 0);
            plotStations = stations.filter((_, i) => i % step === 0);
            console.log(`Downsampled from ${times.length} to ${plotTimes.length} points`);
        }

        // Detect station stops
        const segments = HaltDetector.detectStationStopSegments(
            times, speeds, stations, this.MIN_STOP_DURATION_SECONDS
        );

        // Main speed trace
        const trace = {
            x: plotTimes,
            y: plotSpeeds,
            type: 'scatter',
            mode: 'lines',
            name: 'Speed',
            line: { color: '#1f77b4', width: 1.5 },
            hovertemplate: '<b>Time:</b> %{x|%H:%M:%S}<br><b>Speed:</b> %{y:.1f} km/h<extra></extra>'
        };

        // Shapes for station stop markers
        const shapes = [];
        const annotations = [];
        const usedStationCodes = new Set();

        segments.forEach(segment => {
            // Vertical line at stop
            shapes.push({
                type: 'line',
                x0: segment.startTime,
                x1: segment.startTime,
                y0: 0,
                y1: Math.max(...plotSpeeds),
                line: { color: 'grey', width: 1, dash: 'dash' },
                opacity: 0.6
            });

            // Station label (avoid duplicates)
            if (segment.station && !usedStationCodes.has(segment.station)) {
                annotations.push({
                    x: segment.startTime,
                    y: 0,
                    text: segment.station,
                    showarrow: false,
                    textangle: -90,
                    yanchor: 'top',
                    font: { size: 11, color: '#333' },
                    yshift: -10
                });
                usedStationCodes.add(segment.station);
            }
        });

        const layout = {
            title: 'Speed vs Time (Stop intervals marked)',
            xaxis: {
                title: 'Time',
                type: 'date',
                tickformat: '%H:%M:%S'
            },
            yaxis: {
                title: 'Speed (km/h)'
            },
            hovermode: 'closest',
            shapes: shapes,
            annotations: annotations,
            height: 500,
            margin: { b: 100 }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false
        };

        Plotly.newPlot(containerId, [trace], layout, config);
        console.log(`Main speed chart rendered with ${plotTimes.length} points`);

        return segments;
    },

    /**
     * Generate deceleration charts for each station stop
     * @param {Object} processedData - Processed data
     * @param {Array} segments - Stop segments
     * @param {string} containerId - DOM element ID for charts container
     * @param {Object} config - Configuration object with decelDistance and decelMarkers
     */
    generateDecelerationCharts(processedData, segments, containerId, config = {}) {
        const decelDistance = config.decelDistance || 1000; // Default 1km
        const decelMarkers = config.decelMarkers || [120, 60]; // Default 120m and 60m
        const { times, speeds, distances } = processedData;
        const container = document.getElementById(containerId);
        
        if (!container || segments.length === 0) {
            console.log('No segments or container for deceleration charts');
            return;
        }

        container.innerHTML = '';
        const stationCounts = {};

        segments.forEach(segment => {
            const station = segment.station;
            stationCounts[station] = (stationCounts[station] || 0) + 1;
            const seq = stationCounts[station];

            // Find the specified distance before stop using distance data
            const startIdx = segment.startIdx;
            let distSum = 0.0;
            let decelStart = startIdx;
            
            for (let i = startIdx - 1; i >= 0; i--) {
                const dist = distances[i] || 0.0;
                distSum += dist;
                decelStart = i;
                
                // Skip zero speed points
                if (speeds[i] === 0) {
                    distSum = 0.0;
                }
                
                if (distSum >= decelDistance) {
                    break;
                }
            }

            // Skip if no valid prior samples
            if (decelStart >= startIdx) {
                return;
            }

            // Extract data for this segment
            const segmentTimes = times.slice(decelStart, startIdx + 1);
            const segmentSpeeds = speeds.slice(decelStart, startIdx + 1);
            const segmentDistances = distances.slice(decelStart, startIdx + 1);

            if (segmentTimes.length === 0) {
                return;
            }

            // Calculate marker indices based on configured distances
            let distCum = 0.0;
            const markerIndices = new Map(); // marker distance -> index
            
            for (let i = segmentDistances.length - 1; i >= 0; i--) {
                distCum += segmentDistances[i];
                
                // Check each marker
                for (const markerDist of decelMarkers) {
                    if (!markerIndices.has(markerDist) && distCum >= markerDist) {
                        markerIndices.set(markerDist, i);
                    }
                }
                
                // Stop if all markers found
                if (markerIndices.size === decelMarkers.length) {
                    break;
                }
            }

            // Create chart
            this.createDecelerationChart(
                station,
                seq,
                segmentTimes,
                segmentSpeeds,
                times[startIdx],
                markerIndices,
                decelMarkers,
                decelDistance,
                container
            );
        });

        console.log(`Generated ${segments.length} deceleration charts`);
    },

    /**
     * Create a single deceleration chart
     * @param {string} station - Station code
     * @param {number} seq - Sequence number
     * @param {Array<Date>} times - Times for segment
     * @param {Array<number>} speeds - Speeds for segment
     * @param {Date} haltTime - Halt timestamp
     * @param {Map} markerIndices - Map of marker distances to indices
     * @param {Array<number>} markerDistances - Array of marker distances
     * @param {number} decelDistance - Total deceleration distance
     * @param {HTMLElement} container - Container element
     */
    createDecelerationChart(station, seq, times, speeds, haltTime, markerIndices, markerDistances, decelDistance, container) {
        const chartDiv = document.createElement('div');
        chartDiv.className = 'decel-chart-item';
        const chartId = `decel-chart-${station}-${seq}`;
        chartDiv.id = chartId;
        container.appendChild(chartDiv);

        const maxSpeed = Math.max(...speeds);
        const firstSpeed = speeds[0];

        // Main trace
        const trace = {
            x: times,
            y: speeds,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Speed',
            line: { color: '#ff7f0e', width: 2 },
            marker: { size: 4 },
            hovertemplate: '<b>Time:</b> %{x|%H:%M:%S}<br><b>Speed:</b> %{y:.1f} km/h<extra></extra>'
        };

        // Shapes for markers
        const shapes = [
            {
                type: 'line',
                x0: haltTime,
                x1: haltTime,
                y0: 0,
                y1: maxSpeed,
                line: { color: 'red', width: 2, dash: 'dash' }
            }
        ];

        // Colors for different markers
        const markerColors = ['blue', 'green', 'orange', 'purple', 'brown'];
        
        // Add vertical lines for each marker
        markerDistances.forEach((markerDist, idx) => {
            const markerIdx = markerIndices.get(markerDist);
            if (markerIdx !== undefined && markerIdx >= 0 && markerIdx < times.length) {
                shapes.push({
                    type: 'line',
                    x0: times[markerIdx],
                    x1: times[markerIdx],
                    y0: 0,
                    y1: maxSpeed,
                    line: { 
                        color: markerColors[idx % markerColors.length], 
                        width: 1.5, 
                        dash: 'dot' 
                    }
                });
            }
        });

        // Annotations
        const annotations = [
            {
                x: times[0],
                y: maxSpeed * 0.9,
                text: `Start ${firstSpeed.toFixed(1)}`,
                showarrow: false,
                font: { size: 10, color: '#ff7f0e' },
                xanchor: 'left'
            },
            {
                x: haltTime,
                y: maxSpeed * 0.2,
                text: '0',
                showarrow: false,
                font: { size: 10, color: 'red' },
                xanchor: 'right'
            }
        ];

        const layout = {
            title: `${station} Stop: Last ${decelDistance}m to 0 kmph`,
            xaxis: {
                title: 'Time',
                type: 'date',
                tickformat: '%H:%M:%S',
                range: [times[0], haltTime]
            },
            yaxis: {
                title: 'Speed (km/h)'
            },
            shapes: shapes,
            annotations: annotations,
            height: 450,
            showlegend: true,
            legend: {
                x: 0.5,
                xanchor: 'center',
                y: -0.25,
                yanchor: 'top',
                orientation: 'h'
            },
            margin: {
                b: 120,
                t: 60,
                l: 60,
                r: 40
            }
        };

        // Add legend traces
        const legendTraces = [trace];
        
        // Add halt legend
        legendTraces.push({
            x: [null],
            y: [null],
            type: 'scatter',
            mode: 'lines',
            name: 'Halt (0)',
            line: { color: 'red', width: 2, dash: 'dash' },
            showlegend: true
        });
        
        // Add marker legends dynamically
        markerDistances.forEach((markerDist, idx) => {
            if (markerIndices.has(markerDist)) {
                legendTraces.push({
                    x: [null],
                    y: [null],
                    type: 'scatter',
                    mode: 'lines',
                    name: `${markerDist}m to stop`,
                    line: { 
                        color: markerColors[idx % markerColors.length], 
                        width: 1.5, 
                        dash: 'dot' 
                    },
                    showlegend: true
                });
            }
        });

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false
        };

        Plotly.newPlot(chartId, legendTraces, layout, config);
    }
};

