# Note per Claude — sisu-coach dashboard

## Architettura
Strava → webhook → Supabase Edge Function `strava-webhook` → tabella `activities`
Pagina `index.html` (GitHub Pages) → `fetch` → Edge Function `dashboard-api` (header `x-dashboard-pin`) → funzioni SQL:
- `dashboard_load()` → JSON {settings, tests, acts, plan, last}
- `dashboard_save_thresholds(patch jsonb, p_test_date date)` → aggiorna soglie + storico test
- `dashboard_save_race(race jsonb)` → aggiorna tempi obiettivo
Le funzioni SQL sono eseguibili solo da `service_role` (revocate ad anon/authenticated).

## Tabelle (schema public, RLS attiva senza policy)
- `activities` (strava_id, type, distance_m, moving_time_s, started_at, raw jsonb, laps, streams). Campi Strava: `raw->>'field'`.
- `athlete_settings` (id=1, data jsonb): ftp_bike, lthr_bike, pace_run (s/km), lthr_run, cp_run, race{date, goal_s, swim_s, t1_s, bike_s, t2_s, run_s}
- `threshold_tests` (test_date, metric, value, note) — metric: ftp_bike, lthr_bike, lthr_run, cp_run, threshold_pace_run, css_swim, hrmax
- `planned_sessions` (session_date, slot, sport[swim|bike|run|brick|strength|rest|race|other], title, duration_min, intensity, details, strava_id, status[planned|done|skipped|moved], source)
- `weekly_plans` (legacy, formati eterogenei)

## Programma di allenamento
Per aggiungere sessioni: `insert into planned_sessions (session_date, sport, title, duration_min, intensity, details, source) values (...)` con source='claude'. La dashboard le mostra subito (cerchio vuoto = pianificato).

## Modifiche alla pagina
Un solo file `index.html` (HTML+CSS+JS inline, nessuna build). Push su `main` → GitHub Pages aggiorna in 1-2 minuti.
Zone: bici Coggan (%FTP) e Friel (%LTHR); corsa Friel passo (% passo soglia) e FC, Stryd (%CP) opzionale.

## Deploy della funzione
Il sorgente è in `supabase/functions/dashboard-api/index.ts`; si pubblica con lo strumento Supabase `deploy_edge_function` (verify_jwt=false, auth via PIN).
