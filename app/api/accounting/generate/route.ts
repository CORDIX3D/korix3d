export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateAccountingReport } from '@/lib/accounting/report-generator';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { year, month } = body;

    if (!year || !month) {
      return NextResponse.json(
        { error: 'Brak roku lub miesiąca' },
        { status: 400 }
      );
    }

    // Validate month
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Nieprawidłowy miesiąc' },
        { status: 400 }
      );
    }

    // Validate year
    if (year < 2020 || year > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { error: 'Nieprawidłowy rok' },
        { status: 400 }
      );
    }

    // Generate report
    const result = await generateAccountingReport(year, month, user.id);

    return NextResponse.json({
      success: true,
      report: result
    });

  } catch (error: any) {
    console.error('Error generating report:', error);

    if (error.message?.includes('już istnieje')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Błąd generowania raportu' },
      { status: 500 }
    );
  }
}
