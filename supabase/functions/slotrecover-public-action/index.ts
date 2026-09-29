
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const uuidOrNull = (v: unknown) =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const type = String(body?.type || "");
    const token = String(body?.token || "");
    const action = String(body?.action || "");
    const staffId = uuidOrNull(body?.staff_id);
    if (!token || !action) return respond({ error: "missing_token_or_action" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    if (type === "appointment" && (action === "confirm" || action === "cancel")) {
      const { data, error } = await admin.rpc("handle_appointment_response", { p_token: token, p_action: action });
      if (error) throw error;
      return respond(data);
    }

    if (type === "appointment" && action === "availability") {
      const date = String(body?.date || "");
      const { data, error } = await admin.rpc("get_reschedule_availability", { p_token: token, p_date: date, p_staff_id: staffId });
      if (error) throw error;
      return respond(data);
    }

    if (type === "appointment" && action === "reschedule") {
      const startAt = String(body?.start_at || "");
      const { data, error } = await admin.rpc("handle_appointment_reschedule", { p_token: token, p_start_at: startAt, p_staff_id: staffId });
      if (error) throw error;
      return respond(data, data?.ok === false ? 409 : 200);
    }

    if (type === "appointment" && action === "join_waitlist") {
      const { data, error } = await admin.rpc("join_waitlist_from_appointment", {
        p_token: token,
        p_window_start: String(body?.window_start || ""),
        p_window_end: String(body?.window_end || ""),
        p_staff_id: staffId,
      });
      if (error) throw error;
      return respond(data);
    }

    if (type === "recovery" && (action === "accept" || action === "decline")) {
      const { data, error } = await admin.rpc("handle_recovery_offer", { p_token: token, p_action: action });
      if (error) throw error;
      return respond(data, data?.ok === false ? 409 : 200);
    }

    return respond({ error: "unsupported_type_or_action" }, 400);
  } catch (error) {
    return respond({ error: "request_failed", message: error instanceof Error ? error.message : String(error) }, 400);
  }
});
