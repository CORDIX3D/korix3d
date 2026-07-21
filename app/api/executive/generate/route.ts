import { NextResponse } from 'next/server';
import { generateExecutiveReport } from '@/lib/executive/report-generator';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const year = Number(body.year);
    const month = Number(body.month);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return NextResponse.json(
        { error: 'Year and month required' },
        { status: 400 }
      );
    }

    if (year < 2020 || year > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { error: 'Invalid report year' },
        { status: 400 }
      );
    }

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid report month' },
        { status: 400 }
      );
    }

    const result = await generateExecutiveReport(year, month);

    return NextResponse.json({
      success: true,
      report: result
    });
  } catch (error: unknown) {
    console.error('Executive report generation error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to generate report') },
      { status: 500 }
    );
  }
}
