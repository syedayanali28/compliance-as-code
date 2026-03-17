// Streaming review API with real-time progress updates
// Uses PAT authentication from environment variables

import { NextRequest } from "next/server";
import { JiraClient } from "@/modules/firewall-review/lib/jira/client";
import { SSOAuthenticator } from "@/modules/firewall-review/lib/jira/auth-sso";
import { Normalizer } from "@/modules/firewall-review/lib/normalizer/to-ai-format";
import { GuidelinesEngine } from "@/modules/firewall-review/lib/guidelines/rules";
import { LLMReviewer } from "@/modules/firewall-review/lib/llm/reviewer";
import { getConfig } from "@/modules/firewall-review/lib/config";

export const dynamic = "force-dynamic";

interface ProgressEvent {
	type: "progress" | "complete" | "error";
	step?: number;
	totalSteps?: number;
	message?: string;
	data?: unknown;
}

function sendEvent(controller: ReadableStreamDefaultController, event: ProgressEvent) {
	const data = `data: ${JSON.stringify(event)}\n\n`;
	controller.enqueue(new TextEncoder().encode(data));
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ ticketKey: string }> }
) {
	const { ticketKey } = await params;

	const envPat = process.env.PAT || process.env.JIRA_PAT || process.env.JIRA_TOKEN;
	const jiraUrl = process.env.JIRA_BASE_URL;

	if (!envPat || !jiraUrl) {
		return new Response(
			JSON.stringify({ error: "JIRA credentials not configured. Set PAT and JIRA_BASE_URL in .env" }),
			{ status: 401, headers: { "Content-Type": "application/json" } }
		);
	}

	process.env.JIRA_TOKEN = envPat;
	process.env.JIRA_PASSWORD = envPat;

	const stream = new ReadableStream({
		async start(controller) {
			try {
				const totalSteps = 6;
				const config = getConfig();

				sendEvent(controller, {
					type: "progress",
					step: 1,
					totalSteps,
					message: "Connecting to JIRA...",
				});

				const authenticator = new SSOAuthenticator(config.jira.tokenCachePath);
				const jiraClient = new JiraClient(jiraUrl, authenticator);

				sendEvent(controller, {
					type: "progress",
					step: 2,
					totalSteps,
					message: `Fetching ticket ${ticketKey}...`,
				});

				const ticket = await jiraClient.fetchIssue(ticketKey);

				sendEvent(controller, {
					type: "progress",
					step: 2,
					totalSteps,
					message: `Fetched: ${ticket.fields.summary}`,
				});

				sendEvent(controller, {
					type: "progress",
					step: 3,
					totalSteps,
					message: "Downloading attachments...",
				});

				const attachments = await jiraClient.fetchAttachments(ticketKey);

				sendEvent(controller, {
					type: "progress",
					step: 3,
					totalSteps,
					message: `Found ${attachments.length} attachment(s)`,
				});

				sendEvent(controller, {
					type: "progress",
					step: 4,
					totalSteps,
					message: "Parsing and normalizing data...",
				});

				const normalizer = new Normalizer();
				let normalized = await normalizer.normalize(ticket, attachments);

				sendEvent(controller, {
					type: "progress",
					step: 4,
					totalSteps,
					message: `Extracted ${normalized.firewall_rules.length} firewall rule(s)`,
				});

				sendEvent(controller, {
					type: "progress",
					step: 5,
					totalSteps,
					message: "Checking against security guidelines...",
				});

				const guidelines = new GuidelinesEngine();
				normalized = guidelines.applyAll(normalized);
				const riskScore = guidelines.calculateRiskScore(normalized);

				const violations = normalized.guideline_findings.filter((f) => f.status === "VIOLATION").length;
				const warnings = normalized.guideline_findings.filter((f) => f.status === "WARNING").length;

				sendEvent(controller, {
					type: "progress",
					step: 5,
					totalSteps,
					message: `Found ${violations} violation(s), ${warnings} warning(s). Risk: ${riskScore}/100`,
				});

				let llmReview = null;
				if (config.llm.apiKey) {
					sendEvent(controller, {
						type: "progress",
						step: 6,
						totalSteps,
						message: "Running AI analysis...",
					});

					try {
						const reviewer = new LLMReviewer({
							provider: config.llm.provider,
							model: config.llm.model,
							apiKey: config.llm.apiKey,
							endpoint: config.llm.endpoint,
							temperature: config.llm.temperature,
							maxTokens: config.llm.maxTokens,
						});

						llmReview = await reviewer.review(normalized);
						normalized.llm_review = llmReview;

						sendEvent(controller, {
							type: "progress",
							step: 6,
							totalSteps,
							message: `AI recommendation: ${llmReview.decision} (${Math.round(llmReview.confidence * 100)}% confidence)`,
						});
					} catch (err) {
						sendEvent(controller, {
							type: "progress",
							step: 6,
							totalSteps,
							message: `AI analysis skipped: ${err instanceof Error ? err.message : "Error"}`,
						});
					}
				} else {
					sendEvent(controller, {
						type: "progress",
						step: 6,
						totalSteps,
						message: "AI analysis skipped (no API key configured)",
					});
				}

				const hasAutoReject = guidelines.hasAutoRejectViolations(normalized);
				let decision: "ACCEPT" | "REJECT" | "REQUEST_INFO" = "ACCEPT";

				if (hasAutoReject) {
					decision = "REJECT";
				} else if (llmReview?.decision === "REJECT") {
					decision = "REJECT";
				} else if (llmReview?.decision === "REQUEST_INFO") {
					decision = "REQUEST_INFO";
				} else if (riskScore >= config.review.riskScoreThreshold) {
					decision = "REJECT";
				} else if (
					normalized.guideline_findings.some(
						(f) => f.severity === "HIGH" && f.status === "WARNING"
					)
				) {
					decision = "REQUEST_INFO";
				}

				sendEvent(controller, {
					type: "complete",
					data: {
						ticket_key: ticketKey,
						decision,
						risk_score: riskScore,
						normalized,
						reviewed_at: new Date().toISOString(),
					},
				});
			} catch (error) {
				let errorMessage = "Review failed";

				if (error instanceof Error) {
					errorMessage = error.message;

					if (errorMessage.includes("SSL") || errorMessage.includes("certificate")) {
						errorMessage +=
							"\n\nTip: Add NODE_TLS_REJECT_UNAUTHORIZED=0 to your .env file to bypass SSL verification for internal JIRA servers.";
					} else if (errorMessage.includes("ECONNREFUSED")) {
						errorMessage =
							"Cannot connect to JIRA server. Please check:\n- JIRA_BASE_URL in .env is correct\n- JIRA server is running\n- You have network access to the JIRA server";
					} else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
						errorMessage =
							"Cannot resolve JIRA hostname. Please check:\n- JIRA_BASE_URL in .env is correct\n- Your DNS settings\n- You are connected to the corporate network";
					} else if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
						errorMessage =
							"Authentication failed. Please check:\n- PAT token in .env is valid\n- Token has not expired\n- Token has necessary permissions";
					} else if (errorMessage.includes("timeout")) {
						errorMessage =
							"Request timed out. The JIRA server may be slow or unresponsive. Please try again.";
					}
				}

				sendEvent(controller, {
					type: "error",
					message: errorMessage,
				});
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
