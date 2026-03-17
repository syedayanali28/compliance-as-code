// API endpoint to review a firewall ticket

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
	JiraOAuthAuthenticator,
	getJiraOAuthConfig,
} from "@/modules/firewall-review/lib/jira/auth-jira-oauth";
import { JiraOAuthClient } from "@/modules/firewall-review/lib/jira/client-jira-oauth";
import { Normalizer } from "@/modules/firewall-review/lib/normalizer/to-ai-format";
import { GuidelinesEngine } from "@/modules/firewall-review/lib/guidelines/rules";
import { LLMReviewer } from "@/modules/firewall-review/lib/llm/reviewer";
import { getConfig } from "@/modules/firewall-review/lib/config";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ ticketKey: string }> }
) {
	try {
		const cookieStore = await cookies();
		const userId = cookieStore.get("user_id")?.value;

		if (!userId) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { ticketKey } = await params;

		const oauthConfig = getJiraOAuthConfig();
		const authenticator = new JiraOAuthAuthenticator(oauthConfig);

		if (!authenticator.hasValidTokens(userId)) {
			return NextResponse.json(
				{ error: "Token expired. Please re-authenticate." },
				{ status: 401 }
			);
		}

		const jiraClient = new JiraOAuthClient(oauthConfig.jiraBaseUrl, authenticator);
		const ticket = await jiraClient.fetchIssue(ticketKey, userId);
		const attachments = await jiraClient.fetchAttachments(ticketKey, userId);

		const normalizer = new Normalizer();
		let normalized = await normalizer.normalize(ticket, attachments);

		const guidelines = new GuidelinesEngine();
		normalized = guidelines.applyAll(normalized);
		const riskScore = guidelines.calculateRiskScore(normalized);

		const config = getConfig();
		let llmReview = null;

		if (config.llm.apiKey) {
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
			} catch (error) {
				console.error("LLM review failed:", error);
			}
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

		return NextResponse.json({
			ticket_key: ticketKey,
			decision,
			risk_score: riskScore,
			normalized,
			reviewed_by: userId,
			reviewed_at: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Review error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Review failed" },
			{ status: 500 }
		);
	}
}
