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
Lunedì = "Arrampicata + forza dita e tirata" (trave, pinch block, trazioni zavorrate, blocchi, antagonisti; solo parte alta), richiesto da Andrea 12/10/2026. Progressione: ottobre introduzione → fine ott forza massimale → fine nov forza + potenza; scarico = metà serie.

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
Target FC in `% LTHR` (LTHR corsa impostata su intervals: 157, FC max 180); `bpm` assoluti NON sono interpretati dal parser.
Target corsa allineati alle zone Friel: facile = Z2 85-89% LTHR (≤140 bpm, deciso da Andrea 06/10/2026), medio 92-96%, sotto-soglia 95-98%.
Generatore: `intervals_export.py` (fuori repo) legge `piano_q4_2026.csv`.

## Target 5h30 sotto le soglie (10/10/2026)
Calcolati in pagina da `raceTargets()`: bici da staffetta 2026 (2:50:42 a NP 170 W, potenza ~ v^2,5, IF 0,80–0,85); corsa = passo gara / 1,08–1,12; CP scalata col passo; FC in gara come % LTHR (bici 85–91%, corsa 88–94%). Si aggiornano coi tempi della sezione Obiettivo.

## Barra "Oggi" nell'Obiettivo (10/10/2026)
`projectionNow()`: nuoto = passo medio delle ultime 4 nuotate in `acts` (finestra 180 giorni), bici = `raceTargets().bikeProj` da FTP attuale a IF 0,82, corsa = passo soglia × 1,10, T1/T2 dall'obiettivo. Le due barre usano la stessa scala.

## Modifiche dirette al piano (23/10/2026)
Il piano in `planned_sessions` e gli eventi intervals sono stati modificati direttamente nel DB, NON tramite `genera_piano_q4_2026.py`/`piano_q4_2026.csv` (che ora sono superati: non rilanciarli senza riallineare). Modifiche: lunghi corsa 1/11, 8/11, 29/11, 6/12 con finale medio; pulite le note "Era ..."; 14/11 durability 178-190 W; settimane 21/12 e 28/12 diventate carico "ferie" (Andrea in ferie 23/12-6/1); piano esteso al 7/1/2027 con mini-scarico 4-6/1 e TEST FTP giovedì 7/1 (spostato dal 30/12).

## Materiale: unità km/minuti (26/10/2026)
`gear.unit` = 'km' | 'min'; `limit_km` contiene il limite nell'unità scelta. `gear_status()` restituisce sia `km` sia `minutes`.
Catena rulli in minuti (limite 900 min, richiesto da Andrea): sui rulli i km sono virtuali (MyWhoosh). Oliatura rulli reale 23/10/2026; l'evento del 26/10 è marcato 'Annullata' (le DELETE via MCP vengono bloccate).

## Nuoto e palestra (28/10/2026, deciso con Andrea)
- Regola: mai nuoto e palestra parte alta nello stesso giorno. Parte alta (push-up, military press, face pull; niente rematore) il lunedì con l'arrampicata; gambe e core il giovedì a pranzo; nuoto giovedì sera e venerdì.
- Ripresa nuoto (ultime nuotate 7-11/08/2026, max 726 m a 2:51/100): 30/10 900 m → 1000-1300 m fino al 19/11, solo facile/tecnica (12/11 5x100 ritmo medio). TEST CSS spostato a venerdì 27/11 (il 29/10 è 'moved'). Retest 17/12 invariato.
