# Changelog

## Version 1.1.0 - Word Document Output (November 2025)

### Changed
- **Output Format**: Changed from PDF to Word document (.docx)
- Updated button text to "Download Word Report"
- Replaced jsPDF with docx.js library for document generation
- Added FileSaver.js for file download functionality

### Technical Changes
- **New Libraries**:
  - `docx` (8.5.0) - Word document generation
  - `FileSaver.js` (2.0.5) - File download utility
- **Removed Libraries**:
  - `jsPDF` (2.5.1) - No longer needed

### Benefits of Word Format
- **Editable**: Users can modify the report after generation
- **Compatible**: Works with Microsoft Word, Google Docs, LibreOffice
- **Professional**: Native Word formatting with tables and images
- **Flexible**: Easier to customize and share
- **Standard**: .docx is the industry standard for reports

### Files Modified
- `index.html` - Updated CDN libraries and button text
- `js/pdfGenerator.js` - Rewritten to use docx.js library
- `js/main.js` - Updated progress messages
- `README.md` - Updated documentation
- `USAGE_GUIDE.md` - Updated instructions
- `IMPLEMENTATION_SUMMARY.md` - Updated technical details

### Migration Notes
All functionality remains the same:
- ✅ Base info summary table
- ✅ Halt arrival table
- ✅ Speed vs time chart
- ✅ Deceleration charts
- ✅ Professional formatting

Only the output format has changed from PDF to Word.

---

## Version 1.0.0 - Initial Release (November 2025)

### Features
- Drag-and-drop CSV file upload
- Interactive speed charts with Plotly.js
- Station stop detection
- Deceleration analysis
- Halt arrival table
- PDF report generation (superseded in v1.1.0)
- Modern, responsive UI
- Client-side processing

