/**
 * PDF CSS Styles - Optimized for fast rendering
 */

export const getPDFStyles = (): string => `
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  @page {
    size: A4;
    margin: 15mm;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 10pt;
    line-height: 1.4;
    color: #000;
    background: #fff;
  }

  .container {
    max-width: 100%;
    margin: 0 auto;
  }

  /* Header */
  .header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid #000;
  }

  .header img {
    max-height: 40px;
    width: auto;
  }

  /* Section */
  .section {
    margin-bottom: 20px;
    page-break-inside: avoid;
  }

  .section-title {
    font-size: 12pt;
    font-weight: 600;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #ddd;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Info Grid */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 16px;
    margin-bottom: 10px;
  }

  .info-item {
    display: flex;
    gap: 4px;
  }

  .info-label {
    font-weight: 600;
    min-width: 100px;
  }

  .info-value {
    color: #333;
  }

  /* Timeline Grid */
  .timeline-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 10px;
  }

  .timeline-card {
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fafafa;
    page-break-inside: avoid;
  }

  .timeline-role {
    font-size: 8pt;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
    font-weight: 600;
  }

  .timeline-person {
    font-size: 11pt;
    font-weight: 700;
    color: #000;
    margin-bottom: 6px;
  }

  .timeline-action {
    font-size: 9pt;
    color: #555;
    margin-bottom: 4px;
  }

  .timeline-date {
    font-size: 8pt;
    color: #999;
  }

  /* Orders Table */
  .orders-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }

  .orders-table th {
    background: #f5f5f5;
    padding: 8px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
    border: 1px solid #ddd;
  }

  .orders-table td {
    padding: 8px;
    border: 1px solid #ddd;
    font-size: 9pt;
  }

  .orders-table tr:nth-child(even) {
    background: #fafafa;
  }

  /* Invoice List */
  .invoice-list {
    margin-top: 10px;
  }

  .invoice-item {
    padding: 10px;
    margin-bottom: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
    page-break-inside: avoid;
  }

  .invoice-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .invoice-supplier {
    font-weight: 600;
    font-size: 10pt;
  }

  .invoice-date {
    color: #666;
    font-size: 9pt;
  }

  .invoice-amount {
    font-size: 11pt;
    font-weight: 700;
    color: #000;
    margin: 4px 0;
  }

  .invoice-meta {
    font-size: 9pt;
    color: #666;
  }

  .invoice-notes {
    margin-top: 8px;
    padding: 8px 10px;
    background: #f9f9f9;
    border-left: 3px solid #666;
    border-radius: 3px;
    font-size: 9pt;
    color: #333;
    line-height: 1.5;
  }
  
  .invoice-notes strong {
    color: #000;
    font-weight: 600;
  }
  
  /* Toplu Fatura Stili */
  .invoice-group-item {
    background: #f0f8ff;
    border: 2px solid #4a90e2;
  }
  
  .invoice-materials {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed #ccc;
    font-size: 9pt;
  }

  /* Invoice Summary - Kompakt */
  .invoice-summary {
    margin-top: 15px;
    padding: 10px 0;
    border: none;
    border-radius: 0;
    background: transparent;
    page-break-inside: avoid;
  }

  .invoice-summary-title {
    font-size: 12pt;
    font-weight: 700;
    margin-bottom: 8px;
    text-transform: uppercase;
  }
  
  .invoice-summary-subtitle {
    font-size: 10pt;
    font-weight: 600;
    margin-top: 8px;
    margin-bottom: 4px;
    padding-bottom: 3px;
    border-bottom: 1px solid #000;
  }
  
  .individual-invoice-summary {
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid #ddd;
  }
  
  .individual-invoice-summary:last-of-type {
    border-bottom: none;
  }
  
  .summary-row.invoice-total {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 2px solid #000;
    font-weight: 700;
  }
  
  .summary-row.invoice-total .summary-label {
    font-weight: 700;
  }
  
  .summary-row.invoice-total .summary-value {
    font-weight: 700;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid #ddd;
  }

  .summary-row:last-child {
    border-bottom: none;
  }

  .summary-label {
    font-weight: 500;
    font-size: 9pt;
  }

  .summary-value {
    font-weight: 600;
    font-size: 9pt;
  }

  .summary-row.subtotal {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 2px solid #000;
  }

  .summary-row.discount .summary-label,
  .summary-row.discount .summary-value {
    color: #000;
  }

  .summary-row.tax .summary-label,
  .summary-row.tax .summary-value {
    color: #000;
  }

  .summary-row.total {
    margin-top: 6px;
    padding-top: 8px;
    border-top: 3px double #000;
  }

  .summary-row.total .summary-label {
    font-size: 11pt;
    font-weight: 700;
  }

  .summary-row.total .summary-value {
    font-size: 13pt;
    font-weight: 700;
    color: #000;
  }

  /* Print Optimization */
  @media print {
    body {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    
    .section {
      page-break-inside: avoid;
    }
    
    .invoice-summary {
      page-break-inside: avoid;
    }
  }

  /* No Data Message */
  .no-data {
    padding: 20px;
    text-align: center;
    color: #999;
    font-style: italic;
  }

  /* PDF Header - For Zimmet PDFs */
  .pdf-header {
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 2px solid #000;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo-section {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .logo {
    width: 50px;
    height: 50px;
    object-fit: contain;
  }

  .header-title {
    font-size: 14pt;
    font-weight: 700;
    color: #000;
    margin-bottom: 4px;
  }

  .header-subtitle {
    font-size: 10pt;
    color: #666;
    font-weight: 400;
  }

  .header-date {
    text-align: right;
    font-size: 9pt;
    color: #666;
  }

  /* Info Card - For Zimmet PDFs */
  .info-card {
    background: #fff;
    padding: 0;
  }

  .info-row {
    display: flex;
    margin-bottom: 8px;
    align-items: flex-start;
  }

  .info-row:last-child {
    margin-bottom: 0;
  }

  .info-row .info-label {
    width: 150px;
    font-size: 9pt;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .info-row .info-value {
    flex: 1;
    font-size: 10pt;
    color: #000;
    font-weight: 400;
  }
</style>
`

