# GPS Speed Chart Analysis - Web UI

A pure client-side web application for analyzing GPS speed data from CSV files. This application replicates the functionality of the Python-based analysis tools in a modern, interactive web interface.

## Features

- 📁 **Drag-and-Drop CSV Upload** - Easy file upload with drag-and-drop support
- 📊 **Interactive Charts** - Speed vs time charts with Plotly.js
- 🚂 **Station Analysis** - Automatic detection of station stops and halts
- 📉 **Deceleration Analysis** - Detailed charts showing last 1km before each stop
- 📄 **Word Reports** - Downloadable Word (.docx) reports with all charts and tables
- 🎨 **Modern UI** - Beautiful, responsive design that works on all devices
- ⚡ **Client-Side Processing** - All processing happens in your browser (no server needed)

## Quick Start

1. Open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)
2. Drag and drop your CSV file, or click to browse
3. Optionally fill in additional details (Pilot Name, Train Number, etc.)
4. View the generated charts and tables
5. Download the Word report

## Supported CSV Format

The application supports GPS data CSV files with the following columns (case-insensitive):

### Required Columns:
- **Device ID**: `device id`, `device_id`, `dev`, `device` (default: column 0)
- **Time**: `logging time`, `time`, `event_detection_time`, `event_time` (default: column 1)
- **Speed**: `speed`, `loco_speed`, `speed(kmph)` (default: column 5)
- **Station**: `last/cur stationcode`, `station_code`, `station`, `stationname` (default: column 8)

### Optional Columns:
- **Latitude**: `latitude`, `lat` (default: column 3)
- **Longitude**: `longitude`, `lon` (default: column 4)
- **Distance**: `distance`, `dist`, `distancefromprev` (default: column 6)

### Supported Time Formats:
- `DD/MM/YYYY HH:MM`
- `DD/MM/YYYY HH:MM:SS`
- `YYYY-MM-DD HH:MM:SS`
- `HH:MM:SS`
- `HH:MM`
- And other common formats

## File Structure

```
web-ui/
├── index.html              # Main HTML page
├── css/
│   └── styles.css         # Styling and layout
├── js/
│   ├── main.js            # Application orchestration
│   ├── csvParser.js       # CSV parsing with Papa Parse
│   ├── baseInfo.js        # Extract pilot, train, section info
│   ├── dataProcessor.js   # Time parsing and data validation
│   ├── haltDetector.js    # Station stop detection
│   ├── chartGenerator.js  # Plotly.js chart generation
│   └── pdfGenerator.js    # Word document report generation
└── README.md              # This file
```

## Features in Detail

### Base Info Summary
Automatically extracts:
- Pilot name from filename
- Train number from device ID
- Date from filename (YYYY-MM-DD format)
- Section (first station - last station)
- Timing (first time - last time)

### Speed vs Time Chart
- Interactive line chart showing speed over time
- Station stops marked with vertical lines
- Station codes labeled at stop points
- Zoom, pan, and hover for details

### Deceleration Charts
For each station stop:
- Shows speed profile for last 1km before stop
- Marks: Halt point (red), 120m before (blue), 60m before (green)
- Displays start speed and halt time
- Individual chart for each stop

### Halt Arrival Table
Lists all station stops with:
- Device ID
- Loco Number
- Speed
- Station Code
- Event Detection Time
- Event Type (ARRIVAL/HALT)
- GPS Coordinates (Latitude, Longitude)

### Word Report
Comprehensive report including:
- Run summary table
- Halt arrival table
- Speed vs time chart
- All deceleration charts
- Professional Word document formatting

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Modern mobile browsers

**Note**: Requires a modern browser with ES6+ support and HTML5 File API.

## External Dependencies

All dependencies are loaded from CDN (no installation required):

- **Papa Parse** (5.4.1) - CSV parsing
- **Plotly.js** (2.27.0) - Interactive charts
- **docx** (8.5.0) - Word document generation
- **FileSaver.js** (2.0.5) - File download utility
- **html2canvas** (1.4.1) - Chart image capture

## Configuration

You can modify constants in the JavaScript files:

```javascript
// In haltDetector.js and chartGenerator.js
MIN_STOP_DURATION_SECONDS: 1  // Minimum halt duration

// In chartGenerator.js
DECEL_THRESHOLD_KMPH: 15.0     // Speed threshold for deceleration
```

## Data Processing Logic

### Time Parsing
- Supports multiple datetime formats
- Handles time-only formats by combining with base date
- Distributes seconds evenly for entries lacking seconds
- Ensures monotonic time (skips backwards jumps)

### Speed Processing
- Treats speeds < 0.7 km/h as zero
- Filters invalid/empty entries
- Maintains data integrity throughout processing

### Stop Detection
- Identifies consecutive zero-speed records at same station
- Calculates duration of each stop
- Filters by minimum duration threshold
- Tracks first occurrence of each halt station

## Troubleshooting

### Charts not displaying
- Check browser console for errors
- Ensure CSV file has valid data
- Verify column names match expected format

### Word document generation fails
- Ensure charts are fully loaded before clicking download
- Check browser console for specific errors
- Try with a smaller dataset if memory issues occur

### CSV parsing errors
- Verify CSV is properly formatted
- Check for special characters in data
- Ensure file encoding is UTF-8

## Privacy & Security

- ✅ All processing happens locally in your browser
- ✅ No data is sent to any server
- ✅ Your GPS data remains private and secure
- ✅ Works offline (after initial page load)

## Credits

Web UI implementation based on Python analysis tools:
- `baseInfo.py` - Base information extraction
- `chart.py` - Chart generation logic
- `passingHome.py` - Halt detection
- `generate_report.py` - Report generation

Converted to pure JavaScript for client-side processing.

## License

This project follows the same license as the original Python tools.

---

**Version**: 1.0.0  
**Last Updated**: November 2025

