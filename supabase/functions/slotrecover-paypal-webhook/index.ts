// Receives PayPal subscription webhooks (renewals, failed payments, cancellations).
// Each event is verified with PayPal, then the subscription is re-read from PayPal and copied
// onto the matching billing account, so the event body itself is never trusted for state.
import { createClient } from "npm:@supabase/supabase-js@2";
import { applySubscription, ensureWebhook, getSubscription, paypal, paypalConfigured } from "./paypal.ts";

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  if (!paypalConfigured()) return respond({ error: "paypal_not_configured" }, 503);

  const raw = await req.text();
  let event: any;
  try { event = JSON.parse(raw); } catch { return respond({ error: "invalid_json" }, 400); }

  try {
    const webhookId = await ensureWebhook(false);
    if (!webhookId) return respond({ error: "webhook_not_registered" }, 503);

    const h = (name: string) => JSON.stringify(req.headers.get(name) || "");
    // The raw event is spliced in unchanged: re-serialising it can break the signature check.
    const verifyBody = `{"auth_algo":${h("paypal-auth-algo")},"cert_url":${h("paypal-cert-url")},` +
      `"transmission_id":${h("paypal-transmission-id")},"transmission_sig":${h("paypal-transmission-sig")},` +
      `"transmission_time":${h("paypal-transmission-time")},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${raw}}`;
    const { data: verdict } = await paypal("/v1/notifications/verify-webhook-signature", { body: verifyBody });
    if (verdict?.verification_status !== "SUCCESS") return respond({ error: "invalid_signature" }, 401);

    const type = String(event?.event_type || "unknown");
    const resource = event?.resource || {};
    const subscriptionId: string | null = type.startsWith("BILLING.SUBSCRIPTION.")
      ? resource.id || null
      : resource.billing_agreement_id || null;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    let userId: string | null = null;
    if (subscriptionId) {
      const sub = await getSubscription(subscriptionId);
      const applied = await applySubscription(admin, sub, type);
      userId = applied?.user_id || null;
    }

    await admin.from("billing_events").insert({
      user_id: userId,
      paypal_subscription_id: subscriptionId,
      event_type: type,
      payload: event,
    });

    return respond({ ok: true });
  } catch (error) {
    console.error("PayPal webhook failed", error instanceof Error ? error.message : String(error));
    // 500 makes PayPal retry later.
    return respond({ error: "request_failed" }, 500);
  }
});
