import { NextRequest, NextResponse } from 'next/server';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const ACCOUNTING_REPORT_STATUSES = ['generating', 'generated', 'sent', 'failed'] as const;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminApiContext();
    if (access.response) return access.response;

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const parsedYear = year ? Number(year) : undefined;

    if (
      parsedYear !== undefined
      && (!Number.isInteger(parsedYear)
        || parsedYear < 2020
        || parsedYear > new Date().getFullYear() + 1)
    ) {
      return NextResponse.json(
        { error: 'Nieprawidłowy rok raportu.' },
        { status: 400 }
      );
    }

    if (
      status
      && !ACCOUNTING_REPORT_STATUSES.includes(
        status as typeof ACCOUNTING_REPORT_STATUSES[number]
      )
    ) {
      return NextResponse.json(
        { error: 'Nieprawidłowy status raportu.' },
        { status: 400 }
      );
    }

    let query = access.context.adminClient
      .from('accounting_reports')
      .select('*')
      .order('report_month', { ascending: false });

    if (parsedYear !== undefined) {
      query = query.eq('report_year', parsedYear);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error('Accounting reports query error:', error);
      return NextResponse.json(
        { error: 'Nie udało się pobrać raportów księgowych.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { reports: reports || [] },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('Error fetching accounting reports:', error);
    if (isSupabaseConfigurationError(error)) {
      return adminApiUnavailableResponse();
    }
    return NextResponse.json(
      { error: 'Nie udało się pobrać raportów księgowych.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireAdminApiContext();
    if (access.response) return access.response;

    const body = await readJsonObject(request, 4 * 1024);
    const reportId = typeof body.reportId === 'string' ? body.reportId : '';

    if (!UUID_REGEX.test(reportId)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy identyfikator raportu.' },
        { status: 400 }
      );
    }

    const { data: report, error: fetchError } = await access.context.adminClient
      .from('accounting_reports')
      .select('id, file_path')
      .eq('id', reportId)
      .maybeSingle();

    if (fetchError) {
      console.error('Accounting report lookup error:', fetchError);
      return NextResponse.json(
        { error: 'Nie udało się odczytać raportu księgowego.' },
        { status: 500 }
      );
    }

    if (!report) {
      return NextResponse.json(
        { error: 'Raport nie istnieje.' },
        { status: 404 }
      );
    }

    const { data: deletedReport, error: deleteError } =
      await access.context.adminClient
        .from('accounting_reports')
        .delete()
        .eq('id', reportId)
        .select('id')
        .maybeSingle();

    if (deleteError) {
      console.error('Accounting report delete error:', deleteError);
      return NextResponse.json(
        { error: 'Nie udało się usunąć raportu księgowego.' },
        { status: 500 }
      );
    }

    if (!deletedReport) {
      return NextResponse.json(
        { error: 'Raport nie istnieje.' },
        { status: 404 }
      );
    }

    const { error: storageError } = await access.context.adminClient.storage
      .from('accounting-reports')
      .remove([report.file_path]);

    if (storageError) {
      console.error('Accounting report file cleanup error:', storageError);
    }

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error deleting accounting report:', error);
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isSupabaseConfigurationError(error)) {
      return adminApiUnavailableResponse();
    }
    return NextResponse.json(
      { error: 'Nie udało się usunąć raportu księgowego.' },
      { status: 500 }
    );
  }
}
