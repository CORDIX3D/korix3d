import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeDownloadFileName(fileName: unknown) {
  if (typeof fileName !== 'string') {
    return 'raport-ksiegowy.xlsx';
  }

  return fileName.replace(/["\\/\r\n]/g, '').trim() || 'raport-ksiegowy.xlsx';
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or employee
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');

    if (!reportId || !UUID_REGEX.test(reportId)) {
      return NextResponse.json({ error: 'Brak ID raportu' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get report info
    const { data: report, error: fetchError } = await supabaseAdmin
      .from('accounting_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Raport nie istnieje' }, { status: 404 });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('accounting-reports')
      .download(report.file_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Błąd pobierania pliku' }, { status: 500 });
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${sanitizeDownloadFileName(report.file_name)}"`,
        'Content-Length': arrayBuffer.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('Error downloading report:', error);
    return NextResponse.json(
      { error: 'Błąd pobierania raportu' },
      { status: 500 }
    );
  }
}
