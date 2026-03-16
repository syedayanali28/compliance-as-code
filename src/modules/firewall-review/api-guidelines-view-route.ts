// Guidelines viewer route for public access
// View all active guidelines without admin capabilities
// GET /api/guidelines/view

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/modules/firewall-review/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const severity = searchParams.get('severity');
    const format = searchParams.get('format'); // 'json' or 'catalog' (for code import)

    let query = supabase
      .from('guidelines')
      .select('*')
      .eq('enabled', true)
      .order('category', { ascending: true })
      .order('caution_id', { ascending: true });

    // Apply filters
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch guidelines', details: error.message },
        { status: 500 }
      );
    }

    // Return as code-compatible catalog format
    if (format === 'catalog') {
      const catalog: Record<string, any> = {};
      
      data?.forEach(guideline => {
        catalog[guideline.caution_id] = {
          id: guideline.caution_id,
          title: guideline.title,
          description: guideline.description,
          severity: guideline.severity,
          category: guideline.category,
          required_action: guideline.required_action,
          context: guideline.context,
          example_compliant: guideline.example_compliant,
          example_violation: guideline.example_violation,
          // In production, this would reference the actual check function
          // For now, we return the logic description
          check_logic: guideline.check_logic,
        };
      });

      return NextResponse.json({ catalog });
    }

    // Default JSON format
    return NextResponse.json({ 
      guidelines: data,
      count: data?.length || 0,
      categories: [...new Set(data?.map(g => g.category))],
      severities: {
        HIGH: data?.filter(g => g.severity === 'HIGH').length || 0,
        MEDIUM: data?.filter(g => g.severity === 'MEDIUM').length || 0,
        LOW: data?.filter(g => g.severity === 'LOW').length || 0,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

