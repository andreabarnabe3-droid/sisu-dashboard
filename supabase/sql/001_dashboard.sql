-- Tabelle e funzioni della dashboard (già applicate al progetto kfqpazrtwhzheualsctu).
-- Vedi CLAUDE.md per la descrizione. Le funzioni sono eseguibili solo da service_role.
create table if not exists public.athlete_settings (id int primary key default 1 check (id = 1), data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.threshold_tests (id bigserial primary key, test_date date not null default current_date, metric text not null, value numeric not null, note text, created_at timestamptz not null default now());
create table if not exists public.planned_sessions (id bigserial primary key, session_date date not null, slot text default 'main', sport text not null, title text not null, duration_min int, intensity text, details text, strava_id bigint, status text not null default 'planned', source text default 'manual', created_at timestamptz not null default now());
-- dashboard_load(), dashboard_save_thresholds(jsonb, date), dashboard_save_race(jsonb): vedi migrazione "dashboard_api_functions" su Supabase.
