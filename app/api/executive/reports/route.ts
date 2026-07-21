import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const limitParam = searchParams.get('limit') || '12';
  const year = yearParam ? Number(yearParam) : undefined;
  const limit = Number(limitParam);

  try {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
    }

    if (year !== undefined && (!Number.isInteger(year) || year < 2020 || year > new Date().getFullYear() + 1)) {
      return NextResponse.json({ error: 'Invalid report year' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('executive_reports')
      .select('*')
      .order('report_month', { ascending: false })
      .limit(limit);

    if (year !== undefined) {
      query = query.eq('report_year', year);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch reports') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete associated records
    await supabase.from('ai_scores_history').delete().eq('report_id', id);
    await supabase.from('ai_notifications').delete().eq('report_id', id);

    // Delete report
    const { error } = await supabase
      .from('executive_reports')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete report') },
      { status: 500 }
    );
  }
}
