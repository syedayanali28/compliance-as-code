/**
 * Attachment Processor Module
 * 
 * Processes and stores parsed attachments from JIRA tickets.
 * Currently supports:
 * - Excel files (.xlsx, .xls)
 * 
 * Future support planned for:
 * - PDF documents
 * - Word documents (.docx, .doc)
 * - Images (OCR extraction)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, parse as parsePath } from 'path';
import * as XLSX from 'xlsx';
import { logger } from '../logging/app-logger';
import { ExcelFirewallParser } from './excel-firewall-rules';
import type { JiraAttachment, FirewallRule } from '../types';

/**
 * Represents a parsed attachment with metadata
 */
export interface ParsedAttachment {
  /** Original attachment ID from JIRA */
  attachmentId: string;
  /** Original filename */
  originalFilename: string;
  /** MIME type of the original file */
  mimeType: string;
  /** Size in bytes of the original file */
  originalSize: number;
  /** Type of parser used */
  parserType: 'excel' | 'pdf' | 'word' | 'image' | 'unknown';
  /** Timestamp when parsing occurred */
  parsedAt: string;
  /** Whether parsing was successful */
  success: boolean;
  /** Error message if parsing failed */
  error?: string;
  /** Parsed content - structure depends on parserType */
  content: ParsedContent;
}

/**
 * Union type for different parsed content types
 */
export type ParsedContent = 
  | ExcelParsedContent
  | PdfParsedContent
  | WordParsedContent
  | ImageParsedContent
  | UnknownContent;

export interface ExcelParsedContent {
  type: 'excel';
  /** Sheet names in the workbook */
  sheets: string[];
  /** Extracted firewall rules */
  firewallRules: FirewallRule[];
  /** Raw data from all sheets (for context) */
  rawData: Record<string, unknown[][]>;
  /** Summary statistics */
  stats: {
    totalSheets: number;
    totalRows: number;
    rulesExtracted: number;
  };
}

export interface PdfParsedContent {
  type: 'pdf';
  /** Extracted text content */
  text: string;
  /** Page count */
  pageCount: number;
  // TODO: Future implementation
}

export interface WordParsedContent {
  type: 'word';
  /** Extracted text content */
  text: string;
  // TODO: Future implementation
}

export interface ImageParsedContent {
  type: 'image';
  /** OCR extracted text */
  text: string;
  /** Image description/alt text */
  description: string;
  // TODO: Future implementation
}

export interface UnknownContent {
  type: 'unknown';
  /** Raw content description */
  description: string;
}

/**
 * Result of processing all attachments for a ticket
 */
export interface AttachmentProcessingResult {
  /** Ticket key */
  ticketKey: string;
  /** Output directory where files were written */
  outputDirectory: string;
  /** List of processed attachments */
  processedAttachments: ParsedAttachment[];
  /** Summary statistics */
  summary: {
    total: number;
    successful: number;
    failed: number;
    byType: Record<string, number>;
  };
}

/**
 * Attachment Processor class
 * Handles parsing and storage of JIRA attachments
 */
export class AttachmentProcessor {
  private excelParser: ExcelFirewallParser;

  constructor() {
    this.excelParser = new ExcelFirewallParser();
  }

  /**
   * Process all attachments for a ticket and store parsed data
   * @param ticketKey - JIRA ticket key
   * @param attachments - Array of attachments from JIRA
   * @param outputDir - Base output directory (e.g., './out')
   * @returns Processing result with parsed attachments
   */
  async processAndStore(
    ticketKey: string,
    attachments: JiraAttachment[],
    outputDir: string
  ): Promise<AttachmentProcessingResult> {
    logger.info(`Processing ${attachments.length} attachments for ${ticketKey}`);

    // Create output directory structure
    const attachmentsDir = join(outputDir, ticketKey, 'attachments_parsed');
    if (!existsSync(attachmentsDir)) {
      mkdirSync(attachmentsDir, { recursive: true });
      logger.debug(`Created directory: ${attachmentsDir}`);
    }

    const processedAttachments: ParsedAttachment[] = [];
    const stats = {
      total: attachments.length,
      successful: 0,
      failed: 0,
      byType: {} as Record<string, number>,
    };

    for (const attachment of attachments) {
      const parsed = await this.processAttachment(attachment);
      processedAttachments.push(parsed);

      // Update stats
      if (parsed.success) {
        stats.successful++;
      } else {
        stats.failed++;
      }
      stats.byType[parsed.parserType] = (stats.byType[parsed.parserType] || 0) + 1;

      // Write to file
      const outputFilename = this.getOutputFilename(attachment.filename);
      const outputPath = join(attachmentsDir, outputFilename);
      
      try {
        writeFileSync(outputPath, JSON.stringify(parsed, null, 2), 'utf-8');
        logger.debug(`Wrote parsed attachment to: ${outputPath}`);
      } catch (error) {
        logger.error(`Failed to write parsed attachment: ${outputPath}`, { error });
      }
    }

    // Write summary file
    const summaryPath = join(attachmentsDir, '_summary.json');
    const summary: AttachmentProcessingResult = {
      ticketKey,
      outputDirectory: attachmentsDir,
      processedAttachments,
      summary: stats,
    };

    writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    logger.info(`Attachment processing complete. Summary written to: ${summaryPath}`);

    return summary;
  }

  /**
   * Process a single attachment and return parsed data
   */
  private async processAttachment(attachment: JiraAttachment): Promise<ParsedAttachment> {
    const parserType = this.detectParserType(attachment);
    const baseParsed: Omit<ParsedAttachment, 'content' | 'success' | 'error'> = {
      attachmentId: attachment.id,
      originalFilename: attachment.filename,
      mimeType: attachment.mimeType,
      originalSize: attachment.size,
      parserType,
      parsedAt: new Date().toISOString(),
    };

    try {
      const content = await this.parseContent(attachment, parserType);
      return {
        ...baseParsed,
        success: true,
        content,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to parse attachment: ${attachment.filename}`, { error: errorMessage });
      
      return {
        ...baseParsed,
        success: false,
        error: errorMessage,
        content: {
          type: 'unknown',
          description: `Failed to parse: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Detect which parser to use based on file extension and MIME type
   */
  private detectParserType(attachment: JiraAttachment): ParsedAttachment['parserType'] {
    const filename = attachment.filename.toLowerCase();
    const mimeType = attachment.mimeType.toLowerCase();

    // Excel files
    if (
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xls') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel')
    ) {
      return 'excel';
    }

    // PDF files (for future implementation)
    if (filename.endsWith('.pdf') || mimeType.includes('pdf')) {
      return 'pdf';
    }

    // Word documents (for future implementation)
    if (
      filename.endsWith('.docx') ||
      filename.endsWith('.doc') ||
      mimeType.includes('word') ||
      mimeType.includes('document')
    ) {
      return 'word';
    }

    // Images (for future implementation)
    if (
      filename.match(/\.(png|jpg|jpeg|gif|bmp|tiff?)$/i) ||
      mimeType.startsWith('image/')
    ) {
      return 'image';
    }

    return 'unknown';
  }

  /**
   * Parse attachment content based on parser type
   */
  private async parseContent(
    attachment: JiraAttachment,
    parserType: ParsedAttachment['parserType']
  ): Promise<ParsedContent> {
    switch (parserType) {
      case 'excel':
        return this.parseExcel(attachment);

      case 'pdf':
        // TODO: Implement PDF parsing
        return {
          type: 'pdf',
          text: '[PDF parsing not yet implemented]',
          pageCount: 0,
        };

      case 'word':
        // TODO: Implement Word document parsing
        return {
          type: 'word',
          text: '[Word document parsing not yet implemented]',
        };

      case 'image':
        // TODO: Implement image OCR
        return {
          type: 'image',
          text: '[Image OCR not yet implemented]',
          description: `Image file: ${attachment.filename}`,
        };

      default:
        return {
          type: 'unknown',
          description: `Unsupported file type: ${attachment.mimeType}`,
        };
    }
  }

  /**
   * Parse Excel attachment and extract firewall rules
   */
  private parseExcel(attachment: JiraAttachment): ExcelParsedContent {
    logger.info(`Parsing Excel file: ${attachment.filename}`);

    // Decode base64 content and read workbook
    const buffer = Buffer.from(attachment.content, 'base64');
    
    // Use xlsx to get sheet info
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    const sheets = workbook.SheetNames;
    const rawData: Record<string, unknown[][]> = {};
    let totalRows = 0;

    // Extract raw data from all sheets
    for (const sheetName of sheets) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as unknown[][];
      
      rawData[sheetName] = data;
      totalRows += data.length;
    }

    // Parse firewall rules using existing parser
    const firewallRules = this.excelParser.parseFromBase64(attachment.content);

    return {
      type: 'excel',
      sheets,
      firewallRules,
      rawData,
      stats: {
        totalSheets: sheets.length,
        totalRows,
        rulesExtracted: firewallRules.length,
      },
    };
  }

  /**
   * Generate output filename from original filename
   */
  private getOutputFilename(originalFilename: string): string {
    const parsed = parsePath(originalFilename);
    return `${parsed.name}.parsed.json`;
  }

  /**
   * Get all firewall rules from processed attachments
   * Useful for aggregating rules across multiple Excel files
   */
  static extractAllRules(result: AttachmentProcessingResult): FirewallRule[] {
    const allRules: FirewallRule[] = [];

    for (const attachment of result.processedAttachments) {
      if (attachment.success && attachment.content.type === 'excel') {
        allRules.push(...attachment.content.firewallRules);
      }
    }

    return allRules;
  }
}

