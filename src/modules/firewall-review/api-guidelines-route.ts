// API Route: Get all guidelines
// GET /api/guidelines

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/modules/firewall-review/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search');

    let query = supabase
      .from('guidelines')
      .select('*')
      .order('category', { ascending: true })
      .order('caution_id', { ascending: true });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    
    if (enabled !== null) {
      query = query.eq('enabled', enabled === 'true');
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,caution_id.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch guidelines', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ guidelines: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

