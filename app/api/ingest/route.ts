import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, bpm, gsr, mic, stressScore } = body;

    let status = 'BÌNH THƯỜNG';
    if (stressScore >= 70) status = 'QUÁ TẢI CẢM GIÁC (OVERLOAD)';
    else if (stressScore >= 40) status = 'KÍCH THÍCH CAO';

    const { error } = await supabase.from('sensory_logs').insert([
      {
        device_id: deviceId || 'SOM_Watch_01',
        bpm: bpm || 0,
        gsr: gsr || 0,
        mic: mic || 0,
        stress_score: stressScore || 0,
        overload_status: status,
      },
    ]);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Dữ liệu đã được lưu thành công' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}