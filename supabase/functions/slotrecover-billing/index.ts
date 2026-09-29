
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// Strip whitespace, newlines and wrapping quotes that often sneak in when
// secrets are pasted into the dashboard/CLI.
function normalizeSecret(raw: string | undefined | null) {
  if (!raw) return "";
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

// Safe, non-revealing description of a secret value.
function describeSecret(raw: string | undefined | null, isKeyId = false) {
  const present = typeof raw === "string" && raw.length > 0;
  const value = raw || "";
  const normalized = normalizeSecret(value);
  const info: Record<string, unknown> = {
    present,
    raw_length: value.length,
    normalized_length: normalized.length,
    had_surrounding_whitespace: value !== value.trim(),
    had_internal_whitespace: /\s/.test(normalized),
    had_wrapping_quotes: /^\s*["']/.test(value) && /["']\s*$/.test(value),
  };
  if (isKeyId) {
    info.prefix = normalized.startsWith("rzp_test_")
      ? "rzp_test_"
      : normalized.startsWith("rzp_live_")
      ? "rzp_live_"
      : "unexpected";
  }
  return info;
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function razorpayRaw(path: string, keyId: string, keySecret: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", "Basic " + btoa(keyId + ":" + keySecret));
  headers.set("Content-Type", "application/json");
  const res = await fetch("https://api.razorpay.com" + path, { ...init, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { res, data };
}

async function razorpayFetch(path: string, keyId: string, keySecret: string, init: RequestInit = {}) {
  const { res, data } = await razorpayRaw(path, keyId, keySecret, init);
  if (!res.ok) {
    const details = data?.error || data || {};
    const message =
      details?.description ||
      details?.reason ||
      details?.code ||
      details?.raw ||
      (typeof details === "string" ? details : JSON.stringify(details)) ||
      "Razorpay request failed";
    console.error("Razorpay API error", { path, status: res.status, details });
    throw new Error("Razorpay " + res.status + ": " + message);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "missing_authorization" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");

    // TEMPORARY diagnostic: reports only non-sensitive metadata about the
    // Razorpay secrets and whether Razorpay accepts them. Never returns values.
    if (action === "diagnose_razorpay") {
      const rawId = Deno.env.get("RAZORPAY_KEY_ID");
      const rawSecret = Deno.env.get("RAZORPAY_KEY_SECRET");
      const id = normalizeSecret(rawId);
      const secret = normalizeSecret(rawSecret);
      const result: Record<string, unknown> = {
        key_id: describeSecret(rawId, true),
        key_secret: describeSecret(rawSecret),
        webhook_secret_present: Boolean(Deno.env.get("RAZORPAY_WEBHOOK_SECRET")),
      };
      if (id && secret) {
        const probe = await razorpayRaw("/v1/plans?count=1", id, secret, { method: "GET" });
        result.probe_normalized = {
          status: probe.res.status,
          error_code: probe.data?.error?.code || null,
          error_description: probe.data?.error?.description || probe.data?.raw || null,
        };
        if (rawId !== id || rawSecret !== secret) {
          const rawProbe = await razorpayRaw("/v1/plans?count=1", rawId || "", rawSecret || "", { method: "GET" });
          result.probe_raw = { status: rawProbe.res.status };
        }
      }
      return respond({ ok: true, diagnostics: result });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return respond({ error: "unauthorized" }, 401);

    const user = userData.user;
    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

    const { data: billing, error: billingError } = await admin
      .from("billing_accounts")
      .select("user_id,status,trial_started_at,trial_ends_at,razorpay_subscription_id,razorpay_payment_id,authorization_verified_at,current_period_start,current_period_end,cancel_at_period_end,plan_id,billing_plans(id,code,name,amount_paise,currency,period,interval_count,trial_days,razorpay_plan_id,test_mode)")
      .eq("user_id", user.id)
      .single();

    if (billingError || !billing) throw billingError || new Error("Billing account not found");

    if (action === "status") {
      return respond({ ok: true, billing });
    }

    const keyId = normalizeSecret(Deno.env.get("RAZORPAY_KEY_ID"));
    const keySecret = normalizeSecret(Deno.env.get("RAZORPAY_KEY_SECRET"));
    if (!keyId || !keySecret) {
      return respond({
        error: "razorpay_not_configured",
        message: "Razorpay test credentials have not been added to Edge Function secrets yet.",
      }, 503);
    }

    if (action === "create_subscription") {
      let razorpayPlanId = billing.billing_plans?.razorpay_plan_id;

      if (!razorpayPlanId) {
        const createdPlan = await razorpayFetch("/v1/plans", keyId, keySecret, {
          method: "POST",
          body: JSON.stringify({
            period: billing.billing_plans.period,
            interval: billing.billing_plans.interval_count,
            item: {
              name: billing.billing_plans.name,
              amount: billing.billing_plans.amount_paise,
              currency: billing.billing_plans.currency,
              description: "SlotRecover recurring subscription",
            },
            notes: { source: "slotrecover" },
          }),
        });
        razorpayPlanId = createdPlan.id;

        await admin
          .from("billing_plans")
          .update({ razorpay_plan_id: razorpayPlanId, updated_at: new Date().toISOString() })
          .eq("id", billing.plan_id);
      }

      let subscriptionId = billing.razorpay_subscription_id;

      if (!subscriptionId) {
        const startAt = Math.floor(new Date(billing.trial_ends_at).getTime() / 1000);
        const subscription = await razorpayFetch("/v1/subscriptions", keyId, keySecret, {
          method: "POST",
          body: JSON.stringify({
            plan_id: razorpayPlanId,
            total_count: billing.billing_plans.period === "yearly" ? 10 : 120,
            quantity: 1,
            customer_notify: 0,
            start_at: startAt,
            notes: {
              slotrecover_user_id: user.id,
              slotrecover_plan_code: billing.billing_plans.code,
            },
          }),
        });
        subscriptionId = subscription.id;

        await admin
          .from("billing_accounts")
          .update({
            razorpay_subscription_id: subscriptionId,
            status: "authorization_pending",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      }

      return respond({
        ok: true,
        key_id: keyId,
        subscription_id: subscriptionId,
        name: "Dhali Services",
        description: billing.billing_plans.name + " · 7-day free trial",
        amount_paise: billing.billing_plans.amount_paise,
        currency: billing.billing_plans.currency,
        trial_ends_at: billing.trial_ends_at,
        prefill: { email: user.email || "" },
      });
    }

    if (action === "verify_checkout") {
      const paymentId = String(body?.razorpay_payment_id || "");
      const subscriptionId = String(body?.razorpay_subscription_id || "");
      const signature = String(body?.razorpay_signature || "");

      if (!paymentId || !subscriptionId || !signature) {
        return respond({ error: "missing_checkout_fields" }, 400);
      }
      if (subscriptionId !== billing.razorpay_subscription_id) {
        return respond({ error: "subscription_mismatch" }, 400);
      }

      const expected = await hmacHex(keySecret, paymentId + "|" + subscriptionId);
      if (expected !== signature) {
        return respond({ error: "signature_verification_failed" }, 400);
      }

      await admin
        .from("billing_accounts")
        .update({
          status: "authenticated",
          razorpay_payment_id: paymentId,
          authorization_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_event: "checkout.authorization_verified",
          last_event_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await admin.from("billing_events").insert({
        user_id: user.id,
        razorpay_subscription_id: subscriptionId,
        event_type: "checkout.authorization_verified",
        payload: {
          razorpay_payment_id: paymentId,
          razorpay_subscription_id: subscriptionId,
        },
      });

      return respond({ ok: true, status: "authenticated" });
    }

    return respond({ error: "unsupported_action" }, 400);
  } catch (error) {
    return respond({
      error: "request_failed",
      message: error instanceof Error ? error.message : String(error),
    }, 400);
  }
});
