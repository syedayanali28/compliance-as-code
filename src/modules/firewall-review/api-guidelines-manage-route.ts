// API Route: Create, Update, Delete guidelines
// POST /api/guidelines/manage - Create
// PUT /api/guidelines/manage - Update
// DELETE /api/guidelines/manage - Delete

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/modules/firewall-review/lib/supabase/client';

export const dynamic = 'force-dynamic';

// Create new guideline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('guidelines')
      .insert({
        caution_id: body.caution_id,
        title: body.title,
        description: body.description,
        category: body.category,
        severity: body.severity,
        required_action: body.required_action,
        context: body.context || null,
        example_compliant: body.example_compliant || null,
        example_violation: body.example_violation || null,
        check_logic: body.check_logic || null,
        enabled: body.enabled !== undefined ? body.enabled : true,
        created_by: body.created_by || 'admin',
        updated_by: body.updated_by || 'admin',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create guideline', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ guideline: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Update existing guideline
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Guideline ID is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('guidelines')
      .update({
        ...updates,
        updated_by: updates.updated_by || 'admin',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update guideline', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ guideline: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Delete guideline
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Guideline ID is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('guidelines')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete guideline', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

