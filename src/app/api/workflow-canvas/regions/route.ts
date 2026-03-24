import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL_REGIONS_FILE = path.join(process.cwd(), "data", "workflow-canvas-regions.local.json");

const DEFAULT_REGIONS = [
  {
    region_key: "ifc",
    label: "IFC",
    is_custom: false,
    enabled: true,
  },
  {
    region_key: "kcc",
    label: "KCC",
    is_custom: false,
    enabled: true,
  },
];

async function readLocalRegions() {
  try {
    const content = await readFile(LOCAL_REGIONS_FILE, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeLocalRegions(regions: unknown[]) {
  try {
    await mkdir(path.dirname(LOCAL_REGIONS_FILE), { recursive: true });
    await writeFile(LOCAL_REGIONS_FILE, JSON.stringify(regions, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write local regions:", err);
  }
}

export async function GET() {
  const localRegions = await readLocalRegions();

  try {
    const supabase = getSupabaseAdmin();
    
    const { data: regions, error } = await supabase
      .from("workflow_canvas_regions")
      .select("*")
      .eq("enabled", true)
      .order("region_key");

    if (error) {
      console.error("Error fetching regions:", error);
      
      if (localRegions) {
        return NextResponse.json({ regions: localRegions, storage: "local-fallback" });
      }
      
      return NextResponse.json({ regions: DEFAULT_REGIONS, storage: "default-fallback" });
    }

    if (regions && regions.length > 0) {
      await writeLocalRegions(regions);
    }

    return NextResponse.json({ regions, storage: "supabase" });
  } catch (err) {
    console.error("Unexpected error fetching regions:", err);
    
    if (localRegions) {
      return NextResponse.json({ regions: localRegions, storage: "local-fallback" });
    }
    
    return NextResponse.json({ regions: DEFAULT_REGIONS, storage: "default-fallback" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { region_key, label } = body;

    if (!region_key || !label) {
      return NextResponse.json(
        { error: "region_key and label are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    
    const { data: region, error } = await supabase
      .from("workflow_canvas_regions")
      .insert({
        region_key,
        label,
        is_custom: true,
        enabled: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating region:", error);
      return NextResponse.json(
        { error: "Failed to create region", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ region }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error creating region:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
