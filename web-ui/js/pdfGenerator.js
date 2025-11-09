/**
 * Word Document Generator Module
 * Generates downloadable Word (.docx) reports with tables and charts
 */

const PDFGenerator = {
    /**
     * Generate and download Word document report
     * @param {Object} baseInfo - Base info data
     * @param {Array} haltRecords - Halt arrival records
     * @param {Array} overspeedViolations - Overspeed violations
     * @param {Object} config - Configuration object
     */
    async generatePDF(baseInfo, haltRecords, overspeedViolations = [], config = {}) {
        try {
            // Access docx from window object (loaded via CDN)
            // The library can be exposed as window.docx or directly on window
            let docxLib = window.docx;
            
            if (!docxLib) {
                console.error('Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('doc')));
                throw new Error('docx library not loaded. Please refresh the page and ensure you have internet connection.');
            }
            
            const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle } = docxLib;

            // Capture chart images first
            const chartImages = await this.captureChartImages();

            // Create document
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        // Title
                        new Paragraph({
                            text: "GPS Run Report",
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 400 }
                        }),

                        // Run Summary heading
                        new Paragraph({
                            text: "Run Summary",
                            heading: HeadingLevel.HEADING_2,
                            spacing: { before: 200, after: 200 }
                        }),

                        // Run Summary Table (3 rows x 4 columns)
                        this.createSummaryTable(baseInfo),

                        // Configuration Parameters (if provided)
                        ...(config && Object.keys(config).length > 0 ? [
                            new Paragraph({
                                text: "Analysis Configuration",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 400, after: 200 }
                            }),
                            this.createConfigurationTable(config)
                        ] : []),

                        // Overspeed Violations Table
                        ...(overspeedViolations && overspeedViolations.length > 0 ? [
                            new Paragraph({
                                text: "Overspeed Violations",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 400, after: 200 }
                            }),
                            this.createOverspeedTable(overspeedViolations)
                        ] : []),

                        // Halt Arrival Table
                        ...(haltRecords && haltRecords.length > 0 ? [
                            new Paragraph({
                                text: "Halt Arrival Table",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 400, after: 200 }
                            }),
                            this.createHaltTable(haltRecords)
                        ] : []),

                        // Charts heading
                        new Paragraph({
                            text: "Charts",
                            heading: HeadingLevel.HEADING_2,
                            spacing: { before: 400, after: 200 }
                        }),

                        // Speed vs Time Chart
                        ...(chartImages.mainChart ? [
                            new Paragraph({
                                text: "Speed vs Time Chart",
                                heading: HeadingLevel.HEADING_3,
                                spacing: { before: 200, after: 100 }
                            }),
                            new Paragraph({
                                children: [
                                    chartImages.mainChart
                                ],
                                spacing: { after: 300 }
                            })
                        ] : []),

                        // Deceleration charts
                        ...chartImages.decelCharts.flatMap((chart, idx) => [
                            new Paragraph({
                                text: `Deceleration Chart ${idx + 1}`,
                                heading: HeadingLevel.HEADING_3,
                                spacing: { before: 200, after: 100 }
                            }),
                            new Paragraph({
                                children: [chart],
                                spacing: { after: 300 }
                            })
                        ])
                    ]
                }]
            });

            // Generate filename
            const pilot = baseInfo.pilot ? baseInfo.pilot.replace(/\s+/g, '_') : 'Unknown';
            const date = baseInfo.date || new Date().toISOString().split('T')[0];
            const filename = `SPM_Chart_Analysis_${pilot}_${date}.docx`;

            // Generate blob and save
            const blob = await Packer.toBlob(doc);
            saveAs(blob, filename);

            console.log('Word document generated:', filename);

        } catch (error) {
            console.error('Error generating Word document:', error);
            alert('Error generating Word document: ' + error.message);
        }
    },

    /**
     * Create summary table (3 rows x 4 cols)
     */
    createSummaryTable(baseInfo) {
        const { Table, TableCell, TableRow, Paragraph, WidthType, Shading, BorderStyle } = window.docx;

        const summaryData = [
            ['LOCO_PILOT', baseInfo.pilot || '', 'SECTION', baseInfo.section || ''],
            ['TRAIN_NUMBER', baseInfo.trainNumber || '', 'DATE', baseInfo.date || ''],
            ['LOCO_NUMBER', baseInfo.locoNumber || '', 'TIMING', baseInfo.timing || '']
        ];

        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: summaryData.map(row => 
                new TableRow({
                    children: row.map((cell, idx) => 
                        new TableCell({
                            children: [new Paragraph({ text: cell })],
                            shading: idx % 2 === 0 ? {
                                fill: "F8F9FF",
                                color: "auto"
                            } : undefined,
                            width: { size: 25, type: WidthType.PERCENTAGE }
                        })
                    )
                })
            )
        });
    },

    /**
     * Create halt arrival table
     */
    createHaltTable(haltRecords) {
        const { Table, TableCell, TableRow, Paragraph, WidthType, Shading, TextRun } = window.docx;

        const headers = ['DEVICE_ID', 'LOCO_NUMBER', 'SPEED', 'STATION_CODE', 'EVENT_DETECTION_TIME', 'EVENT_TYPE_FLAG', 'LATITUDE', 'LONGITUDE'];

        // Header row
        const headerRow = new TableRow({
            children: headers.map(header => 
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: header, bold: true, color: "FFFFFF" })]
                    })],
                    shading: { fill: "667EEA", color: "auto" },
                    width: { size: 12.5, type: WidthType.PERCENTAGE }
                })
            ),
            tableHeader: true
        });

        // Data rows
        const dataRows = haltRecords.map((record, idx) => 
            new TableRow({
                children: [
                    record.deviceId || '',
                    record.locoNumber || '',
                    record.speed || '',
                    record.station || '',
                    record.time || '',
                    record.eventType || '',
                    record.latitude || '',
                    record.longitude || ''
                ].map(value => 
                    new TableCell({
                        children: [new Paragraph({ text: String(value) })],
                        shading: idx % 2 === 1 ? {
                            fill: "F8F9FF",
                            color: "auto"
                        } : undefined,
                        width: { size: 12.5, type: WidthType.PERCENTAGE }
                    })
                )
            })
        );

        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows]
        });
    },

    /**
     * Create configuration table
     */
    createConfigurationTable(config) {
        const { Table, TableCell, TableRow, Paragraph, WidthType } = window.docx;

        const configData = [
            ['Station Range', `${config.startStation || 'Start'} - ${config.endStation || 'End'}`],
            ['Deceleration Distance', `${config.decelDistance || 1000}m`],
            ['Deceleration Markers', `${(config.decelMarkers || [120, 60]).join(', ')}m`],
            ['Maximum Speed Limit', `${config.maxSpeed || 110} km/h`]
        ];

        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: configData.map(row => 
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ text: row[0] })],
                            shading: { fill: "F8F9FF", color: "auto" },
                            width: { size: 40, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [new Paragraph({ text: row[1] })],
                            width: { size: 60, type: WidthType.PERCENTAGE }
                        })
                    ]
                })
            )
        });
    },

    /**
     * Create overspeed violations table
     */
    createOverspeedTable(violations) {
        const { Table, TableCell, TableRow, Paragraph, WidthType, Shading, TextRun } = window.docx;

        const headers = ['Start Time', 'End Time', 'Duration', 'Max Speed (km/h)', 'Station Range'];

        // Header row
        const headerRow = new TableRow({
            children: headers.map(header => 
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: header, bold: true, color: "FFFFFF" })]
                    })],
                    shading: { fill: "DC3545", color: "auto" },
                    width: { size: 20, type: WidthType.PERCENTAGE }
                })
            ),
            tableHeader: true
        });

        // Data rows
        const dataRows = violations.map((violation, idx) => 
            new TableRow({
                children: [
                    violation.startTime || '',
                    violation.endTime || '',
                    `${violation.duration}s`,
                    violation.maxSpeed.toFixed(1),
                    violation.stationRange || ''
                ].map(value => 
                    new TableCell({
                        children: [new Paragraph({ text: String(value) })],
                        shading: idx % 2 === 1 ? {
                            fill: "FFF3CD",
                            color: "auto"
                        } : undefined,
                        width: { size: 20, type: WidthType.PERCENTAGE }
                    })
                )
            })
        );

        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows]
        });
    },

    /**
     * Capture chart images using html2canvas
     */
    async captureChartImages() {
        const { ImageRun } = window.docx;
        const images = {
            mainChart: null,
            decelCharts: []
        };

        // Capture main speed chart
        const mainChart = document.getElementById('mainSpeedChart');
        if (mainChart) {
            try {
                const canvas = await html2canvas(mainChart, {
                    scale: 2,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                const imageData = canvas.toDataURL('image/png');
                const base64Data = imageData.split(',')[1];

                images.mainChart = new ImageRun({
                    data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                    transformation: {
                        width: 600,
                        height: Math.round((canvas.height * 600) / canvas.width)
                    }
                });
            } catch (error) {
                console.error('Error capturing main chart:', error);
            }
        }

        // Capture deceleration charts
        const decelContainer = document.getElementById('decelChartsContainer');
        if (decelContainer) {
            const decelChartDivs = decelContainer.querySelectorAll('.decel-chart-item');

            for (const chartDiv of decelChartDivs) {
                try {
                    const canvas = await html2canvas(chartDiv, {
                        scale: 2,
                        logging: false,
                        backgroundColor: '#ffffff'
                    });

                    const imageData = canvas.toDataURL('image/png');
                    const base64Data = imageData.split(',')[1];

                    images.decelCharts.push(new ImageRun({
                        data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                        transformation: {
                            width: 600,
                            height: Math.round((canvas.height * 600) / canvas.width)
                        }
                    }));
                } catch (error) {
                    console.error('Error capturing deceleration chart:', error);
                }
            }
        }

        return images;
    }
};
