import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { bpm, gsr, mic, stressScore, recentTrends, childProfile, baselineBpm } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: "Chưa cấu hình GEMINI_API_KEY trong file .env.local" 
      }, { status: 400 });
    }

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

    // Sử dụng model gemini-3.5-flash-lite phản hồi cực nhanh, ổn định
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
    const parsed = JSON.parse(cleanText);
    
    return NextResponse.json({
      success: true,
      analysis: parsed.triggerAnalysis || parsed.analysis,
      urgencyLevel: parsed.urgencyLevel || (stressScore >= 70 ? 'KHẨN CẤP' : 'CẢNH BÁO'),
      immediateActions: parsed.immediateActions || [],
      soothingExercise: parsed.soothingExercise || null,
      caregiverAdvice: parsed.caregiverAdvice || '',
      isFallback: false
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}