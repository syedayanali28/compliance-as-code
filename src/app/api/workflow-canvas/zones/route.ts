import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL_ZONES_FILE = path.join(process.cwd(), "data", "workflow-canvas-zones.local.json");

const DEFAULT_ZONES = [
  {
    zone_key: "oa-baremetal",
    label: "OA Network - Baremetal",
    parent_zone_key: null,
    intra_zone_firewall_type: "physical",
    firewall_provider: "NSX",
    is_custom: false,
    enabled: true,
  },
  {
    zone_key: "oa-private-cloud",
    label: "OA Network - Private Cloud",
    parent_zone_key: null,
    intra_zone_firewall_type: "virtual",
    firewall_provider: "PSO",
    is_custom: false,
    enabled: true,
  },
  {
    zone_key: "oa-app-dmz",
    label: "OA Network - App DMZ",
    parent_zone_key: null,
    intra_zone_firewall_type: "physical",
    firewall_provider: "NSX",
    is_custom: false,
    enabled: true,
  },
  {
    zone_key: "dmz",
    label: "DMZ",
    parent_zone_key: null,
    intra_zone_firewall_type: "physical",
    firewall_provider: "NSX",
    is_custom: false,
    enabled: true,
  },
  {
    zone_key: "aws-landing-zone",
    label: "AWS Landing Zone",
    parent_zone_key: null,
    intra_zone_firewall_type: "virtual",
    firewall_provider: "AWS",
    is_custom: false,
    enabled: true,
  },
];

async function readLocalZones() {
  try {
    const content = await readFile(LOCAL_ZONES_FILE, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeLocalZones(zones: unknown[]) {
  try {
    await mkdir(path.dirname(LOCAL_ZONES_FILE), { recursive: true });
    await writeFile(LOCAL_ZONES_FILE, JSON.stringify(zones, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write local zones:", err);
  }
}

export async function GET() {
  const localZones = await readLocalZones();

  try {
    const supabase = getSupabaseAdmin();
    
    const { data: zones, error } = await supabase
      .from("workflow_canvas_zones")
      .select("*")
      .eq("enabled", true)
      .order("zone_key");

    if (error) {
      console.error("Error fetching zones:", error);
      
      if (localZones) {
        return NextResponse.json({ zones: localZones, storage: "local-fallback" });
      }
      
      return NextResponse.json({ zones: DEFAULT_ZONES, storage: "default-fallback" });
    }

    if (zones && zones.length > 0) {
      await writeLocalZones(zones);
    }

    return NextResponse.json({ zones, storage: "supabase" });
  } catch (err) {
    console.error("Unexpected error fetching zones:", err);
    
    if (localZones) {
      return NextResponse.json({ zones: localZones, storage: "local-fallback" });
    }
    
    return NextResponse.json({ zones: DEFAULT_ZONES, storage: "default-fallback" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { zone_key, label, parent_zone_key, intra_zone_firewall_type, firewall_provider } = body;

    if (!zone_key || !label) {
      return NextResponse.json(
        { error: "zone_key and label are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    
    const { data: zone, error } = await supabase
      .from("workflow_canvas_zones")
      .insert({
        zone_key,
        label,
        parent_zone_key: parent_zone_key || null,
        intra_zone_firewall_type: intra_zone_firewall_type || "none",
        firewall_provider: firewall_provider || "none",
        is_custom: true,
        enabled: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating zone:", error);
      return NextResponse.json(
        { error: "Failed to create zone", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ zone }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error creating zone:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
