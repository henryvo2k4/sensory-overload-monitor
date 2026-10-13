-- =========================================================================
-- BẢNG SENSORY_LOGS (LƯU TRỮ DỮ LIỆU ĐO GIÁC QUAN TỪ ĐỒNG HỒ THỜI GIAN THỰC)
-- =========================================================================

-- 1. Tạo bảng sensory_logs
create table if not exists public.sensory_logs (
    id bigint generated always as identity primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    device_id text not null default 'SOM_Watch_01',
    bpm integer default 0,
    gsr integer default 0,
    mic integer default 0,
    stress_score integer default 0,
    overload_status text default 'BÌNH THƯỜNG'
);

-- 2. Đánh chỉ mục (Index) để tối ưu truy vấn theo thời gian
create index if not exists idx_sensory_logs_created_at on public.sensory_logs (created_at desc);

-- 3. Bật Row Level Security (RLS)
alter table public.sensory_logs enable row level security;

-- 4. Tạo Policy cho phép đọc và ghi (Public/Anon)
create policy "Allow public read access"
    on public.sensory_logs
    for select
    using (true);

create policy "Allow public insert access"
    on public.sensory_logs
    for insert
    with check (true);

-- 5. Kích hoạt tính năng Realtime (Postgres Changes) cho Supabase
alter publication supabase_realtime add table public.sensory_logs;

