// Audit logger - append-only JSONL log

import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { dirname } from 'path';
import type { AuditLogEntry } from '../types';

export class AuditLogger {
  private logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
    this.ensureLogFileExists();
  }

  private ensureLogFileExists(): void {
    const dir = dirname(this.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(this.logPath)) {
      writeFileSync(this.logPath, '', 'utf-8');
    }
  }

  log(entry: AuditLogEntry): void {
    const line = JSON.stringify(entry) + '\n';
    appendFileSync(this.logPath, line, 'utf-8');
  }

  createEntry(
    user: string,
    ticketKey: string,
    action: string,
    artifacts: string[],
    finalDecision: string,
    riskScore: number
  ): AuditLogEntry {
    return {
      timestamp: new Date().toISOString(),
      user,
      ticket_key: ticketKey,
      action,
      artifacts,
      final_decision: finalDecision,
      risk_score: riskScore,
    };
  }
}

