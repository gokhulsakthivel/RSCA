# Quick Usage Guide

## How to Use the GPS Speed Chart Analysis Web Application

### Step 1: Open the Application
Simply open `index.html` in your web browser by:
- Double-clicking the file, or
- Right-click → Open with → Your preferred browser

**No installation or setup required!** Everything runs in your browser.

### Step 2: Upload Your CSV File
You have two options:
1. **Drag & Drop**: Drag your CSV file onto the upload zone
2. **Click to Browse**: Click the upload zone to select a file from your computer

### Step 3: Optional - Fill Additional Details
You can optionally provide:
- **Pilot Name** (auto-detected from filename if not provided)
- **Train Number** (auto-detected from CSV data if not provided)
- **Loco Number** (if you want it in the report)
- **Date** (auto-detected from filename if not provided)

### Step 4: View Results
The application will automatically:
1. Parse your CSV file
2. Extract run summary information
3. Process speed and station data
4. Generate interactive charts
5. Create halt arrival table

You'll see:
- **Run Summary Table**: Key information about the run
- **Speed vs Time Chart**: Interactive chart showing speed over time with station stops
- **Deceleration Charts**: Detailed analysis of last 1km before each stop
- **Halt Arrival Table**: List of all station halts with GPS coordinates

### Step 5: Download Word Report
Click the **"Download Word Report"** button to get a comprehensive Word document with:
- All tables
- All charts
- Professional formatting

The Word document will be automatically downloaded to your default downloads folder.

## Testing with Your Data

### Example CSV File
Try with one of your existing CSV files:
- `SURESH PRIMARY OCT 2025.csv`
- `PRIMARY J SARANAKUMAR 20-10-2025.csv`
- `j saravanakumar13128_PrimaryGPSData_2025-07-26.csv`

### Expected CSV Format
Your CSV should have columns like:
```
Device Id,Logging Time,Gps Time,Latitude,Longitude,Speed,distFromPrevLatLng,distFromSpeed,last/cur stationCode,...
```

The application automatically detects column names (case-insensitive).

## Interactive Features

### Charts
- **Zoom**: Click and drag on chart to zoom in
- **Pan**: Hold shift and drag to pan
- **Reset**: Double-click to reset zoom
- **Hover**: Hover over points to see details
- **Download**: Use chart controls to save individual charts

### Tables
- All tables are scrollable on small screens
- Data is preserved exactly as in your CSV

## Tips for Best Results

1. **File Size**: Works with files up to several thousand records (tested with 18,000+ rows)
2. **Browser**: Use Chrome or Edge for best performance
3. **Screen**: Desktop/laptop recommended for viewing charts, but works on mobile too
4. **Internet**: Only needed for first load (to download libraries), then works offline

## Troubleshooting

### "No valid data found"
- Check that your CSV has the required columns (Time, Speed, Station)
- Verify data is not empty
- Check date/time formats

### Charts not displaying
- Wait a few seconds for data processing
- Check browser console (F12) for errors
- Try refreshing the page and uploading again

### Word document generation fails
- Make sure all charts are visible on screen
- Wait for all charts to fully load before clicking download
- Try closing other tabs to free up memory

## Comparing with Python Tools

This web UI provides the same functionality as:
- **baseInfo.py** → Run Summary section
- **chart.py** → Speed and deceleration charts
- **passingHome.py** → Halt arrival table
- **generate_report.py** → Word document report generation

**Advantages of Web UI:**
- No Python installation needed
- No command-line knowledge required
- Interactive charts with zoom/pan
- Works on any device with a browser
- Instant visual feedback

## Need Help?

If you encounter any issues:
1. Check the browser console (Press F12) for error messages
2. Verify your CSV file format matches the expected structure
3. Try with a smaller test file first
4. Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge)

---

Enjoy your GPS Speed Chart Analysis! 🚂📊

