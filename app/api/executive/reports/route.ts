import { NextRequest, NextResponse } from 'next/server';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminApiContext();
    if (access.response) return access.response;

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const limitParam = searchParams.get('limit') || '12';
    const year = yearParam ? Number(yearParam) : undefined;
    const limit = Number(limitParam);

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: 'Nieprawidłowy limit raportów.' },
        { status: 400 }
      );
    }

    if (
      year !== undefined
      && (!Number.isInteger(year)
        || year < 2020
        || year > new Date().getFullYear() + 1)
    ) {
      return NextResponse.json(
        { error: 'Nieprawidłowy rok raportu.' },
        { status: 400 }
      );
    }

    let query = access.context.adminClient
      .from('executive_reports')
      .select('*')
      .order('report_month', { ascending: false })
      .limit(limit);

    if (year !== undefined) {
      query = query.eq('report_year', year);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Executive reports query error:', error);
      return NextResponse.json(
        { error: 'Nie udało się pobrać raportów zarządczych.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: data || [] },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error: unknown) {
    console.error('Executive reports request error:', error);
    if (isSupabaseConfigurationError(error)) {
      return adminApiUnavailableResponse();
    }
    return NextResponse.json(
      { error: 'Nie udało się pobrać raportów zarządczych.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireAdminApiContext();
    if (access.response) return access.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy identyfikator raportu.' },
        { status: 400 }
      );
    }

    const { data: report, error: lookupError } = await access.context.adminClient
      .from('executive_reports')
      .select('id, report_month')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      console.error('Executive report delete lookup error:', lookupError);
      return NextResponse.json(
        { error: 'Nie udało się odczytać raportu zarządczego.' },
        { status: 500 }
      );
    }

    if (!report) {
      return NextResponse.json(
        { error: 'Raport nie istnieje.' },
        { status: 404 }
      );
    }

    const { error: notificationsError } = await access.context.adminClient
      .from('ai_notifications')
      .delete()
      .eq('report_id', id);

    if (notificationsError) {
      console.error('Executive notification delete error:', notificationsError);
      return NextResponse.json(
        { error: 'Nie udało się usunąć danych powiązanych z raportem.' },
        { status: 500 }
      );
    }

    const { error: trendsError } = await access.context.adminClient
      .from('monthly_trends')
      .delete()
      .eq('period_start', report.report_month);

    if (trendsError) {
      console.error('Executive trend delete error:', trendsError);
      return NextResponse.json(
        { error: 'Nie udało się usunąć danych powiązanych z raportem.' },
        { status: 500 }
      );
    }

    const { data: deletedReport, error: deleteError } =
      await access.context.adminClient
        .from('executive_reports')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

    if (deleteError) {
      console.error('Executive report delete error:', deleteError);
      return NextResponse.json(
        { error: 'Nie udało się usunąć raportu zarządczego.' },
        { status: 500 }
      );
    }

    if (!deletedReport) {
      return NextResponse.json(
        { error: 'Raport nie istnieje.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Executive report delete request error:', error);
    if (isSupabaseConfigurationError(error)) {
      return adminApiUnavailableResponse();
    }
    return NextResponse.json(
      { error: 'Nie udało się usunąć raportu zarządczego.' },
      { status: 500 }
    );
  }
}
