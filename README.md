# Sisu Coach · Alghero 2027

Dashboard di allenamento per IRONMAN 70.3 Alghero (30 maggio 2027).

- **Sito**: pagina statica `index.html` pubblicata con GitHub Pages.
- **Dati**: Supabase (progetto `kfqpazrtwhzheualsctu`), letti tramite la Edge Function `dashboard-api` protetta da PIN.
- **Strava**: le attività arrivano in automatico via webhook (Edge Function `strava-webhook`).

Nessun segreto è salvato in questo repository. Il PIN è un secret di Supabase (`DASHBOARD_PIN`) e sul browser resta solo nel dispositivo dove lo inserisci.
