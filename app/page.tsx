'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { 
  Activity, Heart, Volume2, ShieldAlert, AlertTriangle, 
  Sparkles, History, LayoutDashboard, RefreshCw, X, 
  FileText, BarChart3, CheckCircle2, User, Zap, Smile, HeartPulse,
  Sun, Calendar, CalendarDays, ListFilter, Filter, Clock,
  ChevronRight, CalendarRange, Eye, Phone, Info
} from 'lucide-react';

const StressChart = dynamic(() => import('@/components/StressChart'), {
  ssr: false,
  loading: () => <div className="text-slate-400 text-xs py-10 text-center font-medium">Đang nạp biểu đồ dịu êm...</div>,
});

interface SensoryLog {
  id: number;
  created_at: string;
  device_id: string;
  bpm: number;
  gsr: number;
  mic: number;
  stress_score: number;
  overload_status: string;
}

interface SoothingExercise {
  title: string;
  duration?: string;
  guide: string;
}

interface AiReportState {
  analysis: string;
  urgencyLevel?: string;
  immediateActions?: string[];
  soothingExercise?: SoothingExercise | null;
  caregiverAdvice?: string;
}

interface ChildProfile {
  name: string;
  age: number;
  sensitivities: string;
  soothingPreferences: string;
  earlySigns: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

const DEFAULT_PROFILE: ChildProfile = {
  name: 'Bé Minh Khang',
  age: 6,
  sensitivities: 'Tiếng ồn đột ngột, đèn neon chói, va chạm bất ngờ',
  soothingPreferences: 'Chăn trọng lượng, nghe nhạc nhẹ/tiếng mưa, ôm áp lực sâu',
  earlySigns: 'Bịt tai, vỗ tay liên tục (stimming), lắc lư người',
  emergencyContactName: 'Mẹ Lan',
  emergencyContactPhone: '0901234567',
};

interface DaySummary {
  dateStr: string;
  displayDate: string;
  totalLogs: number;
  overloadCount: number;
  avgBpm: number;
  maxBpm: number;
  maxMic: number;
  status: 'peaceful' | 'warning' | 'alert';
  logs: SensoryLog[];
}

export default function Dashboard() {
  const [logs, setLogs] = useState<SensoryLog[]>([]);
  const [historyLogs, setHistoryLogs] = useState<SensoryLog[]>([]);
  const [current, setCurrent] = useState<SensoryLog | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'report'>('live');

  // Sub-tab trong Nhật Ký: 'list' (Bảng chi tiết) | 'calendar' (Lịch tổng quan ngày)
  const [historySubTab, setHistorySubTab] = useState<'list' | 'calendar'>('list');

  // Bộ lọc nhật ký
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDayDetail, setSelectedDayDetail] = useState<DaySummary | null>(null);

  // Hồ sơ bệnh nhi/trẻ
  const [childProfile, setChildProfile] = useState<ChildProfile>(DEFAULT_PROFILE);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Tự động tải hồ sơ bé từ localStorage khi mở trang
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sensory_child_profile');
      if (saved) {
        setChildProfile((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {
      console.error("Không thể đọc localStorage hồ sơ bé:", e);
    }
  }, []);

  // Trạng thái Báo động khẩn cấp
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [hasDismissedCurrentAlert, setHasDismissedCurrentAlert] = useState(false);

  // Trạng thái AI Realtime
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AiReportState | null>(null);
  const lastAiCallTime = useRef<number>(0);

  // Trạng thái AI Report Lịch sử
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Tự động tính nhịp tim cơ sở từ các mốc dữ liệu khi bé bình ổn (không cần nhập thủ công)
  const baselineStats = useMemo(() => {
    const source = historyLogs.length > 0 ? historyLogs : logs;
    const calmLogs = source.filter(
      (l) => l.bpm && l.bpm > 0 && l.stress_score < 40 && l.overload_status !== 'CHƯA ĐEO ĐỒNG HỒ'
    );
    if (calmLogs.length === 0) {
      return { bpm: 75, count: 0, isCalculated: false };
    }
    const sum = calmLogs.reduce((acc, cur) => acc + cur.bpm, 0);
    return {
      bpm: Math.round(sum / calmLogs.length),
      count: calmLogs.length,
      isCalculated: true,
    };
  }, [historyLogs, logs]);

  // Hàm gọi AI Chẩn đoán
  const executeAiAnalysis = async (targetLog?: SensoryLog) => {
    const dataToAnalyze = targetLog || current;
    if (!dataToAnalyze) return;

    setAiLoading(true);
    try {
      const recentLogs = logs.slice(-5);
      const avgNoise = recentLogs.length > 0 ? recentLogs.reduce((acc, l) => acc + l.mic, 0) / recentLogs.length : dataToAnalyze.mic;
      const avgBpm = recentLogs.length > 0 ? recentLogs.reduce((acc, l) => acc + (l.bpm || 0), 0) / recentLogs.length : dataToAnalyze.bpm;
      
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bpm: dataToAnalyze.bpm,
          gsr: dataToAnalyze.gsr,
          mic: dataToAnalyze.mic,
          stressScore: dataToAnalyze.stress_score,
          recentTrends: {
            noiseSpike: dataToAnalyze.mic > avgNoise * 1.3,
            bpmRising: dataToAnalyze.bpm > avgBpm * 1.15,
            gsrRising: dataToAnalyze.gsr > 500,
          },
          childProfile,
          baselineBpm: baselineStats.bpm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAiReport({
          analysis: data.analysis,
          urgencyLevel: data.urgencyLevel,
          immediateActions: data.immediateActions,
          soothingExercise: data.soothingExercise,
          caregiverAdvice: data.caregiverAdvice,
        });
        lastAiCallTime.current = Date.now();
      } else {
        console.error("Lỗi AI:", data.error);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data } = await supabase
        .from('sensory_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const sorted = data.reverse();
        setLogs(sorted);
        setCurrent(sorted[sorted.length - 1] || null);
      }
    };

    fetchInitialData();

    const channel = supabase
      .channel('realtime_sensory_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensory_logs' },
        (payload) => {
          const newRow = payload.new as SensoryLog;
          setCurrent(newRow);
          setLogs((prev) => [...prev.slice(-19), newRow]);

          // Tự động kích hoạt khi có quá tải (STRESS >= 70) VÀ BÉ ĐANG ĐEO ĐỒNG HỒ
          if (newRow.stress_score >= 70 && newRow.overload_status !== 'CHƯA ĐEO ĐỒNG HỒ') {
            setShowAlertModal(true);
            setHasDismissedCurrentAlert(false);

            if (Date.now() - lastAiCallTime.current > 90000) {
              executeAiAnalysis(newRow);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childProfile]);

  const fetchFullHistory = async () => {
    const { data } = await supabase
      .from('sensory_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (data) setHistoryLogs(data);
  };

  useEffect(() => {
    if (activeTab === 'history') fetchFullHistory();
  }, [activeTab]);

  const generateAiReport = async () => {
    setReportLoading(true);
    try {
      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100, childProfile, baselineBpm: baselineStats.bpm }),
      });
      const data = await res.json();
      if (data.success) {
        setReportData(data);
      } else {
        alert("Lỗi tạo báo cáo: " + data.error);
      }
    } catch (e: any) {
      console.error(e);
      alert("Lỗi kết nối: " + e.message);
    } finally {
      setReportLoading(false);
    }
  };

  // Gom nhóm dữ liệu theo từng ngày cho Chế độ Lịch Tổng Quan
  const dailySummaries = useMemo<DaySummary[]>(() => {
    const groups: { [key: string]: SensoryLog[] } = {};
    historyLogs.forEach((log) => {
      const d = new Date(log.created_at);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });

    return Object.keys(groups).sort().reverse().map((dateKey) => {
      const dayLogs = groups[dateKey];
      let sumBpm = 0, validBpmCount = 0, maxBpm = 0;
      let maxMic = 0;
      let overloadCount = 0;

      dayLogs.forEach((l) => {
        if (l.bpm && l.bpm > 0) {
          sumBpm += l.bpm;
          validBpmCount++;
          if (l.bpm > maxBpm) maxBpm = l.bpm;
        }
        if (l.mic && l.mic > maxMic) maxMic = l.mic;
        if (l.stress_score >= 70 && l.overload_status !== 'CHƯA ĐEO ĐỒNG HỒ') overloadCount++;
      });

      const avgBpm = validBpmCount > 0 ? Math.round(sumBpm / validBpmCount) : 0;
      const parts = dateKey.split('-');
      const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      
      const dayName = dObj.toLocaleDateString('vi-VN', { weekday: 'long' });
      const displayDate = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;

      let status: 'peaceful' | 'warning' | 'alert' = 'peaceful';
      if (overloadCount >= 3) status = 'alert';
      else if (overloadCount > 0) status = 'warning';

      return {
        dateStr: dateKey,
        displayDate,
        totalLogs: dayLogs.length,
        overloadCount,
        avgBpm,
        maxBpm,
        maxMic: Math.round(maxMic / 1000),
        status,
        logs: dayLogs,
      };
    });
  }, [historyLogs]);

  // Lọc dữ liệu danh sách chi tiết
  const filteredLogs = useMemo(() => {
    return historyLogs.filter((log) => {
      if (filterDate) {
        const d = new Date(log.created_at);
        const logDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (logDate !== filterDate) return false;
      }
      if (filterStatus === 'unworn' && log.overload_status !== 'CHƯA ĐEO ĐỒNG HỒ') return false;
      if (filterStatus === 'overload' && (log.stress_score < 70 || log.overload_status === 'CHƯA ĐEO ĐỒNG HỒ')) return false;
      if (filterStatus === 'warning' && (log.stress_score < 40 || log.stress_score >= 70 || log.overload_status === 'CHƯA ĐEO ĐỒNG HỒ')) return false;
      if (filterStatus === 'normal' && (log.stress_score >= 40 || log.overload_status === 'CHƯA ĐEO ĐỒNG HỒ')) return false;
      return true;
    });
  }, [historyLogs, filterDate, filterStatus]);

  const isUnworn = current?.overload_status === 'CHƯA ĐEO ĐỒNG HỒ';
  const isOverloaded = !isUnworn && (current?.stress_score || 0) >= 70;

  return (
    <main className={`min-h-screen bg-[#f8fafc] text-slate-800 p-5 md:p-10 font-sans transition-all duration-500 ${
      isOverloaded ? 'ring-8 ring-inset ring-rose-300/60' : ''
    }`}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Thanh Header Dễ Thương & Trong Trẻo */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-100/80 rounded-2xl text-sky-600 shadow-sm shrink-0">
                <Sun className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800">
                  Sensory Watch
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">Theo dõi cảm giác dịu êm & Trợ lý điều hòa cho trẻ</p>
              </div>
            </div>
            
            {/* Tag Hồ Sơ Bé & Trạng Thái Đeo Đồng Hồ */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-sky-50 border border-slate-200/80 text-xs text-slate-700 hover:text-sky-600 transition-all shadow-sm"
              >
                <User className="h-3.5 w-3.5 text-sky-500" />
                <span className="font-semibold">{childProfile.name}</span>
                <span className="text-slate-400 text-[11px]">({childProfile.age} tuổi)</span>
                <span className="text-sky-500 text-[10px] ml-1 bg-sky-100/60 px-1.5 py-0.5 rounded-full">Sửa</span>
              </button>

              {/* Huy hiệu nhận diện đeo đồng hồ thời gian thực */}
              {isUnworn ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50/90 border border-amber-200 text-xs text-amber-700 font-bold shadow-sm animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Bé Chưa Đeo Đồng Hồ ( . _ . )
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-700 font-bold shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Bé Đang Đeo Đồng Hồ ⌚
                </span>
              )}

              {/* Huy hiệu nhịp tim cơ sở tự động đo */}
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200/80 text-xs text-rose-700 font-semibold shadow-sm" title="Hệ thống tự động tính từ lịch sử lúc bé bình ổn">
                <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
                BPM cơ sở: {baselineStats.isCalculated ? `${baselineStats.bpm} bpm` : '~75 bpm (ước tính)'}
              </span>

              {childProfile.emergencyContactPhone && (
                <span className="text-xs text-slate-500 hidden xl:inline bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                  📞 {childProfile.emergencyContactName}: {childProfile.emergencyContactPhone}
                </span>
              )}

              <span className="text-xs text-slate-400 hidden sm:inline bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                🌱 Nhạy cảm: {childProfile.sensitivities}
              </span>
            </div>
          </div>

          {/* Thanh Chuyển Tab Phong Cách Segmented Control Hiện Đại */}
          <nav className="shrink-0 flex items-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/70 shadow-xs">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-semibold rounded-xl whitespace-nowrap transition-all outline-none focus:outline-none ${
                activeTab === 'live' 
                  ? 'bg-white text-sky-600 shadow-sm border border-slate-200/60 font-bold' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Giám Sát</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-semibold rounded-xl whitespace-nowrap transition-all outline-none focus:outline-none ${
                activeTab === 'history' 
                  ? 'bg-white text-sky-600 shadow-sm border border-slate-200/60 font-bold' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <History className="h-4 w-4 shrink-0" />
              <span>Nhật Ký & Lịch</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('report');
                if (!reportData) generateAiReport();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-semibold rounded-xl whitespace-nowrap transition-all outline-none focus:outline-none ${
                activeTab === 'report' 
                  ? 'bg-white text-sky-600 shadow-sm border border-slate-200/60 font-bold' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>Báo Cáo</span>
            </button>
          </nav>
        </header>

        {/* TAB 1: GIÁM SÁT THỜI GIAN THỰC */}
        {activeTab === 'live' && (
          <>
            {/* Banner Thông Báo Khi Bé Chưa Đeo Đồng Hồ */}
            {isUnworn && (
              <div className="bg-amber-50/80 border border-amber-200/80 p-4 md:p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_4px_20px_rgba(245,158,11,0.06)] animate-in fade-in duration-300">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-amber-100 rounded-2xl text-amber-600 text-xl font-bold shrink-0">
                    🧸
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                      Bé Chưa Đeo Đồng Hồ
                      <span className="text-[10px] bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                        ( . _ . )
                      </span>
                    </h3>
                    <p className="text-xs text-amber-800/80 mt-0.5">
                      Cảm biến quang học MAX30102 và phản xạ da GSR chưa ghi nhận tiếp xúc với cơ thể bé. Hãy đeo đồng hồ vào cổ tay bé để bắt đầu theo dõi nhịp tim và cảm giác nhé!
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-white/90 px-3.5 py-1.5 rounded-full border border-amber-200/60 shadow-sm shrink-0 self-end sm:self-auto">
                  Đang Chờ Đeo...
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Nhịp Tim */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-rose-50 hover:shadow-md transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nhịp Tim</span>
                  <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-500">
                    <Heart className="h-5 w-5 animate-pulse" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`${isUnworn ? 'text-2xl text-slate-400' : 'text-4xl text-slate-800'} font-extrabold tracking-tight`}>
                    {isUnworn ? 'Chưa đeo' : (current?.bpm && current.bpm > 0 ? current.bpm : '--')}
                  </span>
                  {!isUnworn && <span className="text-xs font-semibold text-rose-400">bpm</span>}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {isUnworn ? 'Đang chờ tiếp xúc da' : 'Dấu hiệu nhịp đập tự nhiên'}
                </p>
              </div>

              {/* Phản Xạ Da */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-sky-50 hover:shadow-md transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phản Xạ Da (GSR)</span>
                  <div className="p-2.5 bg-sky-50 rounded-2xl text-sky-500">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`${isUnworn ? 'text-2xl text-slate-400' : 'text-4xl text-slate-800'} font-extrabold tracking-tight`}>
                    {isUnworn ? 'Chưa kẹp' : (current?.gsr && current.gsr > 300 ? current.gsr : 'Chưa kẹp')}
                  </span>
                  {!isUnworn && <span className="text-xs font-semibold text-sky-400">raw</span>}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {isUnworn ? 'Chưa nhận tín hiệu da' : 'Độ kích thích thần kinh'}
                </p>
              </div>

              {/* Mức Ồn */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-amber-50 hover:shadow-md transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tiếng Ồn Xung Quanh</span>
                  <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-500">
                    <Volume2 className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-800 tracking-tight">
                    {current ? Math.round(current.mic / 1000) : '--'}
                  </span>
                  <span className="text-xs font-semibold text-amber-500">k-lvl</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Âm thanh môi trường quanh bé</p>
              </div>

              {/* Điểm Quá Tải */}
              <div className={`rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border transition-all ${
                isOverloaded 
                  ? 'bg-rose-50/60 border-rose-200 shadow-rose-100' 
                  : 'bg-white border-purple-50 hover:shadow-md'
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Điểm Cảm Giác</span>
                  <div className={`p-2.5 rounded-2xl ${
                    isOverloaded ? 'bg-rose-100 text-rose-600' : isUnworn ? 'bg-slate-100 text-slate-400' : 'bg-purple-50 text-purple-500'
                  }`}>
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-extrabold tracking-tight ${
                    isOverloaded ? 'text-rose-600' : isUnworn ? 'text-slate-400' : 'text-slate-800'
                  }`}>
                    {isUnworn ? 0 : (current ? current.stress_score : 0)}
                  </span>
                  <span className="text-xs font-semibold text-purple-400">/ 100</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {isUnworn ? '⚪ Chưa đeo đồng hồ' : isOverloaded ? '⚠️ Cần vỗ về bé ngay' : '🌱 Bé đang bình yên'}
                </p>
              </div>
            </div>

            {/* KHỐI TRỢ LÝ AI ĐIỀU HÒA CẢM GIÁC */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_6px_25px_rgba(0,0,0,0.03)] border border-indigo-50/80 space-y-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-2xl text-violet-600 shadow-sm">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-800">Trợ Lý Điều Hòa Cảm Giác</h2>
                      {aiReport?.urgencyLevel && (
                        <span className={`px-3 py-0.5 rounded-full text-[11px] font-bold ${
                          aiReport.urgencyLevel === 'KHẨN CẤP' ? 'bg-rose-100 text-rose-600 border border-rose-200' :
                          aiReport.urgencyLevel === 'CẢNH BÁO' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}>
                          {aiReport.urgencyLevel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Nhận diện tác nhân & gợi ý bài tập làm dịu tự nhiên cho {childProfile.name}</p>
                  </div>
                </div>

                <button
                  onClick={() => executeAiAnalysis()}
                  disabled={aiLoading || !current}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 disabled:opacity-50 text-white text-xs md:text-sm font-semibold rounded-full transition-all shadow-md shadow-indigo-100 shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${aiLoading ? 'animate-spin' : ''}`} />
                  {aiLoading ? 'Đang Lắng Nghe Bé...' : 'Chẩn Đoán Ngay ✨'}
                </button>
              </div>

              {aiReport ? (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 text-sm">
                    <span className="text-xs font-bold uppercase text-violet-600 tracking-wider flex items-center gap-1.5 mb-1.5">
                      <Zap className="h-4 w-4 text-violet-500" />
                      Nguyên Nhân Bé Khó Chịu:
                    </span>
                    <p className="text-slate-700 leading-relaxed font-medium">{aiReport.analysis}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100/80 space-y-2.5">
                      <span className="text-xs font-bold uppercase text-rose-600 tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                        Việc Ba Mẹ / Thầy Cô Làm Ngay:
                      </span>
                      <ul className="space-y-2 text-xs">
                        {aiReport.immediateActions?.map((act, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 bg-white p-3 rounded-xl border border-rose-100 shadow-sm text-slate-700">
                            <span className="h-2 w-2 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                            <span className="font-semibold text-rose-950">{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100/80 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider flex items-center gap-1.5">
                          <HeartPulse className="h-4 w-4 text-emerald-600" />
                          Bài Tập Làm Dịu (Sensory Play):
                        </span>
                        {aiReport.soothingExercise?.duration && (
                          <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full font-medium">
                            ⏱️ {aiReport.soothingExercise.duration}
                          </span>
                        )}
                      </div>
                      
                      {aiReport.soothingExercise ? (
                        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm space-y-1.5">
                          <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                            🌿 {aiReport.soothingExercise.title}
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{aiReport.soothingExercise.guide}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Không có bài tập đặc biệt.</p>
                      )}
                    </div>
                  </div>

                  {aiReport.caregiverAdvice && (
                    <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-2xl text-xs text-sky-900 flex items-start gap-3">
                      <Smile className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-sky-800">Lời khuyên vỗ về: </span>
                        <span className="text-slate-700 leading-relaxed">{aiReport.caregiverAdvice}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
                  <p className="text-xs text-slate-400">
                    🌱 Khi bé chớm căng thẳng, trợ lý AI sẽ tự động phân tích và hiện bài tập ôm/vỗ về ngay tại đây.
                  </p>
                </div>
              )}
            </div>

            {/* Biểu Đồ Thời Gian Thực */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Nhịp Tim & Chỉ Số Cảm Giác</h2>
                  <p className="text-xs text-slate-400">Đường màu tím: Điểm quá tải | Đường màu hồng: Nhịp tim</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-purple-600 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Quá Tải
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-500 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Nhịp Tim
                  </span>
                </div>
              </div>
              <div className="h-72 w-full flex items-center justify-center pt-2">
                <StressChart logs={logs} />
              </div>
            </div>
          </>
        )}

        {/* TAB 2: NHẬT KÝ & LỊCH TỔNG QUAN THEO NGÀY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 space-y-6">
            
            {/* Header Nhật Ký + Thanh Chuyển 2 Tab Con */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-sky-500" />
                  Nhật Ký Cảm Giác & Lịch Tổng Quan
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Theo dõi chi tiết từng mốc đo hoặc nhìn nhận bức tranh tổng thể theo từng ngày</p>
              </div>

              {/* 2 Tab Con: Dạng Bảng vs Dạng Lịch */}
              <div className="bg-slate-100 p-1 rounded-full flex gap-1 border border-slate-200/60 shadow-inner">
                <button
                  onClick={() => setHistorySubTab('list')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    historySubTab === 'list'
                      ? 'bg-white text-sky-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  Danh Sách Chi Tiết
                </button>
                <button
                  onClick={() => setHistorySubTab('calendar')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    historySubTab === 'calendar'
                      ? 'bg-white text-sky-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Lịch Theo Ngày ({dailySummaries.length} ngày)
                </button>
              </div>
            </div>

            {/* PHÂN HỆ 1: DANH SÁCH CHI TIẾT + BỘ LỌC THỜI GIAN / MỨC ĐỘ */}
            {historySubTab === 'list' && (
              <div className="space-y-4">
                {/* Thanh Bộ Lọc Tinh Tế */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Lọc theo ngày */}
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-sm">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-500 font-medium">Chọn ngày:</span>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
                      />
                      {filterDate && (
                        <button onClick={() => setFilterDate('')} className="text-slate-400 hover:text-slate-600 ml-1">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Lọc theo mức độ căng thẳng */}
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-sm">
                      <Filter className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-500 font-medium">Trạng thái:</span>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="all">Tất cả mốc đo</option>
                        <option value="overload">🚨 Quá tải (≥ 70%)</option>
                        <option value="warning">⚡ Kích thích (40 - 69%)</option>
                        <option value="normal">🌱 Bình thường (&lt; 40%)</option>
                        <option value="unworn">⚪ Chưa đeo đồng hồ</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">
                      Tìm thấy <strong className="text-slate-700">{filteredLogs.length}</strong> kết quả
                    </span>
                    <button
                      onClick={fetchFullHistory}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 text-xs font-semibold shadow-sm transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Làm mới
                    </button>
                  </div>
                </div>

                {/* Bảng Nhật Ký Với Ngày & Giờ Đầy Đủ */}
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-400 text-xs uppercase border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="px-4 py-3.5">Thời Gian (Giờ & Ngày)</th>
                        <th className="px-4 py-3.5">Thiết Bị</th>
                        <th className="px-4 py-3.5">BPM</th>
                        <th className="px-4 py-3.5">GSR</th>
                        <th className="px-4 py-3.5">Độ Ồn</th>
                        <th className="px-4 py-3.5">Điểm Cảm Giác</th>
                        <th className="px-4 py-3.5">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredLogs.map((row) => {
                        const d = new Date(row.created_at);
                        const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-bold text-slate-800">{timeStr}</span>
                                <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                  {dateStr}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-500">{row.device_id}</td>
                            <td className="px-4 py-3 font-bold text-rose-500">{row.bpm > 0 ? row.bpm : '--'}</td>
                            <td className="px-4 py-3 font-semibold text-sky-600">{row.gsr}</td>
                            <td className="px-4 py-3 font-semibold text-amber-600">{Math.round(row.mic / 1000)}k</td>
                            <td className="px-4 py-3 font-bold text-purple-600">{row.stress_score}%</td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                row.overload_status === 'CHƯA ĐEO ĐỒNG HỒ' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                                row.stress_score >= 70 ? 'bg-rose-100 text-rose-600' :
                                row.stress_score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {row.overload_status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400">
                            Không tìm thấy mốc đo nào phù hợp với bộ lọc đã chọn.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PHÂN HỆ 2: CHẾ ĐỘ LỊCH TỔNG QUAN THEO NGÀY (CALENDAR OVERVIEW) */}
            {historySubTab === 'calendar' && (
              <div className="space-y-6">
                <div className="bg-sky-50/60 border border-sky-100 p-4 rounded-2xl flex items-center justify-between text-xs text-sky-900">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-sky-500 shrink-0" />
                    <span>Lịch tổng hợp tự động gom các lần đo theo từng ngày để bạn nắm bắt xu hướng cảm giác của bé.</span>
                  </div>
                  <span className="font-semibold text-sky-700">Bấm vào ngày để xem chi tiết 👆</span>
                </div>

                {/* Grid Các Thẻ Ngày Bo Tròn Đẹp Mắt */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dailySummaries.map((day) => {
                    return (
                      <div
                        key={day.dateStr}
                        onClick={() => setSelectedDayDetail(day)}
                        className={`p-5 rounded-3xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                          day.status === 'alert'
                            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                            : day.status === 'warning'
                            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
                            : 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                              {day.dateStr}
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-800 mt-0.5">
                              {day.displayDate}
                            </h3>
                          </div>
                          
                          {/* Huy hiệu đánh giá ngày */}
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            day.status === 'alert'
                              ? 'bg-rose-100 text-rose-600 border border-rose-200'
                              : day.status === 'warning'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {day.status === 'alert' ? `🚨 ${day.overloadCount} lần quá tải` :
                             day.status === 'warning' ? `🌤️ ${day.overloadCount} lần chớm lo` :
                             '☀️ Ngày bình yên'}
                          </span>
                        </div>

                        {/* Thống kê nhanh trong ngày */}
                        <div className="grid grid-cols-3 gap-2 bg-white/90 p-3 rounded-2xl border border-slate-100/80 text-center my-3">
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium">BPM TB</span>
                            <p className="text-xs font-bold text-slate-800">{day.avgBpm || '--'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium">Đỉnh ồn</span>
                            <p className="text-xs font-bold text-amber-600">{day.maxMic}k</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium">Số mẫu</span>
                            <p className="text-xs font-bold text-sky-600">{day.totalLogs}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 text-[11px] font-medium text-slate-500">
                          <span>Xem {day.totalLogs} mốc đo</span>
                          <span className="flex items-center text-sky-600 font-semibold gap-0.5">
                            Chi tiết <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {dailySummaries.length === 0 && (
                    <div className="col-span-3 text-center py-12 text-slate-400 bg-slate-50 rounded-3xl border border-slate-100">
                      Chưa có dữ liệu nào để tổng hợp lịch.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BÁO CÁO GIÁC QUAN DÀI HẠN */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  Báo Cáo Điều Hòa Giác Quan Của {childProfile.name}
                </h2>
                <p className="text-xs text-slate-400 mt-1">Phân tích tương quan tác nhân & Thực đơn Giác quan (Sensory Diet) dài hạn</p>
              </div>
              <button
                onClick={generateAiReport}
                disabled={reportLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 disabled:opacity-50 text-white text-xs md:text-sm font-semibold rounded-full transition-all shadow-md shadow-indigo-100"
              >
                <RefreshCw className={`h-4 w-4 ${reportLoading ? 'animate-spin' : ''}`} />
                {reportLoading ? 'Đang Phân Tích...' : 'Cập Nhật Báo Cáo'}
              </button>
            </div>

            {reportData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-3xl p-5 border border-rose-50 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">Tỷ Lệ Quá Tải</span>
                    <div className="text-3xl font-extrabold text-rose-500 mt-1">{reportData.metrics?.overloadPercentage}%</div>
                    <span className="text-[11px] text-slate-400">thời gian ở ngưỡng &ge; 70%</span>
                  </div>
                  <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">BPM TB / Đỉnh</span>
                    <div className="text-3xl font-extrabold text-slate-800 mt-1">
                      {reportData.metrics?.avgBpm} <span className="text-xs text-rose-400 font-normal">/ {reportData.metrics?.maxBpm}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">nhịp đập mỗi phút</span>
                  </div>
                  <div className="bg-white rounded-3xl p-5 border border-amber-50 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">Tác Nhân Tiếng Ồn</span>
                    <div className="text-3xl font-extrabold text-amber-500 mt-1">{reportData.metrics?.noiseTriggerPercentage}%</div>
                    <span className="text-[11px] text-slate-400">cơn quá tải do tiếng ồn</span>
                  </div>
                  <div className="bg-white rounded-3xl p-5 border border-sky-50 shadow-sm">
                    <span className="text-xs text-slate-400 font-medium">Đỉnh Phản Xạ Da</span>
                    <div className="text-3xl font-extrabold text-sky-500 mt-1">{reportData.metrics?.maxGsr}</div>
                    <span className="text-[11px] text-slate-400">mức kích động thần kinh</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-sky-500" />
                      Đánh Giá Xu Hướng & Tác Nhân (Triggers)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {reportData.summary}
                    </p>
                    
                    {reportData.triggerBreakdown && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3.5 bg-violet-50 border border-violet-100 rounded-2xl text-violet-900">
                          <span className="font-bold text-violet-700">Tác nhân chính: </span>
                          {reportData.triggerBreakdown.primary}
                        </div>
                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5 text-slate-600">
                          <p><strong className="text-amber-600">Âm thanh:</strong> {reportData.triggerBreakdown.noiseImpact}</p>
                          <p><strong className="text-sky-600">Nội sinh:</strong> {reportData.triggerBreakdown.internalStressImpact}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      Kế Hoạch Thực Đơn Giác Quan (Sensory Diet)
                    </h3>
                    <div className="space-y-3">
                      {reportData.sensoryDietPlan?.map((item: any, idx: number) => (
                        <div key={idx} className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 text-xs space-y-1">
                          <span className="font-bold text-emerald-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            🌱 {item.area}
                          </span>
                          <p className="leading-relaxed text-slate-700">{item.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-100 shadow-sm">
                <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm">Bấm &quot;Cập Nhật Báo Cáo&quot; để AI quét dữ liệu và tạo kế hoạch chăm sóc bé.</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* POPUP CHI TIẾT NGÀY KHI BẤM TỪ LỊCH TỔNG QUAN */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Chi Tiết Mốc Đo
                </span>
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-sky-500" />
                  {selectedDayDetail.displayDate}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedDayDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chỉ số nhanh của ngày */}
            <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3.5 rounded-2xl text-center border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Tổng mốc đo</span>
                <p className="text-sm font-bold text-slate-800">{selectedDayDetail.totalLogs}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Cơn quá tải</span>
                <p className="text-sm font-bold text-rose-500">{selectedDayDetail.overloadCount}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">BPM TB/Đỉnh</span>
                <p className="text-sm font-bold text-slate-800">{selectedDayDetail.avgBpm} / {selectedDayDetail.maxBpm}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Đỉnh ồn</span>
                <p className="text-sm font-bold text-amber-600">{selectedDayDetail.maxMic}k</p>
              </div>
            </div>

            {/* Danh sách các lần đo trong ngày */}
            <div className="overflow-y-auto flex-1 rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-400 font-semibold sticky top-0 border-b border-slate-100">
                  <tr>
                    <th className="px-3.5 py-2.5">Thời Gian</th>
                    <th className="px-3.5 py-2.5">BPM</th>
                    <th className="px-3.5 py-2.5">GSR</th>
                    <th className="px-3.5 py-2.5">Độ Ồn</th>
                    <th className="px-3.5 py-2.5">Điểm</th>
                    <th className="px-3.5 py-2.5">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDayDetail.logs.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-800">
                        {new Date(row.created_at).toLocaleTimeString('vi-VN')}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-rose-500">{row.bpm > 0 ? row.bpm : '--'}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-sky-600">{row.gsr}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-amber-600">{Math.round(row.mic / 1000)}k</td>
                      <td className="px-3.5 py-2.5 font-bold text-purple-600">{row.stress_score}%</td>
                      <td className="px-3.5 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          row.overload_status === 'CHƯA ĐEO ĐỒNG HỒ' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                          row.stress_score >= 70 ? 'bg-rose-100 text-rose-600' :
                          row.stress_score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {row.overload_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => setSelectedDayDetail(null)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition-colors"
            >
              Đóng Lại
            </button>
          </div>
        </div>
      )}

      {/* POPUP CẢNH BÁO KHẨN CẤP BO TRÒN DỊU DÀNG */}
      {showAlertModal && !hasDismissedCurrentAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-rose-100 space-y-5">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-500 rounded-2xl">
                  <AlertTriangle className="h-7 w-7 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-slate-800">{childProfile.name.toUpperCase()} CẦN ĐƯỢC VỖ VỀ</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-rose-500 font-bold">Điểm quá tải: {current?.stress_score}%</span>
                    {current && current.mic >= 14000 && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        🔊 Do Tiếng Ồn Đột Biến!
                      </span>
                    )}
                    {current && current.bpm >= 115 && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                        ❤️ Do Tim Đập Nhanh!
                      </span>
                    )}
                    {current && current.gsr >= 650 && (
                      <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">
                        💧 Do Lo Âu / Mồ Hôi!
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setHasDismissedCurrentAlert(true)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Nhịp tim</span>
                <p className="text-base font-extrabold text-slate-800">{current?.bpm || '--'} bpm</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Phản xạ da</span>
                <p className="text-base font-extrabold text-sky-600">{current?.gsr || '--'}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Mức ồn</span>
                <p className="text-base font-extrabold text-amber-500">{current ? Math.round(current.mic / 1000) : '--'}k</p>
              </div>
            </div>

            {/* Liên hệ khẩn cấp & Đồ làm dịu ưu tiên */}
            {childProfile.emergencyContactPhone && (
              <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-xs">
                <div>
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">Người Giám Hộ / Liên Hệ:</span>
                  <span className="font-bold text-slate-800">{childProfile.emergencyContactName || 'Phụ huynh'}: </span>
                  <span className="text-slate-600 font-semibold">{childProfile.emergencyContactPhone}</span>
                </div>
                <a
                  href={`tel:${childProfile.emergencyContactPhone}`}
                  className="px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all text-xs"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Gọi Ngay
                </a>
              </div>
            )}

            {childProfile.soothingPreferences && (
              <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
                <span className="text-base shrink-0">🧸</span>
                <div>
                  <strong className="text-amber-800 font-bold block">Đồ vật & Biện pháp xoa dịu bé ưa thích:</strong>
                  <span className="text-amber-950 font-medium">{childProfile.soothingPreferences}</span>
                </div>
              </div>
            )}

            {aiReport ? (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                <div className="bg-violet-50/80 border border-violet-100 p-3.5 rounded-2xl text-xs text-violet-950">
                  <strong className="text-violet-700">🎯 Nguyên nhân: </strong>
                  <span>{aiReport.analysis}</span>
                </div>

                {aiReport.immediateActions && aiReport.immediateActions.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Việc làm ngay:</span>
                    {aiReport.immediateActions.map((action, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 bg-rose-50/50 rounded-xl border border-rose-100 text-xs text-rose-950 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-rose-500 shrink-0" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                )}

                {aiReport.soothingExercise && (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-1 text-xs">
                    <span className="font-bold text-emerald-800 flex items-center gap-1">
                      🌿 {aiReport.soothingExercise.title}
                    </span>
                    <p className="text-slate-600 leading-relaxed">{aiReport.soothingExercise.guide}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-sky-500" />
                <span>AI đang chuẩn bị bài tập làm dịu bé...</span>
              </div>
            )}

            <button
              onClick={() => setHasDismissedCurrentAlert(true)}
              className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-rose-200"
            >
              Đã Nhận Thông Tin & Đang Vỗ Về Bé 🧸
            </button>
          </div>
        </div>
      )}

      {/* MODAL CẤU HÌNH HỒ SƠ BÉ BO TRÒN */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-7 max-w-lg w-full space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <User className="h-5 w-5 text-sky-500" />
                Hồ Sơ Cảm Giác Của Bé
              </h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Thẻ hiển thị nhịp tim cơ sở tự động tính từ lịch sử */}
            <div className="p-3.5 bg-sky-50/80 border border-sky-100 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sky-800 flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                  Nhịp tim cơ sở (Resting BPM):
                </span>
                <span className="font-extrabold text-sky-900 px-2.5 py-0.5 bg-white rounded-full border border-sky-200/60 shadow-xs">
                  {baselineStats.isCalculated ? `${baselineStats.bpm} BPM` : 'Đang ước tính (~75 BPM)'}
                </span>
              </div>
              <p className="text-[11px] text-sky-600 leading-relaxed">
                {baselineStats.isCalculated
                  ? `⚡ Thiết bị tự động tính từ ${baselineStats.count} mốc đo lúc bé bình ổn và đang đeo đồng hồ. Không cần người dùng nhập tay.`
                  : '⚡ Thiết bị sẽ tự động học và tính toán chỉ số này sau khi có các mốc dữ liệu bình ổn từ đồng hồ.'}
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Tên của bé:</label>
                  <input
                    type="text"
                    value={childProfile.name}
                    onChange={(e) => setChildProfile({ ...childProfile, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Tuổi:</label>
                  <input
                    type="number"
                    value={childProfile.age}
                    onChange={(e) => setChildProfile({ ...childProfile, age: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Điểm nhạy cảm giác quan của bé:</label>
                <textarea
                  rows={2}
                  value={childProfile.sensitivities}
                  onChange={(e) => setChildProfile({ ...childProfile, sensitivities: e.target.value })}
                  placeholder="Ví dụ: Tiếng ồn đột ngột, đèn neon chói, va chạm bất ngờ..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">🧸 Đồ vật & Biện pháp xoa dịu ưa thích:</label>
                <textarea
                  rows={2}
                  value={childProfile.soothingPreferences}
                  onChange={(e) => setChildProfile({ ...childProfile, soothingPreferences: e.target.value })}
                  placeholder="Ví dụ: Chăn trọng lượng, nghe tiếng mưa rơi, thú bông squishy, ôm áp lực sâu..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-400"
                />
                <span className="text-[11px] text-slate-400">AI sẽ ưu tiên gợi ý các phương pháp/đồ vật này khi bé bị quá tải.</span>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">⚡ Dấu hiệu cảnh báo sớm (Stimming/Hành vi):</label>
                <input
                  type="text"
                  value={childProfile.earlySigns}
                  onChange={(e) => setChildProfile({ ...childProfile, earlySigns: e.target.value })}
                  placeholder="Ví dụ: Bịt tai, lắc lư người, vỗ tay liên tục (stimming), né tránh ánh nhìn..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Người liên hệ khẩn cấp:</label>
                  <input
                    type="text"
                    value={childProfile.emergencyContactName}
                    onChange={(e) => setChildProfile({ ...childProfile, emergencyContactName: e.target.value })}
                    placeholder="Ví dụ: Mẹ Lan / Bố Tuấn"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Số điện thoại khẩn cấp:</label>
                  <input
                    type="tel"
                    value={childProfile.emergencyContactPhone}
                    onChange={(e) => setChildProfile({ ...childProfile, emergencyContactPhone: e.target.value })}
                    placeholder="Ví dụ: 0901234567"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                try {
                  localStorage.setItem('sensory_child_profile', JSON.stringify(childProfile));
                } catch (e) {
                  console.error(e);
                }
                setShowProfileModal(false);
              }}
              className="w-full py-3 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-sky-100 mt-2"
            >
              Lưu Hồ Sơ Bé & Tự Động Ghi Nhớ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}