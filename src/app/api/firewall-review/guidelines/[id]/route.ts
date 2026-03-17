// API Route: Get single guideline by ID
// GET /api/guidelines/[id]

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/modules/firewall-review/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;

		const { data, error } = await supabase
			.from("guidelines")
			.select("*")
			.eq("id", id)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				return NextResponse.json({ error: "Guideline not found" }, { status: 404 });
			}
			return NextResponse.json(
				{ error: "Failed to fetch guideline", details: error.message },
				{ status: 500 }
			);
		}

		return NextResponse.json({ guideline: data });
	} catch (error) {
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
