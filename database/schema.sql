create extension if not exists pgcrypto;

create table if not exists public.farmers (
  id uuid primary key default gen_random_uuid(),
  farmer_code text unique not null,
  name text not null,
  mobile text not null,
  village text not null,
  district text not null default 'Indore',
  preferred_language text not null default 'Hindi',
  latitude double precision,
  longitude double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.centres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  village text,
  latitude double precision not null,
  longitude double precision not null,
  capacity_quintals numeric not null default 500,
  available_quintals numeric not null default 250,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  crop text not null,
  booking_date date not null,
  quantity_quintals numeric not null check (quantity_quintals > 0),
  status text not null default 'Booking confirmed',
  created_at timestamptz not null default now()
);

create table if not exists public.split_allocations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  centre_id uuid not null references public.centres(id),
  quantity_quintals numeric not null check (quantity_quintals > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.weather_records (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id),
  forecast_for timestamptz not null,
  condition text not null,
  temperature_c numeric,
  humidity_percent numeric,
  rainfall_probability numeric,
  rainfall_mm numeric,
  severity text not null default 'low',
  source text not null default 'Seeded demo data',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id),
  booking_id uuid references public.bookings(id) on delete set null,
  type text not null default 'system',
  title text not null,
  message text not null,
  severity text not null default 'normal',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

-- This prototype accesses the database only through the Express API using the
-- Supabase service-role key stored on the server. Do not expose that key in a browser.
-- For a production deployment, enable RLS and add least-privilege policies/authentication.
