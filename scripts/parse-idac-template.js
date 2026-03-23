const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'idac-template.xlsx');
const workbook = XLSX.readFile(templatePath);

const structure = {
  sheets: workbook.SheetNames,
  details: {}
};

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  // Get headers (first row)
  const headers = data[0] || [];
  
  // Get sample rows (first 5 data rows)
  const sampleRows = data.slice(1, 6);
  
  structure.details[sheetName] = {
    columns: headers,
    columnCount: headers.length,
    rowCount: data.length - 1,
    sampleData: sampleRows.map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] || '';
      });
      return obj;
    })
  };
});

console.log(JSON.stringify(structure, null, 2));
