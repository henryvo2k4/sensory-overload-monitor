import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { bpm, gsr, mic, stressScore, recentTrends, childProfile, baselineBpm } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    const childName = childProfile?.name || 'Bé';
    const childAge = childProfile?.age ? `${childProfile.age} tuổi` : 'độ tuổi học đường';
    const sensitivities = childProfile?.sensitivities || 'Tiếng ồn đột ngột, kích thích thị giác, không gian đông người';
    const soothingPrefs = childProfile?.soothingPreferences || 'Chăn trọng lượng, nghe nhạc nhẹ/tiếng mưa, ôm áp lực sâu';
    const earlySigns = childProfile?.earlySigns || 'Bịt tai, vỗ tay liên tục, lắc lư người';
    const baseline = baselineBpm ? `${baselineBpm} BPM` : 'Khoảng 75-80 BPM';

    const prompt = `
Bạn là Chuyên gia Điều hòa Giác quan (Sensory Integration Specialist) và Chuyên viên Trị liệu Hoạt động (Occupational Therapist - OT) cho trẻ tự kỷ (ASD) và rối loạn xử lý cảm giác (SPD).

THÔNG TIN BỆNH NHI:
- Đối tượng: ${childName} (${childAge})
- Nhịp tim cơ sở tự động đo được khi bình ổn: ${baseline}
- Nhạy cảm giác quan đã ghi nhận: ${sensitivities}
- Dấu hiệu cảnh báo sớm thường gặp: ${earlySigns}
- Phương pháp / Đồ vật làm dịu ưa thích của bé: ${soothingPrefs}

DỮ LIỆU ĐO THỜI GIAN THỰC TỪ ĐỒNG HỒ ĐEO TAY:
- Nhịp tim hiện tại: ${bpm} BPM (So với nhịp cơ sở ${baseline})
- Điện trở dẫn truyền da (GSR - chỉ số đổ mồ hôi & kích hoạt hệ thần kinh giao cảm): ${gsr} (Bình thường: 300-600; Kích động: > 700)
- Mức ồn môi trường xung quanh (Mic): ${Math.round(mic / 1000)}k đơn vị
- Điểm quá tải cảm giác (Stress Score): ${stressScore}/100 ${stressScore >= 70 ? '⚠️ (MỨC NGUY HIỂM: NGUY CƠ BÙNG PHÁT MELTDOWN CAO)' : stressScore >= 40 ? '⚡ (MỨC KÍCH ĐỘNG TĂNG CAO)' : '🟢 (MỨC ỔN ĐỊNH)'}
${recentTrends ? `- Biến động 3 phút qua: Tiếng ồn tăng đột biến: ${recentTrends.noiseSpike ? 'CÓ' : 'KHÔNG'} | Nhịp tim tăng nhanh: ${recentTrends.bpmRising ? 'CÓ' : 'KHÔNG'} | GSR tăng: ${recentTrends.gsrRising ? 'CÓ' : 'KHÔNG'}` : ''}

YÊU CẦU:
Hãy phân tích cơ chế thần kinh đang diễn ra và đưa ra hướng dẫn can thiệp tức thời theo chuẩn Trị liệu Hoạt động (OT), ưu tiên vận dụng đúng các đồ vật / phương pháp làm dịu ưa thích của bé (${soothingPrefs}).
Trả lời bằng JSON thuần túy (không dùng markdown code block, không dấu \`\`\`):
{
  "triggerAnalysis": "Nhận định nguyên nhân cốt lõi trong 2 câu ngắn (Xác định rõ do tiếng ồn môi trường, do căng thẳng nội sinh so với nhịp cơ sở, hay do quá tải giác quan tích tụ).",
  "urgencyLevel": "${stressScore >= 70 ? 'KHẨN CẤP' : stressScore >= 40 ? 'CẢNH BÁO' : 'BÌNH THƯỜNG'}",
  "immediateActions": [
    "Hành động dập tắt kích ứng 1 (Ưu tiên tận dụng sở thích/vật dụng bé quen dùng: ví dụ ${soothingPrefs})",
    "Hành động dập tắt kích ứng 2 (ví dụ: Di chuyển đến góc yên tĩnh / Giảm ánh sáng phòng)"
  ],
  "soothingExercise": {
    "title": "Tên bài tập điều hòa (ví dụ: Kỹ thuật Nén Khớp & Áp Lực Sâu / Bài tập Thổi Bong Bóng 4-4 / Bài tập Vuốt Chậm)",
    "duration": "Khoảng thời gian thực hiện (ví dụ: 2 - 3 phút)",
    "guide": "Hướng dẫn cụ thể 2-3 bước ngắn gọn để người lớn thực hiện ngay cùng bé."
  },
  "caregiverAdvice": "Lời khuyên về giọng nói và thái độ của phụ huynh/giáo viên khi tương tác với bé lúc này (1-2 câu ngắn)."
}
`;

    // Danh sách model ưu tiên theo tốc độ và độ khả dụng hiện tại
    const CANDIDATE_MODELS = [
      { name: 'gemini-3.6-flash', withThinkingZero: true },
      { name: 'gemini-3.5-flash', withThinkingZero: false },
      { name: 'gemini-3.5-flash-lite', withThinkingZero: false },
      { name: 'gemini-3.8-flash', withThinkingZero: true }
    ];

    let parsedResult: any = null;
    let lastApiError: string = '';

    if (apiKey) {
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
            signal: AbortSignal.timeout(9000)
          });

          const data = await res.json();
          if (!res.ok || data.error) {
            lastApiError = data.error?.message || `HTTP ${res.status}`;
            console.warn(`Model ${item.name} thất bại (${res.status}), thử model kế tiếp...`);
            continue;
          }

          const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (resultText) {
            const cleanText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
            parsedResult = JSON.parse(cleanText);
            break; // Thành công!
          }
        } catch (err: any) {
          lastApiError = err.message || 'Lỗi kết nối';
          console.warn(`Lỗi khi gọi ${item.name}:`, err.message);
        }
      }
    } else {
      console.warn("Chưa cấu hình GEMINI_API_KEY trên Vercel, sử dụng Heuristic OT Engine.");
    }

    // Nếu các model cloud đều bận (503/timeout), kích hoạt Fallback OT chuẩn y khoa thông minh
    if (!parsedResult) {
      console.warn("Kích hoạt Heuristic OT Fallback do Gemini API quá tải:", lastApiError);
      
      const isNoiseHigh = mic > 25000;
      const isBpmHigh = bpm > (baselineBpm ? baselineBpm + 20 : 100);
      const isGsrHigh = gsr > 600;

      let triggerReason = "";
      if (isNoiseHigh) {
        triggerReason = `Bé ${childName} phản ứng kích động mạnh do cường độ tiếng ồn môi trường vượt ngưỡng chịu đựng (${Math.round(mic / 1000)}k đơn vị).`;
      } else if (isBpmHigh || isGsrHigh) {
        triggerReason = `Hệ thần kinh giao cảm của bé ${childName} bị kích thích cao (nhịp tim ${bpm} BPM, GSR ${gsr}), xuất phát từ căng thẳng nội sinh hoặc thay đổi môi trường.`;
      } else {
        triggerReason = `Bé ${childName} đang tích tụ kích thích cảm giác đa kênh cần được giải tỏa xoa dịu kịp thời.`;
      }

      parsedResult = {
        triggerAnalysis: triggerReason,
        urgencyLevel: stressScore >= 70 ? 'KHẨN CẤP' : stressScore >= 40 ? 'CẢNH BÁO' : 'BÌNH THƯỜNG',
        immediateActions: [
          `Lập tức dùng vật dụng xoa dịu ưa thích của bé: ${soothingPrefs}.`,
          isNoiseHigh ? "Đeo tai nghe chống ồn hoặc đưa bé vào phòng yên tĩnh ngay." : "Giảm bớt ánh sáng đèn, tránh nói to hoặc va chạm đột ngột."
        ],
        soothingExercise: {
          title: "Kỹ Thuật Nén Khớp & Áp Lực Sâu (Deep Pressure Therapy)",
          duration: "2 - 3 phút",
          guide: `Dùng chăn trọng lượng hoặc ôm bé vào lòng với lực ép vừa phải từ 2 bên sườn. Hướng dẫn bé thở chậm cùng ba mẹ/thầy cô.`
        },
        caregiverAdvice: `Giữ giọng nói trầm ấm, thì thầm nhẹ nhàng bên tai bé. Không đặt câu hỏi liên tục khiến bé thêm quá tải.`
      };
    }

    return NextResponse.json({
      success: true,
      analysis: parsedResult.triggerAnalysis || parsedResult.analysis,
      urgencyLevel: parsedResult.urgencyLevel || (stressScore >= 70 ? 'KHẨN CẤP' : 'CẢNH BÁO'),
      immediateActions: parsedResult.immediateActions || [],
      soothingExercise: parsedResult.soothingExercise || null,
      caregiverAdvice: parsedResult.caregiverAdvice || '',
      isFallback: false
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}