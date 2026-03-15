-- Pickleball Community – Supabase schema
-- Run in Supabase Dashboard → SQL Editor. Enable RLS and add policies as needed for your app.

-- Profiles (extends auth.users or standalone; use anon for demo)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  phone text,
  email text,
  name text not null default '',
  first_name text,
  last_name text,
  age int,
  player_type text default 'Intermediate',
  avatar text,
  location text default 'Austin, TX',
  city text,
  state text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Friend requests: from_profile_id -> to_profile_id, status pending|accepted|rejected
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references public.profiles(id) on delete cascade,
  to_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique(from_profile_id, to_profile_id)
);
create index if not exists idx_friend_requests_to on public.friend_requests(to_profile_id);
create index if not exists idx_friend_requests_from on public.friend_requests(from_profile_id);

-- Events (home feed / list)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level text default 'Intermediate',
  level_primary boolean default true,
  date text not null,
  venue text not null,
  lat numeric,
  lng numeric,
  distance text,
  format text default 'Doubles',
  joined text default '0/4 joined',
  joined_highlight boolean default false,
  image text,
  weather text,
  weather_icon text,
  weather_active boolean default false,
  host_avatars jsonb default '[]',
  extra_count int default 0,
  cta text default 'Join Game',
  cta_primary boolean default true,
  opacity numeric default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Event details (single event page; id = events.id)
create table if not exists public.event_details (
  id uuid primary key references public.events(id) on delete cascade,
  title text not null,
  level text,
  image text,
  host_name text,
  host_sub text,
  host_avatar text,
  location_name text,
  map_image text,
  date text,
  time text,
  player_count text,
  player_avatars jsonb default '[]',
  description text,
  chat_preview jsonb,
  chat_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Courts
create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  courts int default 1,
  surface text,
  lights boolean default true,
  distance text,
  lat numeric,
  lng numeric,
  image text,
  amenities text,
  created_at timestamptz default now()
);

-- Chats (conversation list)
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  avatar text,
  last_message text,
  time text,
  unread int default 0,
  active boolean default false,
  read boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chat messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  author text,
  author_avatar text,
  author_id uuid references public.profiles(id) on delete set null,
  text text not null,
  time text,
  image text,
  created_at timestamptz default now()
);

-- Event attendees (who joined which event)
create table if not exists public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  name text,
  avatar text,
  joined_at timestamptz default now(),
  unique(event_id, profile_id)
);

-- Indexes
create index if not exists idx_events_date on public.events(date);
create index if not exists idx_events_created_at on public.events(created_at desc);
create index if not exists idx_chats_time on public.chats(updated_at desc);
create index if not exists idx_chat_messages_chat_id on public.chat_messages(chat_id);
create index if not exists idx_event_attendees_event_id on public.event_attendees(event_id);

-- RLS: allow anon to read and insert (for demo; tighten in production)
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_details enable row level security;
alter table public.courts enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.event_attendees enable row level security;

create policy "Allow anon read profiles" on public.profiles for select using (true);
create policy "Allow anon insert profiles" on public.profiles for insert with check (true);
create policy "Allow anon update profiles" on public.profiles for update using (true);

create policy "Allow anon read events" on public.events for select using (true);
create policy "Allow anon insert events" on public.events for insert with check (true);
create policy "Allow anon update events" on public.events for update using (true);

create policy "Allow anon read event_details" on public.event_details for select using (true);
create policy "Allow anon insert event_details" on public.event_details for insert with check (true);
create policy "Allow anon update event_details" on public.event_details for update using (true);

create policy "Allow anon read courts" on public.courts for select using (true);
create policy "Allow anon insert courts" on public.courts for insert with check (true);

create policy "Allow anon read chats" on public.chats for select using (true);
create policy "Allow anon insert chats" on public.chats for insert with check (true);
create policy "Allow anon update chats" on public.chats for update using (true);

create policy "Allow anon read chat_messages" on public.chat_messages for select using (true);
create policy "Allow anon insert chat_messages" on public.chat_messages for insert with check (true);

create policy "Allow anon read event_attendees" on public.event_attendees for select using (true);
create policy "Allow anon insert event_attendees" on public.event_attendees for insert with check (true);

alter table public.friend_requests enable row level security;
create policy "Allow anon read friend_requests" on public.friend_requests for select using (true);
create policy "Allow anon insert friend_requests" on public.friend_requests for insert with check (true);
create policy "Allow anon update friend_requests" on public.friend_requests for update using (true);

-- Optional: add new profile columns to existing DBs (no-op if already present)
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists age int;
alter table public.profiles add column if not exists player_type text default 'Intermediate';
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists bio text;

-- Test accounts (insert into profiles; use these to “log in” by storing in localStorage for demo)
-- Password/OTP is handled by your auth (Twilio or Supabase Auth); these are display accounts.
insert into public.profiles (id, phone, email, name, avatar, location) values
  ('a0000000-0000-0000-0000-000000000001'::uuid, '+15125551111', 'alex@example.com', 'Alex Rivers', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjcXVDOMD2-VXu2A2iBCoXB5LDaO26iuIAQ-lPQ5JuAZSBXfbCjHboooLZwoj0V76aKbemIc9U3vUI-8p0KZrhhgKYgC9g550o0deo2hlpJz7-1kAOzBlV6QU7ingYnVYzyOWYXFnDDTaIjSUrHn1GSRhsAOqSX_7XMgmKRHLwAp32PGrLiLwx3P_4tC__x1Ufwjvuscmo2YjbG06L7JrxgLbeuUgOsQka1uEzKs4hkv7uRBjtu7DwnnSm__4Jk00ZqqQJ3-rm38U', 'Austin, TX'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, '+15125552222', 'sarah@example.com', 'Sarah Chen', 'https://lh3.googleusercontent.com/aida-public/AB6AXuC-1ili5Ekj5HFDqmDS_C07NI0uF7KcTFNIVgmxDHwIiFV5uM5AsZA6z9f9L72qyU9wncb4lyEuqu-v6O4wGYJzRhmWllb99EY7enMgl15rn0U9pKe9QVPoXX4ySh3LpZth6MwN08D_TKUC-Cw7YUELNssxhgu07iRWnznDlqFOz2V6-mZE7h6R9oJUpFvjCTIz-lAbrv7lkh56WU9rsRZ3svsRgJbqfKilSWheHky-IWtu9gPNaSRGegyfwo2wYiOMhq5cjg1eN4I', 'Round Rock, TX'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, '+15125553333', 'jordan@example.com', 'Jordan Miller', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXXLtT_Y0KGbhdus9gvoU03KtjYGtJI1sBxWwN0jp4MxRk7k4majHYGbSTZzalvGsUgZ9sT7uET5iUJywJh3bMTbzorvK8VkBZxEKyDrTG-lZbKOKJURqw1H18dZibnfqpNw_g0GFJqZ2YH1alPfNjY_JTochd6Tgehor6sVFbQ5qYWH5MeOncU8kYEBwiThD-kgG-8W-9W7T_J-cV-qPiwUnMXwQ9VaaTSJfwSho11el-JOeEhFL6bQUdLyEXhCZBX1eesu67JgA', 'Austin, TX')
on conflict (id) do nothing;
