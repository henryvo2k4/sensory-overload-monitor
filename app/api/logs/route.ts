import { NextResponse } from 'next/server';
import { supabase, getSafeSupabaseClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Lần 1: Thử với client mặc định
    let { data: logs, error } = await supabase
      .from('sensory_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Lần 2: Nếu có lỗi hoặc không có dữ liệu, thử ngay với Safe Fallback Client
    if (error || !logs || logs.length === 0) {
      console.warn('GET /api/logs: Default client error/empty, trying safe client...', error?.message);
      const safeClient = getSafeSupabaseClient();
      const retry = await safeClient
        .from('sensory_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (retry.data && retry.data.length > 0) {
        logs = retry.data;
        error = null;
      }
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: logs ? logs.length : 0,
      data: logs || []
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
