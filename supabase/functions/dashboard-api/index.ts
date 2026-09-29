// dashboard-api: dati per la dashboard statica (GitHub Pages).
// Autenticazione: header x-dashboard-pin == secret DASHBOARD_PIN (min 8 caratteri).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PIN = Deno.env.get("DASHBOARD_PIN") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("DASHBOARD_ORIGINS") ?? "*").split(",").map((s) => s.trim());
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes("*") ? "*" : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type, x-dashboard-pin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (PIN.length < 8) return json(req, { error: "pin_not_configured", message: "Imposta il secret DASHBOARD_PIN (almeno 8 caratteri) su Supabase." }, 503);
  const given = req.headers.get("x-dashboard-pin") ?? "";
  if (!safeEqual(given, PIN)) {
    await new Promise((r) => setTimeout(r, 800));
    return json(req, { error: "bad_pin", message: "PIN non valido." }, 401);
  }

  const action = new URL(req.url).searchParams.get("action") ?? "load";
  try {
    if (req.method === "GET" && action === "load") {
      const { data, error } = await supabase.rpc("dashboard_load");
      if (error) throw error;
      return json(req, data);
    }
    if (req.method === "POST" && action === "thresholds") {
      const body = await req.json();
      if (!body || typeof body.patch !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(body.test_date ?? "")) {
        return json(req, { error: "bad_request", message: "patch e test_date obbligatori." }, 400);
      }
      const { data, error } = await supabase.rpc("dashboard_save_thresholds", { patch: body.patch, p_test_date: body.test_date });
      if (error) throw error;
      return json(req, { settings: data });
    }
    if (req.method === "POST" && action === "race") {
      const body = await req.json();
      const { data, error } = await supabase.rpc("dashboard_save_race", { race: body?.race ?? {} });
      if (error) throw error;
      return json(req, { settings: data });
    }
    if (req.method === "POST" && action === "gear") {
      const b = await req.json();
      const id = Number(b?.id);
      if (!Number.isInteger(id)) return json(req, { error: "bad_request", message: "id obbligatorio." }, 400);
      const date = typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
      const limit = b?.limit_km == null ? null : Number(b.limit_km);
      const { data, error } = await supabase.rpc("dashboard_gear_update", { p_id: id, p_date: date, p_limit: limit, p_reset: !!b?.reset });
      if (error) throw error;
      return json(req, { gear: data });
    }
    return json(req, { error: "not_found", message: "Azione sconosciuta." }, 404);
  } catch (e) {
    console.error("dashboard-api error", e);
    return json(req, { error: "server_error", message: String((e as Error)?.message ?? e) }, 500);
  }
});
