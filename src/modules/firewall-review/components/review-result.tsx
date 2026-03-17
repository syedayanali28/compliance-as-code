import { ReviewData } from '../dashboard-page';

interface Props {
  data: ReviewData;
  logs?: string[];
}

export function ReviewResult({ data, logs }: Props) {
  const { decision, risk_score, normalized, ticket_key, reviewed_at } = data;

  return (
    <div className="space-y-6">
      {/* Decision Banner */}
      <DecisionBanner decision={decision} riskScore={risk_score} ticketKey={ticket_key} />

      {/* Processing Logs */}
      {logs && logs.length > 0 && (
        <Section title="Processing Steps">
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-green-500 mt-0.5 shrink-0"></span>
                <span className="text-zinc-600 dark:text-zinc-400 font-mono">{log}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Quick Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          label="Requester"
          value={normalized.meta.requester.name || 'Unknown'}
          subtext={normalized.meta.requester.email}
        />
        <InfoCard
          label="Manager Approval"
          value={normalized.meta.rules_manager_approval.status}
          variant={normalized.meta.rules_manager_approval.status === 'APPROVED' ? 'success' : 'warning'}
        />
        <InfoCard
          label="Environment"
          value={normalized.meta.environment.join(', ') || 'Not specified'}
        />
      </div>

      {/* Request Summary */}
      <Section title="Request Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusItem
            label="Business Justification"
            value={normalized.request_summary.business_justification_present}
          />
          <StatusItem
            label="Design Reference"
            value={normalized.request_summary.design_reference_present}
          />
          <StatusItem
            label="ARB Required"
            value={normalized.meta.arb_required}
          />
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">SRA/SDR Reference</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {normalized.request_summary.sra_sdr_reference || 'None'}
            </p>
          </div>
        </div>
        {normalized.request_summary.stated_purpose && (
          <div className="mt-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Stated Purpose</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{normalized.request_summary.stated_purpose}</p>
          </div>
        )}
      </Section>

      {/* Firewall Rules */}
      {normalized.firewall_rules.length > 0 && (
        <Section title={`Firewall Rules (${normalized.firewall_rules.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left py-2 px-3 font-medium text-zinc-500 dark:text-zinc-400">Ref</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-500 dark:text-zinc-400">Source</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-500 dark:text-zinc-400">Destination</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-500 dark:text-zinc-400">Services</th>
                  <th className="text-left py-2 px-3 font-medium text-zinc-500 dark:text-zinc-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {normalized.firewall_rules.map((rule, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="py-2 px-3 font-mono text-xs">{rule.user_ref}</td>
                    <td className="py-2 px-3">
                      <NetworkCell network={rule.source} />
                    </td>
                    <td className="py-2 px-3">
                      <NetworkCell network={rule.destination} />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {rule.services.map((s, j) => (
                          <span key={j} className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-mono">
                            {s.proto}/{s.port}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        rule.action === 'ALLOW' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {rule.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Guideline Findings */}
      {normalized.guideline_findings.length > 0 && (
        <Section title="Guideline Findings">
          <div className="space-y-3">
            {normalized.guideline_findings.map((finding, i) => (
              <FindingCard key={i} finding={finding} />
            ))}
          </div>
        </Section>
      )}

      {/* LLM Review */}
      {normalized.llm_review && (
        <Section title="AI Analysis">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">AI Decision</p>
                <p className={`text-lg font-semibold ${getDecisionColor(normalized.llm_review.decision)}`}>
                  {normalized.llm_review.decision}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Confidence</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {Math.round(normalized.llm_review.confidence * 100)}%
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {normalized.llm_review.summary}
              </p>
            </div>

            {normalized.llm_review.missing_info.length > 0 && (
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Missing Information:</p>
                <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                  {normalized.llm_review.missing_info.map((info, i) => (
                    <li key={i}>{info}</li>
                  ))}
                </ul>
              </div>
            )}

            {normalized.llm_review.suggested_jira_comment && (
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Suggested JIRA Comment:</p>
                <div className="p-4 bg-zinc-900 dark:bg-zinc-950 rounded-lg">
                  <pre className="text-sm text-zinc-100 whitespace-pre-wrap font-mono">
                    {normalized.llm_review.suggested_jira_comment}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Footer */}
      <div className="text-xs text-zinc-400 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        Reviewed at {new Date(reviewed_at).toLocaleString()}
      </div>
    </div>
  );
}

// Helper Components

function DecisionBanner({ decision, riskScore, ticketKey }: { decision: string; riskScore: number; ticketKey: string }) {
  const config = {
    ACCEPT: { bg: 'bg-[#172214]', border: 'border-[#d9f99d]/40', text: 'text-[#d9f99d]', icon: 'OK' },
    REJECT: { bg: 'bg-[#31160f]', border: 'border-[#ff4d00]/45', text: 'text-[#ff8f66]', icon: 'X' },
    REQUEST_INFO: { bg: 'bg-[#31160f]', border: 'border-[#ff4d00]/45', text: 'text-[#ff8f66]', icon: '!' },
  }[decision] || { bg: 'bg-zinc-50', border: 'border-zinc-200', text: 'text-zinc-700', icon: '-' };

  return (
    <div className={`p-6 rounded-xl border ${config.bg} ${config.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className={`text-4xl ${config.text}`}>{config.icon}</span>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{ticketKey}</p>
            <p className={`text-2xl font-bold ${config.text}`}>{decision.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Risk Score</p>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  riskScore >= 70 ? 'bg-red-500' : riskScore >= 40 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${riskScore}%` }}
              />
            </div>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{riskScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function InfoCard({ label, value, subtext, variant }: { label: string; value: string; subtext?: string | null; variant?: 'success' | 'warning' }) {
  const colors = {
    success: 'text-[#d9f99d]',
    warning: 'text-[#ff8f66]',
    default: 'text-zinc-900 dark:text-zinc-100',
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <p className={`text-sm font-medium ${colors[variant || 'default']}`}>{value}</p>
      {subtext && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{subtext}</p>}
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
        value 
          ? 'status-pass' 
          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
      }`}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  );
}

function NetworkCell({ network }: { network: { objects?: string[]; ips?: string[]; zone?: string | null; is_internet?: boolean } }) {
  const items = [...(network.objects || []), ...(network.ips || [])];
  return (
    <div>
      {network.is_internet && (
        <span className="inline-block px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium mb-1">
          INTERNET
        </span>
      )}
      {network.zone && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{network.zone}</p>
      )}
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 3).map((item, i) => (
          <span key={i} className="text-xs font-mono text-zinc-700 dark:text-zinc-300">{item}</span>
        ))}
        {items.length > 3 && (
          <span className="text-xs text-zinc-400">+{items.length - 3} more</span>
        )}
      </div>
    </div>
  );
}

function FindingCard({ finding }: { finding: ReviewData['normalized']['guideline_findings'][0] }) {
  const severityColors = {
    HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    LOW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  const statusColors = {
    VIOLATION: 'border-l-red-500',
    WARNING: 'border-l-amber-500',
    INFO: 'border-l-blue-500',
  };

  return (
    <div className={`p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border-l-4 ${statusColors[finding.status]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{finding.caution_id}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityColors[finding.severity]}`}>
              {finding.severity}
            </span>
            <span className="text-xs text-zinc-400">{finding.status}</span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{finding.evidence.join('; ')}</p>
          {finding.rule_refs.length > 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Affects: {finding.rule_refs.join(', ')}
            </p>
          )}
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
          finding.required_action === 'REJECT' 
            ? 'status-review'
            : finding.required_action === 'REQUEST_INFO'
            ? 'status-review'
            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
        }`}>
          {finding.required_action.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}

function getDecisionColor(decision: string) {
  switch (decision) {
    case 'ACCEPT': return 'text-green-600 dark:text-green-400';
    case 'REJECT': return 'text-red-600 dark:text-red-400';
    case 'REQUEST_INFO': return 'text-amber-600 dark:text-amber-400';
    default: return 'text-zinc-600 dark:text-zinc-400';
  }
}


