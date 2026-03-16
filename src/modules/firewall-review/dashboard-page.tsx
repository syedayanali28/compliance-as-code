'use client';

import { useState, useEffect } from 'react';
import { ReviewResult } from '@/modules/firewall-review/components/review-result';
import { HistorySidebar, ReviewHistory } from '@/modules/firewall-review/components/history-sidebar';

export default function Dashboard() {
  const [ticketKey, setTicketKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewData | null>(null);
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [history, setHistory] = useState<ReviewHistory[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNav, setShowNav] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('review_history');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('review_history', JSON.stringify(history));
    }
  }, [history]);

  // Close nav menu when clicking outside
  useEffect(() => {
    const handleClick = () => setShowNav(false);
    if (showNav) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showNav]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketKey.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setProgressLogs([]);

    const startTime = new Date();
    const logs: string[] = [];

    try {
      const res = await fetch(`/api/firewall-review/review-stream/${ticketKey.trim().toUpperCase()}`);
      
      if (!res.ok) {
        throw new Error('Review request failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress' && data.message) {
              const logMsg = `[Step ${data.step}/${data.totalSteps}] ${data.message}`;
              logs.push(logMsg);
              setProgressLogs([...logs]);
            } else if (data.type === 'complete' && data.data) {
              setResult(data.data);
              
              // Add to history
              const historyEntry: ReviewHistory = {
                id: Date.now().toString(),
                ticket_key: data.data.ticket_key,
                decision: data.data.decision,
                risk_score: data.data.risk_score,
                reviewed_at: startTime.toISOString(),
                completed_at: new Date().toISOString(),
                logs,
                result: data.data,
              };
              
              setHistory(prev => [historyEntry, ...prev].slice(0, 50)); // Keep last 50
            } else if (data.type === 'error') {
              throw new Error(data.message || 'Review failed');
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryItem = (item: ReviewHistory) => {
    setResult(item.result);
    setProgressLogs(item.logs);
    setError(null);
    setTicketKey(item.ticket_key);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
      {/* History Sidebar */}
      <HistorySidebar 
        history={history}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSelectItem={loadHistoryItem}
        onClearHistory={() => {
          setHistory([]);
          localStorage.removeItem('review_history');
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label="Toggle history"
              >
                <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Firewall Review
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Navigation */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNav(!showNav);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span>Menu</span>
                </button>
                {showNav && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden z-50">
                    <a
                      href="/firewall-review/admin/guidelines"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Guidelines</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Manage security rules</div>
                      </div>
                    </a>
                    <div className="border-t border-zinc-200 dark:border-zinc-800"></div>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Database</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Supabase console</div>
                      </div>
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
              {history.length > 0 && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {history.length} review{history.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1">
          {/* Search Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={ticketKey}
                  onChange={(e) => setTicketKey(e.target.value)}
                  placeholder="Enter JIRA ticket key (e.g., ITISUFR-748)"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {ticketKey && (
                  <button
                    type="button"
                    onClick={() => setTicketKey('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !ticketKey.trim()}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <span>Analyze</span>
                )}
              </button>
            </div>
          </form>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Review Failed</h3>
                  <p className="text-sm text-red-700 dark:text-red-400 whitespace-pre-line">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State with Progress Logs */}
          {loading && (
            <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="bg-blue-600 px-5 py-3">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Processing</h3>
                    <p className="text-blue-100 text-xs">{ticketKey}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-1.5 max-h-80 overflow-y-auto">
                {progressLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-700 dark:text-zinc-300 font-mono">{log}</span>
                  </div>
                ))}
                {progressLogs.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="w-3 h-3 bg-zinc-300 dark:bg-zinc-700 rounded-full animate-pulse" />
                    <span>Initializing...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {result && <ReviewResult data={result} logs={progressLogs} />}

          {/* Empty State */}
          {!loading && !result && !error && history.length === 0 && (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-zinc-200 dark:text-zinc-800 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">No reviews yet</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Enter a ticket key above to start analyzing firewall rules</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Types for the review data
export interface ReviewData {
  ticket_key: string;
  decision: 'ACCEPT' | 'REJECT' | 'REQUEST_INFO';
  risk_score: number;
  normalized: {
    meta: {
      ticket_key: string;
      fetched_at: string;
      requester: { name: string | null; email: string | null };
      responsible_manager: { name: string | null; email: string | null };
      rules_category: string | null;
      rules_manager_approval: {
        status: 'APPROVED' | 'PENDING' | 'NOT_FOUND';
        approved_by: string | null;
        approved_at: string | null;
        comment_excerpt: string | null;
      };
      arb_required: boolean;
      arb_link: string | null;
      environment: string[];
      notes: string[];
    };
    request_summary: {
      stated_purpose: string | null;
      business_justification_present: boolean;
      design_reference_present: boolean;
      sra_sdr_reference: string | null;
    };
    firewall_rules: Array<{
      category: string;
      user_ref: string;
      source: { objects?: string[]; ips?: string[]; zone?: string | null; is_internet?: boolean };
      destination: { objects?: string[]; ips?: string[]; zone?: string | null; is_internet?: boolean };
      services: Array<{ proto: string; port: number | string }>;
      action: string;
      gateway?: string;
      justification?: string;
    }>;
    guideline_findings: Array<{
      caution_id: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      status: 'VIOLATION' | 'WARNING' | 'INFO';
      rule_refs: string[];
      evidence: string[];
      required_action: 'REJECT' | 'REQUEST_INFO' | 'ALLOW_WITH_CONTROLS';
    }>;
    llm_review: {
      decision: 'ACCEPT' | 'REJECT' | 'REQUEST_INFO';
      confidence: number;
      summary: string;
      violations: Array<{ caution_id: string; explanation: string }>;
      missing_info: string[];
      suggested_jira_comment: string;
    } | null;
  };
  reviewed_by: string;
  reviewed_at: string;
}


