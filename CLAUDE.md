# Note per Claude — sisu-coach dashboard

## Architettura
Strava → webhook → Supabase Edge Function `strava-webhook` → tabella `activities`
Pagina `index.html` (GitHub Pages) → `fetch` → Edge Function `dashboard-api` (header `x-dashboard-pin`) → funzioni SQL:
- `dashboard_load()` → JSON {settings, tests, acts, plan, weeks, last}
- `dashboard_save_thresholds(patch jsonb, p_test_date date)` → aggiorna soglie + storico test
- `dashboard_save_race(race jsonb)` → aggiorna tempi obiettivo
Le funzioni SQL sono eseguibili solo da `service_role` (revocate ad anon/authenticated).

## Tabelle (schema public, RLS attiva senza policy)
- `activities` (strava_id, type, distance_m, moving_time_s, started_at, raw jsonb, laps, streams). Campi Strava: `raw->>'field'`.
- `athlete_settings` (id=1, data jsonb): ftp_bike, lthr_bike, pace_run (s/km), lthr_run, cp_run, race{date, goal_s, swim_s, t1_s, bike_s, t2_s, run_s}
- `threshold_tests` (test_date, metric, value, note) — metric: ftp_bike, lthr_bike, lthr_run, cp_run, threshold_pace_run, css_swim, hrmax
- `planned_sessions` (session_date, slot, sport[swim|bike|run|brick|strength|rest|race|other], title, duration_min, intensity, details, purpose, strava_id, status[planned|done|skipped|moved], source)
  - `details`: prosa strutturata letta dal popup (passi separati da " → " o a capo; ripetute tipo `3x8' @ 157-166 W rec 4'`; esercizi forza su righe `A1 ... | A2 ...`).
  - `purpose`: spiegazione mostrata nel popup, una riga per sezione `Etichetta: testo` (Obiettivo, Come si esegue, Recuperi, Se la giornata è no...).
- `plan_weeks` (week_start lunedì PK, kind[carico|scarico|test|transizione], label es. "Carico 2/3", focus, block, source) — etichetta mostrata accanto al titolo della settimana; per 'carico' il label "n/m" disegna la barra di progressione.
- `weekly_plans` (legacy, formati eterogenei)

## Programma di allenamento
Per aggiungere sessioni: `insert into planned_sessions (session_date, sport, title, duration_min, intensity, details, source) values (...)` con source='claude'. La dashboard le mostra subito (cerchio vuoto = pianificato); cliccando si apre il popup di dettaglio con profilo, passi, recuperi e spiegazione.
Il piano ott–dic 2026 (source='plan_q4_2026') è generato da `genera_piano_q4_2026.py` (fuori dal repo).

## Modifiche alla pagina
Un solo file `index.html` (HTML+CSS+JS inline, nessuna build). Push su `main` → GitHub Pages aggiorna in 1-2 minuti.
Zone: bici Coggan (%FTP) e Friel (%LTHR); corsa Friel passo (% passo soglia) e FC, Stryd (%CP) opzionale.

## Deploy della funzione
Il sorgente è in `supabase/functions/dashboard-api/index.ts`; si pubblica con lo strumento Supabase `deploy_edge_function` (verify_jwt=false, auth via PIN).

## Layout (richiesto da Andrea, 29/09/2026)
Ordine: settimana → calendario mensile → in fondo Soglie (FTP/passo/LTHR) e Obiettivo 5h30 affiancati. Le tabelle delle zone sono chiuse in un menu a tendina ("Mostra zone").

## Materiale (scarpe e catene) — aggiunto 29/09/2026
- Tabella `gear` (name, kind shoes|chain, sports text[], indoor null|true|false, since_date, limit_km, action_label) + storico `gear_events`.
- Km = somma distanze in `activities_dedup` (vista che scarta i doppioni Garmin/Bryton/Edge) dal `since_date`, filtrati per sport e rulli/strada.
- Rulli = VirtualRide oppure attività senza GPS (`start_latlng` vuoto). Strava non ha gear assegnato alle attività.
- `gear_status()` è inclusa in `dashboard_load()`; la pagina aggiorna con POST `?action=gear` → `dashboard_gear_update(id, date, limit, reset)`.

## intervals.icu → Garmin (corse)
Athlete i732140. API key nel Supabase Vault (`intervals_api_key`), mai nel codice.
`public.intervals_call(method, path, body jsonb)` (estensione `http`, solo service_role) chiama `https://intervals.icu` con Basic auth.
Le corse del piano (run + brick) sono eventi WORKOUT con `external_id = plan_q4_2026:<data>:<slot>`; upload con
`POST /api/v1/athlete/i732140/events/bulk?upsert=true`. intervals.icu li spedisce a Garmin Connect (7 giorni avanti) → Instinct 2 Solar.
Target FC in `% LTHR` (LTHR corsa impostata su intervals: 160); `bpm` assoluti NON sono interpretati dal parser.
Generatore: `intervals_export.py` (fuori repo) legge `piano_q4_2026.csv`.
