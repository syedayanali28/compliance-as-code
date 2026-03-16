import { ReviewData } from '../dashboard-page';

export interface ReviewHistory {
  id: string;
  ticket_key: string;
  decision: 'ACCEPT' | 'REJECT' | 'REQUEST_INFO';
  risk_score: number;
  reviewed_at: string;
  completed_at: string;
  logs: string[];
  result: ReviewData;
}

interface HistorySidebarProps {
  history: ReviewHistory[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectItem: (item: ReviewHistory) => void;
  onClearHistory: () => void;
}

export function HistorySidebar({ 
  history, 
  isOpen, 
  onToggle, 
  onSelectItem, 
  onClearHistory 
}: HistorySidebarProps) {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${!isOpen ? 'lg:w-0 lg:border-0 lg:overflow-hidden' : ''}`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">History</h2>
              <button
                onClick={onToggle}
                className="lg:hidden p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label="Close sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear all history?')) {
                    onClearHistory();
                  }
                }}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="p-6 text-center">
                <svg className="w-12 h-12 mx-auto text-zinc-200 dark:text-zinc-800 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">No reviews yet</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {history.map((item) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    onClick={() => {
                      onSelectItem(item);
                      // Close sidebar on mobile after selection
                      if (window.innerWidth < 1024) {
                        onToggle();
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function HistoryItem({ item, onClick }: { item: ReviewHistory; onClick: () => void }) {
  const decisionColors = {
    ACCEPT: 'text-green-600 dark:text-green-400',
    REJECT: 'text-red-600 dark:text-red-400',
    REQUEST_INFO: 'text-amber-600 dark:text-amber-400',
  };

  const duration = new Date(item.completed_at).getTime() - new Date(item.reviewed_at).getTime();
  const durationSec = Math.round(duration / 1000);

  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {item.ticket_key}
        </span>
        <span className={`text-xs font-medium ${decisionColors[item.decision]}`}>
          {item.decision === 'REQUEST_INFO' ? 'INFO' : item.decision}
        </span>
      </div>
      
      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {durationSec}s
        </span>
        <span>??/span>
        <span>Risk {item.risk_score}</span>
        <span>??/span>
        <span>{item.result.normalized.firewall_rules.length} rules</span>
      </div>

      <div className="text-xs text-zinc-400 dark:text-zinc-500">
        {new Date(item.reviewed_at).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </div>
    </button>
  );
}


