import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { limit = 100, childProfile } = await request.json();

    const { data: logs, error } = await supabase
      .from('sensory_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !logs || logs.length === 0) {
      return NextResponse.json({ success: false, message: 'Chưa có đủ dữ liệu lịch sử.' }, { status: 400 });
    }

    const totalSamples = logs.length;
    let sumBpm = 0, validBpmCount = 0, maxBpm = 0;
    let sumGsr = 0, maxGsr = 0;
    let maxMic = 0;
    let overloadEpisodes = 0;
    let noiseTriggeredCount = 0;
    let internalTriggeredCount = 0;

    logs.forEach((row) => {
      if (row.bpm && row.bpm > 0) {
        sumBpm += row.bpm;
        validBpmCount++;
        if (row.bpm > maxBpm) maxBpm = row.bpm;
      }
      if (row.gsr) {
        sumGsr += row.gsr;
        if (row.gsr > maxGsr) maxGsr = row.gsr;
      }
      if (row.mic && row.mic > maxMic) maxMic = row.mic;
      
      if (row.stress_score >= 70) {
        overloadEpisodes++;
        // Phân loại nguyên nhân sơ bộ
        if (row.mic >= 30000) {
          noiseTriggeredCount++;
        } else {
          internalTriggeredCount++;
        }
      }
    });

    const avgBpm = validBpmCount > 0 ? Math.round(sumBpm / validBpmCount) : 0;
    const avgGsr = Math.round(sumGsr / totalSamples);
    const overloadPercentage = Math.round((overloadEpisodes / totalSamples) * 100);
    const noiseTriggerPercentage = overloadEpisodes > 0 ? Math.round((noiseTriggeredCount / overloadEpisodes) * 100) : 0;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: "Chưa cấu hình GEMINI_API_KEY trong file .env.local" 
      }, { status: 400 });
    }

    const childName = childProfile?.name || 'Bé';

    const prompt = `
Bạn là Chuyên gia Cao cấp về Điều hòa Giác quan (Sensory Integration) và Can thiệp Trẻ tự kỷ.
Phân tích dữ liệu lịch sử đo đạc từ thiết bị Sensory Overload Monitor của ${childName}:
- Mẫu quan sát: ${totalSamples} mốc đo gần nhất.
- Nhịp tim: Trung bình ${avgBpm} BPM, Cực đại ${maxBpm} BPM.
- Phản xạ da (GSR): Trung bình ${avgGsr}, Cực đại ${maxGsr}.
- Đỉnh tiếng ồn (Mic): ${Math.round(maxMic / 1000)}k đơn vị.
- Tỷ lệ thời gian ở ngưỡng Quá tải (Stress >= 70%): ${overloadPercentage}%.
- Trong các cơn quá tải: ${noiseTriggerPercentage}% có mức ồn cao, ${100 - noiseTriggerPercentage}% phát sinh khi môi trường yên tĩnh (do lo âu/nội sinh/xúc giác).

YÊU CẦU:
Tạo bản Báo cáo Giác quan Toàn diện (Comprehensive Sensory Report) theo định dạng JSON thuần túy (không dùng markdown code block, không dấu \`\`\`):
{
  "summary": "Tóm tắt ngắn gọn tình trạng điều hòa giác quan tổng thể của phiên này (2-3 câu).",
  "triggerBreakdown": {
    "primary": "Xác định rõ tác nhân chủ đạo (Tiếng ồn môi trường, Kích thích nội sinh, hay Quá tải hỗn hợp)",
    "noiseImpact": "Nhận định cụ thể về mức độ ảnh hưởng của tiếng ồn lên trẻ",
    "internalStressImpact": "Nhận định về mức độ căng thẳng nội sinh (dựa trên GSR và nhịp tim)"
  },
  "sensoryDietPlan": [
    {
      "area": "Môi trường học tập/phòng ở",
      "action": "Giải pháp cải thiện không gian giảm kích thích"
    },
    {
      "area": "Trang bị hỗ trợ giác quan",
      "action": "Dụng cụ hỗ trợ khuyên dùng (ví dụ: Tai nghe chống ồn, chăn trọng lượng, đồ chơi xúc giác)"
    },
    {
      "area": "Lịch trình xả nén thần kinh (Sensory Breaks)",
      "action": "Khuyến nghị thời điểm và cách cho trẻ nghỉ ngơi trong ngày"
    }
  ],
  "recommendations": [
    "Khuyến nghị can thiệp tức thì khi trẻ bắt đầu chớm kích động",
    "Chiến lược đồng hành dài hạn cho gia đình và giáo viên"
  ]
}
`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      console.error("Lỗi từ Gemini API:", data.error);
      return NextResponse.json({ 
        success: false, 
        error: data.error?.message || "Lỗi khi gọi Gemini API" 
      }, { status: res.status || 500 });
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      return NextResponse.json({ success: false, error: "AI không trả về nội dung" }, { status: 500 });
    }

    let cleanText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedReport = JSON.parse(cleanText);
    
    return NextResponse.json({
      success: true,
      metrics: { 
        avgBpm, 
        maxBpm, 
        avgGsr, 
        maxGsr, 
        maxMic: Math.round(maxMic / 1000), 
        overloadPercentage,
        noiseTriggerPercentage
      },
      ...parsedReport
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}