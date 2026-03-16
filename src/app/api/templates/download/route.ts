/**
 * GET /api/templates/download
 *
 * Download a blank IdaC Excel template.
 */

import { NextResponse } from "next/server";
import { generateTemplateBuffer } from "@/lib/excel/template-generator";

export async function GET() {
  try {
    const buffer = await generateTemplateBuffer();

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="IdaC-Template.xlsx"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Template generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}
