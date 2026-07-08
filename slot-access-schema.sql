-- Quvirl monthly slot access database schema for Supabase
-- Run this in Supabase SQL Editor before deploying the Vercel API.

create table if not exists public.quvirl_slots (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_hash text not null,
  slot_month text not null check (slot_month ~ '^\d{4}-\d{2}$'),
  status text not null default 'active' check (status in ('active', 'waitlist', 'cancelled')),
  slot_number integer,
  access_token_hash text not null,
  device_id_hash text not null,
  ip_hash text,
  user_agent_hash text,
  source text default 'site',
  reserved_for text default 'current_month',
  verified_at timestamptz not null default now(),
  auth_user_id uuid,
  created_at timestamptz not null default now()
);

alter table public.quvirl_slots add column if not exists verified_at timestamptz not null default now();
alter table public.quvirl_slots add column if not exists auth_user_id uuid;

create unique index if not exists quvirl_slots_one_email_per_month
  on public.quvirl_slots (lower(email), slot_month)
  where status in ('active', 'waitlist');

create unique index if not exists quvirl_slots_one_device_per_month
  on public.quvirl_slots (device_id_hash, slot_month)
  where status in ('active', 'waitlist');

create index if not exists quvirl_slots_month_status_idx
  on public.quvirl_slots (slot_month, status);

create index if not exists quvirl_slots_ip_month_idx
  on public.quvirl_slots (ip_hash, slot_month);

create index if not exists quvirl_slots_created_idx
  on public.quvirl_slots (created_at);

create table if not exists public.quvirl_slot_attempts (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  target_month text not null check (target_month ~ '^\d{4}-\d{2}$'),
  device_id_hash text not null,
  ip_hash text,
  user_agent_hash text,
  source text default 'site',
  created_at timestamptz not null default now()
);

create index if not exists quvirl_slot_attempts_ip_created_idx
  on public.quvirl_slot_attempts (ip_hash, created_at);

create index if not exists quvirl_slot_attempts_ip_month_idx
  on public.quvirl_slot_attempts (ip_hash, target_month);

create index if not exists quvirl_slot_attempts_email_month_idx
  on public.quvirl_slot_attempts (email_hash, target_month);

alter table public.quvirl_slots enable row level security;
alter table public.quvirl_slot_attempts enable row level security;

-- No public client reads/writes are needed. The Vercel API uses the Supabase service role key.
-- Keep SUPABASE_SERVICE_ROLE_KEY only in Vercel Environment Variables, never in frontend code.
