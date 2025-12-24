// Export Utilities for CSV, Excel, and PDF

import { ExportOptions } from '../types';

// Export to CSV
export const exportToCSV = (data: any[], filename: string, columns?: string[]) => {
  if (data.length === 0) return;
  
  const headers = columns || Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

// Export to Excel (using CSV format with .xlsx extension for simplicity)
export const exportToExcel = (data: any[], filename: string, columns?: string[]) => {
  // In a real implementation, you would use a library like xlsx or exceljs
  // For this demo, we'll create a CSV-like format
  exportToCSV(data, filename.replace('.xlsx', ''), columns);
};

// Export to PDF (simplified - in production use jsPDF or similar)
export const exportToPDF = (data: any[], filename: string) => {
  // Create HTML table
  const headers = Object.keys(data[0] || {});
  const tableHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4F46E5; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>${filename}</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(h => `<td>${row[h]}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(tableHTML);
    printWindow.document.close();
    printWindow.print();
  }
};

// Export chart as image
export const exportChartAsImage = (chartId: string, filename: string) => {
  const chartElement = document.getElementById(chartId);
  if (!chartElement) return;
  
  // In a real implementation, use html2canvas or similar library
  alert('Chart export functionality would use html2canvas library in production');
};

// Helper function to download file
const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Main export function
export const exportData = (options: ExportOptions) => {
  const { format, data, filename, columns } = options;
  
  switch (format) {
    case 'csv':
      exportToCSV(data, filename, columns);
      break;
    case 'excel':
      exportToExcel(data, filename, columns);
      break;
    case 'pdf':
      exportToPDF(data, filename);
      break;
    default:
      console.error('Unsupported export format');
  }
};
