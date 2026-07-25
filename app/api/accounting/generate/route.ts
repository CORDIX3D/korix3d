import { NextRequest, NextResponse } from 'next/server';
import {
  AccountingReportExistsError,
  generateAccountingReport,
} from '@/lib/accounting/report-generator';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const access = await requireAdminApiContext();
    if (access.response) return access.response;

    const body = await readJsonObject(request, 4 * 1024);
    const year = Number(body.year);
    const month = Number(body.month);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return NextResponse.json(
        { error: 'Podaj prawidłowy rok i miesiąc.' },
        { status: 400 }
      );
    }

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Nieprawidłowy miesiąc.' },
        { status: 400 }
      );
    }

    if (year < 2020 || year > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { error: 'Nieprawidłowy rok.' },
        { status: 400 }
      );
    }

    const result = await generateAccountingReport(
      year,
      month,
      access.context.user.id
    );

    return NextResponse.json(
      { success: true, report: result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Error generating accounting report:', error);

    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof AccountingReportExistsError) {
      return NextResponse.json(
        { error: 'Raport dla wybranego miesiąca już istnieje.' },
        { status: 409 }
      );
    }

    if (isSupabaseConfigurationError(error)) {
      return adminApiUnavailableResponse();
    }

    return NextResponse.json(
      { error: 'Nie udało się wygenerować raportu księgowego.' },
      { status: 500 }
    );
  }
}
