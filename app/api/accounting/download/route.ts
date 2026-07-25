import { NextRequest, NextResponse } from 'next/server';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REPORT_DOWNLOAD_BYTES = 25 * 1024 * 1024;

function sanitizeDownloadFileName(fileName: unknown) {
  if (typeof fileName !== 'string') {
    return 'raport-ksiegowy.xlsx';
  }

  const safeBase = fileName
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 115);
  const normalized = safeBase || 'raport-ksiegowy';

  return normalized.toLowerCase().endsWith('.xlsx')
    ? normalized
    : `${normalized}.xlsx`;
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminApiContext();
    if (access.response) return access.response;

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');

    if (!reportId || !UUID_REGEX.test(reportId)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy identyfikator raportu.' },
        { status: 400 }
      );
    }

    const { data: report, error: fetchError } = await access.context.adminClient
      .from('accounting_reports')
      .select('file_name, file_path, file_size')
      .eq('id', reportId)
      .maybeSingle();

    if (fetchError) {
      console.error('Accounting download lookup error:', fetchError);
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

    if (report.file_size && report.file_size > MAX_REPORT_DOWNLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Plik raportu jest zbyt duży do pobrania.' },
        { status: 413 }
      );
    }

    const { data: fileData, error: downloadError } =
      await access.context.adminClient.storage
        .from('accounting-reports')
        .download(report.file_path);

    if (downloadError || !fileData) {
      console.error('Accounting report storage download error:', downloadError);
      return NextResponse.json(
        { error: 'Nie udało się pobrać pliku raportu.' },
        { status: 500 }
      );
    }

    if (fileData.size > MAX_REPORT_DOWNLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Plik raportu jest zbyt duży do pobrania.' },
        { status: 413 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          `attachment; filename="${sanitizeDownloadFileName(report.file_name)}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error downloading accounting report:', error);
    if (isSupabaseConfigurationError(error)) {
      return adminApiUnavailableResponse();
    }
    return NextResponse.json(
      { error: 'Nie udało się pobrać raportu księgowego.' },
      { status: 500 }
    );
  }
}
