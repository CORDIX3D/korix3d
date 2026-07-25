import { NextResponse } from 'next/server';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireAdminApiContext();
    if (access.response) return access.response;

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy identyfikator raportu.' },
        { status: 400 }
      );
    }

    const { data: report, error } = await access.context.adminClient
      .from('executive_reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Executive report detail query error:', error);
      return NextResponse.json(
        { error: 'Nie udało się pobrać raportu zarządczego.' },
        { status: 500 }
      );
    }

    if (!report) {
      return NextResponse.json(
        { error: 'Raport nie istnieje.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data: report },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error: unknown) {
    console.error('Executive report detail request error:', error);
    if (isSupabaseConfigurationError(error)) {
      return adminApiUnavailableResponse();
    }
    return NextResponse.json(
      { error: 'Nie udało się pobrać raportu zarządczego.' },
      { status: 500 }
    );
  }
}
