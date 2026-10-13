# 🧸 Sensory Watch - Hệ Thống Giám Sát & Điều Hòa Quá Tải Cảm Giác Cho Trẻ

> **Sensory Overload Monitor & Real-Time AI OT Assistant**  
> Giải pháp công nghệ hỗ trợ trẻ tự kỷ (**ASD**) và rối loạn xử lý cảm giác (**SPD**) phát hiện sớm và can thiệp kịp thời các cơn quá tải cảm giác (*Sensory Meltdown*).

---

## 🌟 Tổng Quan Dự Án

Trẻ em mắc chứng tự kỷ hoặc rối loạn xử lý cảm giác thường gặp khó khăn trong việc tự nhận biết và diễn đạt tình trạng kích động thần kinh do tiếng ồn, ánh sáng hoặc căng thẳng nội sinh. Cơn bùng phát (*Meltdown*) thường diễn ra khi mức kích ứng tích tụ vượt quá ngưỡng chịu đựng.

**Sensory Watch** là hệ thống kết hợp giữa thiết bị đeo tay thông minh (IoT Smartwatch) và bảng điều khiển trực quan (Next.js Web Dashboard), được tích hợp trợ lý AI chuyên gia Trị liệu Hoạt động (**Occupational Therapist - OT**) vận hành bởi **Google Gemini**:
- ⌚ **Đo lường thời gian thực:** Nhịp tim (BPM), Điện trở dẫn truyền da (GSR - đo kích hoạt thần kinh giao cảm), Mức ồn môi trường (Mic).
- 🧠 **Trợ lý AI OT:** Tự động chẩn đoán căn nguyên quá tải (do tiếng ồn môi trường hay lo âu nội sinh) và đưa ra bài tập xoa dịu tức thời.
- 🩺 **Nhịp tim cơ sở tự động (Auto Baseline BPM):** Hệ thống tự học và tính toán nhịp tim nghỉ ngơi của từng bé từ lịch sử các mốc bình ổn, không cần phụ huynh phải nhập tay.
- 🧸 **Hồ sơ giác quan cá nhân hóa:** Tự động ghi nhớ sở thích làm dịu (chăn trọng lượng, nghe tiếng mưa...), dấu hiệu cảnh báo sớm, cùng số điện thoại người giám hộ khẩn cấp.
- 📅 **Lịch sử & Nhật ký theo ngày:** Thống kê các cơn quá tải theo từng ngày và tạo báo cáo *Sensory Diet Plan* dài hạn.

---

## 🏗️ Kiến Trúc Hệ Thống

```
+-----------------------------------+
|  Thiết bị đeo tay (ESP32 Watch)   |
|  - Cảm biến nhịp tim (MAX30102)   |
|  - Cảm biến GSR (Điện trở da)     |
|  - Microphone đo độ ồn            |
+-----------------+-----------------+
                  |  HTTP POST (/api/ingest)
                  v
+-----------------+-----------------+
|   Next.js API & Supabase DB       |
|   - Bảng: public.sensory_logs     |
|   - Supabase Realtime Channels    |
+-----------------+-----------------+
                  |  Postgres Changes (WebSocket)
                  v
+-----------------+-----------------+       +-------------------------------+
|     Sensory Watch Dashboard      | ----> |      Google Gemini AI         |
|  (Giao diện dịu êm cho Phụ huynh) | <---- | (Sensory Integration Expert)  |
+-----------------------------------+       +-------------------------------+
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu môi trường
- **Node.js**: Phiên bản 18 trở lên (khuyên dùng Node 20+)
- **NPM** hoặc **Yarn / PNPM / Bun**
- Tài khoản [Supabase](https://supabase.com) (miễn phí)
- Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### 2. Cài đặt mã nguồn
```bash
git clone https://github.com/your-username/sensory.git
cd sensory
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env.local` tại thư mục gốc của dự án:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Gemini AI API Key
GEMINI_API_KEY=your-gemini-api-key
```

*(Bạn có thể tham khảo mẫu trong file `.env.example`)*

### 4. Thiết lập Database trên Supabase
1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard) và chọn project của bạn.
2. Vào mục **SQL Editor**, mở và chạy toàn bộ nội dung file [`supabase_schema.sql`](./supabase_schema.sql).
3. Script sẽ tự động:
   - Tạo bảng `sensory_logs`.
   - Thiết lập các chỉ mục tối ưu truy vấn thời gian.
   - Mở chính sách Row Level Security (RLS).
   - Kích hoạt tính năng **Realtime** cho bảng dữ liệu.

### 5. Khởi chạy ứng dụng
```bash
npm run dev
```
Mở trình duyệt tại [http://localhost:3000](http://localhost:3000) để trải nghiệm.

---

## 📡 Tài Liệu API Dành Cho Thiết Bị Đeo (IoT Hardware)

Đồng hồ thông minh hoặc vi điều khiển (ESP32/ESP8266/Arduino) gửi dữ liệu đo định kỳ (ví dụ mỗi 3 - 5 giây) về máy chủ thông qua HTTP POST:

### Endpoint: `POST /api/ingest`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "deviceId": "SOM_Watch_01",
  "bpm": 86,
  "gsr": 420,
  "mic": 15200,
  "stressScore": 32
}
```

#### Giải thích các trường:
| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `deviceId` | string | Mã định danh của thiết bị đeo (vd: `"SOM_Watch_01"`). |
| `bpm` | number | Nhịp tim tính theo số lần đập/phút. Nếu bé tháo đồng hồ, gửi `0`. |
| `gsr` | number | Giá trị điện trở da ADC (300-600: bình thường; >700: kích động/mồ hôi). |
| `mic` | number | Mức độ âm thanh môi trường đo từ microphone. |
| `stressScore`| number | Điểm căng thẳng tổng hợp (0 - 100). $\ge 70$ là ngưỡng báo động quá tải. |

#### Đoạn mã mẫu gửi dữ liệu từ ESP32 (Arduino C++):
```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* serverUrl = "https://your-domain.vercel.app/api/ingest";

void sendSensoryData(int bpm, int gsr, int mic, int stressScore) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"deviceId\":\"SOM_Watch_01\",\"bpm\":" + String(bpm) + 
                         ",\"gsr\":" + String(gsr) + 
                         ",\"mic\":" + String(mic) + 
                         ",\"stressScore\":" + String(stressScore) + "}";

    int httpResponseCode = http.POST(jsonPayload);
    http.end();
  }
}
```

---

## 📁 Cấu Trúc Thư Mục

```
sensory/
├── app/
│   ├── api/
│   │   ├── ai-analyze/route.ts  # Trợ lý Gemini phân tích quá tải realtime
│   │   ├── ai-report/route.ts   # Tổng hợp lịch sử & tạo Sensory Diet Plan
│   │   └── ingest/route.ts      # API nhận dữ liệu từ đồng hồ đeo tay
│   ├── globals.css              # Giao diện dịu êm Tailwind CSS v4
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Dashboard điều khiển chính (Live / History / Report)
├── components/
│   └── StressChart.tsx          # Biểu đồ nhịp tim & độ căng thẳng thời gian thực
├── lib/
│   └── supabase.ts              # Client kết nối Supabase Database & Realtime
├── public/                      # Static assets và icon
├── .env.example                 # Mẫu khai báo biến môi trường
├── supabase_schema.sql          # File script khởi tạo cơ sở dữ liệu Supabase
└── README.md                    # Tài liệu hướng dẫn dự án
```

---

## 💡 Đóng Góp & Phát Triển
Mọi đóng góp, báo cáo lỗi hoặc đề xuất tính năng mới nhằm hỗ trợ trẻ tự kỷ và gia đình tốt hơn đều được nhiệt liệt hoan nghênh. Vui lòng tạo Issue hoặc mở Pull Request trên repository.
