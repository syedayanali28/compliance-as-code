// Excel parser for firewall rules

import * as XLSX from 'xlsx';
import { logger } from '../logging/app-logger';
import type { FirewallRule, Service } from '../types';

export interface ExcelParserOptions {
  sheetName?: string;
  headerRow?: number;
}

export class ExcelFirewallParser {
  parseFromBase64(base64Content: string, options: ExcelParserOptions = {}): FirewallRule[] {
    logger.info('Parsing Excel firewall rules from base64 content');
    
    try {
      const buffer = Buffer.from(base64Content, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Use specified sheet or first sheet
      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }

      // Convert to JSON with header row
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as unknown[][];

      return this.parseRulesFromSheet(data, options.headerRow);
    } catch (error) {
      logger.error('Failed to parse Excel file', { error });
      throw error;
    }
  }

  parseFromFile(filePath: string, options: ExcelParserOptions = {}): FirewallRule[] {
    logger.info(`Parsing Excel firewall rules from file: ${filePath}`);
    
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }

      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as unknown[][];

      return this.parseRulesFromSheet(data, options.headerRow);
    } catch (error) {
      logger.error(`Failed to parse Excel file: ${filePath}`, { error });
      throw error;
    }
  }

  private parseRulesFromSheet(data: unknown[][], headerRowIndex: number = 0): FirewallRule[] {
    if (data.length === 0) {
      logger.warn('Empty Excel sheet');
      return [];
    }

    // Find header row (look for common column names)
    let headerRow: string[] = [];
    let dataStartRow = 0;

    for (let i = headerRowIndex; i < Math.min(data.length, 20); i++) {
      const row = data[i] as unknown[];
      const rowStr = String(row.join('')).toLowerCase();
      
      // Check if this row contains header-like content
      if (
        rowStr.includes('source') ||
        rowStr.includes('destination') ||
        rowStr.includes('service') ||
        rowStr.includes('action')
      ) {
        headerRow = (row as unknown[]).map((cell: unknown) => String(cell).trim());
        dataStartRow = i + 1;
        break;
      }
    }

    if (headerRow.length === 0) {
      logger.warn('Could not find header row, using first row as header');
      headerRow = (data[0] as unknown[]).map((cell: unknown) => String(cell).trim());
      dataStartRow = 1;
    }

    logger.debug(`Found ${headerRow.length} columns, data starts at row ${dataStartRow}`);

    // Parse each data row
    const rules: FirewallRule[] = [];

    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i] as unknown[];
      
      // Skip empty rows
      if (row.every((cell: unknown) => !cell || String(cell).trim() === '')) {
        continue;
      }

      try {
        const rule = this.parseRule(headerRow, row);
        if (rule) {
          rules.push(rule);
        }
      } catch (error) {
        logger.warn(`Failed to parse row ${i + 1}`, { error });
      }
    }

    logger.info(`Parsed ${rules.length} firewall rules from Excel`);
    return rules;
  }

  private parseRule(headers: string[], row: unknown[]): FirewallRule | null {
    const getCell = (header: string): string => {
      const index = headers.findIndex((h) =>
        h.toLowerCase().includes(header.toLowerCase())
      );
      return index >= 0 ? String(row[index] || '').trim() : '';
    };

    const getCellByIndex = (index: number): string => {
      return index < row.length ? String(row[index] || '').trim() : '';
    };

    // Try to find common columns
    const category = getCell('category') || getCell('type') || '';
    const userRef = getCell('ref') || getCell('rule') || getCell('no') || getCellByIndex(0);
    
    // Skip if this looks like a header or empty row
    if (!userRef || userRef.toLowerCase().includes('no.') || userRef.toLowerCase().includes('ref')) {
      return null;
    }

    // Source
    const sourceObj = getCell('source object') || getCell('source') || getCell('src');
    const sourceDesc = getCell('source desc') || getCell('src desc') || '';
    const sourceZone = getCell('source zone') || getCell('src zone') || '';

    // Destination
    const destObj = getCell('destination object') || getCell('destination') || getCell('dst');
    const destIPs = getCell('destination ip') || getCell('dst ip') || getCell('ip');
    const destXlates = getCell('xlate') || getCell('nat') || '';
    const destDesc = getCell('destination desc') || getCell('dst desc') || '';
    const destZone = getCell('destination zone') || getCell('dst zone') || '';

    // Services
    const serviceStr = getCell('service') || getCell('port') || getCell('protocol') || '';
    const services = this.parseServices(serviceStr);

    // Other fields
    const action = getCell('action') || 'accept';
    const gateway = getCell('gateway') || getCell('firewall') || '';
    const justification = getCell('justification') || getCell('purpose') || getCell('remarks') || '';
    const arbReviewed = getCell('arb').toLowerCase().includes('yes') || 
                        getCell('arb').toLowerCase().includes('true') ||
                        getCell('reviewed').toLowerCase().includes('yes');
    const commonService = getCell('common').toLowerCase().includes('yes') ||
                         getCell('common').toLowerCase().includes('true');

    // Detect if source is Internet
    const isInternet = this.isInternetSource(sourceObj, sourceDesc);

    const rule: FirewallRule = {
      category,
      user_ref: userRef,
      source: {
        objects: sourceObj ? sourceObj.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [],
        desc: sourceDesc,
        zone: sourceZone || null,
        is_internet: isInternet,
      },
      destination: {
        objects: destObj ? destObj.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [],
        ips: destIPs ? destIPs.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [],
        xlates: destXlates ? destXlates.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [],
        desc: destDesc,
        zone: destZone || null,
      },
      services,
      action: action.toLowerCase(),
      gateway,
      justification,
      arb_reviewed: arbReviewed,
      common_service: commonService,
      raw_fields: {
        row_data: row,
        headers,
      },
    };

    return rule;
  }

  private parseServices(serviceStr: string): Service[] {
    if (!serviceStr) {
      return [];
    }

    const services: Service[] = [];
    
    // Split by common delimiters
    const lines = serviceStr.split(/[\n,;]/).map(s => s.trim()).filter(Boolean);

    for (const line of lines) {
      // Try to match patterns like "TCP/443", "UDP 53", "tcp:8080", etc.
      const match = line.match(/^(tcp|udp|icmp)[\/:,\s]+(\d+)$/i);
      
      if (match) {
        services.push({
          proto: match[1].toLowerCase(),
          port: parseInt(match[2]),
        });
      } else if (/^\d+$/.test(line)) {
        // Just a port number, assume TCP
        services.push({
          proto: 'tcp',
          port: parseInt(line),
        });
      } else {
        // Keep as-is if can't parse
        services.push({
          proto: 'unknown',
          port: line,
        });
      }
    }

    return services;
  }

  private isInternetSource(sourceObj: string, sourceDesc: string): boolean {
    const combined = (sourceObj + ' ' + sourceDesc).toLowerCase();
    
    // Check for explicit "internet" or "any"
    if (combined.includes('internet') || combined.includes('any') || combined.includes('0.0.0.0')) {
      return true;
    }

    // Check for public IP ranges (simplified)
    // In production, you'd check against actual public IP ranges
    const publicPatterns = [
      /\b(?:8\.8\.|1\.1\.|208\.67\.)/,  // Public DNS
      /\b(?:public|external|wan)\b/i,
    ];

    return publicPatterns.some(pattern => pattern.test(combined));
  }
}

