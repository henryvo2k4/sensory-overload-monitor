import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { limit = 100, childProfile, baselineBpm } = await request.json();

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
    const childAge = childProfile?.age ? `${childProfile.age} tuổi` : 'độ tuổi học đường';
    const sensitivities = childProfile?.sensitivities || 'Tiếng ồn đột ngột, kích thích thị giác';
    const soothingPrefs = childProfile?.soothingPreferences || 'Chăn trọng lượng, nghe nhạc nhẹ/tiếng mưa, ôm áp lực sâu';
    const earlySigns = childProfile?.earlySigns || 'Bịt tai, vỗ tay liên tục, lắc lư người';
    const baseline = baselineBpm ? `${baselineBpm} BPM` : 'Khoảng 75-80 BPM';

    const prompt = `
Bạn là Chuyên gia Cao cấp về Điều hòa Giác quan (Sensory Integration) và Can thiệp Trẻ tự kỷ.
Phân tích dữ liệu lịch sử đo đạc từ thiết bị Sensory Overload Monitor của ${childName} (${childAge}):
- Hồ sơ giác quan của bé:
  + Nhịp tim cơ sở tự động đo được khi bình ổn: ${baseline}
  + Các yếu tố nhạy cảm giác quan: ${sensitivities}
  + Dấu hiệu cảnh báo sớm: ${earlySigns}
  + Phương pháp/vật dụng làm dịu ưa thích: ${soothingPrefs}
- Mẫu quan sát: ${totalSamples} mốc đo gần nhất.
- Nhịp tim: Trung bình ${avgBpm} BPM (So với cơ sở ${baseline}), Cực đại ${maxBpm} BPM.
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

    // Danh sách model ưu tiên theo tốc độ và độ khả dụng
    const CANDIDATE_MODELS = [
      { name: 'gemini-3.6-flash', withThinkingZero: true },
      { name: 'gemini-3.5-flash', withThinkingZero: false },
      { name: 'gemini-3.5-flash-lite', withThinkingZero: false },
      { name: 'gemini-3.8-flash', withThinkingZero: true }
    ];

    let parsedReport: any = null;
    let lastApiError: string = '';

    for (const item of CANDIDATE_MODELS) {
      try {
        const generationConfig: any = { responseMimeType: "application/json" };
        if (item.withThinkingZero) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${item.name}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig
          }),
          signal: AbortSignal.timeout(12000)
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          lastApiError = data.error?.message || `HTTP ${res.status}`;
          console.warn(`Report model ${item.name} thất bại (${res.status}), thử model kế tiếp...`);
          continue;
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (resultText) {
          const cleanText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsedReport = JSON.parse(cleanText);
          break; // Thành công!
        }
      } catch (err: any) {
        lastApiError = err.message || 'Lỗi kết nối';
        console.warn(`Lỗi report khi gọi ${item.name}:`, err.message);
      }
    }

    // Nếu các model cloud bận, kích hoạt Fallback Báo Cáo Chuyên Môn OT Heuristic
    if (!parsedReport) {
      console.warn("Kích hoạt Heuristic OT Report Fallback:", lastApiError);

      const dominantNoise = noiseTriggerPercentage >= 50;
      parsedReport = {
        summary: `Qua quan sát ${totalSamples} mốc đo, bé ${childName} trải qua ${overloadEpisodes} giai đoạn quá tải cảm giác (chiếm ${overloadPercentage}% phiên). Nhịp tim trung bình ${avgBpm} BPM (đỉnh ${maxBpm} BPM) phản ánh sự dao động rõ nét giữa các pha bình ổn và căng thẳng thần kinh.`,
        triggerBreakdown: {
          primary: dominantNoise ? "Tiếng ồn môi trường đột ngột" : "Kích thích nội sinh & cảm giác tích tụ",
          noiseImpact: dominantNoise 
            ? `Tiếng ồn đạt đỉnh ${Math.round(maxMic / 1000)}k đơn vị, chiếm ${noiseTriggerPercentage}% nguyên nhân quá tải.` 
            : `Độ ồn môi trường tương đối ôn hòa, chỉ chiếm ${noiseTriggerPercentage}% các cơn kích thích.`,
          internalStressImpact: `Phản xạ da GSR đạt đỉnh ${maxGsr} (trung bình ${avgGsr}), cho thấy hệ thần kinh giao cảm có thời điểm hưng phấn cao.`
        },
        sensoryDietPlan: [
          {
            area: "Môi trường học tập / Sinh hoạt",
            action: dominantNoise 
              ? "Trang bị tấm xốp cách âm góc phòng, hạn chế tối đa tiếng va đập kim loại hoặc thiết bị công suất lớn." 
              : "Điều chỉnh ánh sáng dịu nhẹ, giữ nhiệt độ phòng thoáng mát dễ chịu."
          },
          {
            area: "Trang bị hỗ trợ giác quan (Sensory Tools)",
            action: `Ưu tiên sử dụng đồ vật bé ưa thích: ${soothingPrefs}, kết hợp tai nghe giảm ồn khi ra ngoài.`
          },
          {
            area: "Lịch trình xả nén (Sensory Breaks)",
            action: "Cứ sau mỗi 45 phút học tập hoặc vận động, bố trí 5-10 phút ngồi góc yên tĩnh để tái lập cân bằng."
          }
        ],
        recommendations: [
          `Khi nhận thấy dấu hiệu sớm (${earlySigns}): Lập tức chủ động tiếp cận, ôm áp lực sâu hoặc cho bé dùng ${soothingPrefs}.`,
          "Ghi nhận nhật ký cảm xúc thường xuyên để phát hiện quy luật thời gian bé dễ mệt mỏi trong ngày."
        ]
      };
    }

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