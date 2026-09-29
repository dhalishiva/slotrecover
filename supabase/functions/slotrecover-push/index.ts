import { createClient } from "npm:@supabase/supabase-js@2";
import { getPushServer, sendPush } from "./push.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "public_key");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // The VAPID public key is public by design; no user needed.
    if (action === "public_key") {
      const { publicKey } = await getPushServer(admin);
      return respond({ ok: true, public_key: publicKey });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "missing_authorization" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return respond({ error: "unauthorized" }, 401);

    const { appServer } = await getPushServer(admin);

    if (action === "test") {
      const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userData.user.id);
      const sent = await sendPush(admin, appServer, subs || [], {
        title: "Notifications are on",
        body: "You'll hear from SlotRecover when a confirmation email goes out.",
        url: "/",
        tag: "slotrecover-test",
      });
      return respond({ ok: true, sent, devices: (subs || []).length });
    }

    return respond({ error: "unsupported_action" }, 400);
  } catch (error) {
    return respond({ error: "request_failed", message: error instanceof Error ? error.message : String(error) }, 400);
  }
});
