// PayPal Subscriptions helpers shared by slotrecover-billing and slotrecover-paypal-webhook.
// Keep the two copies identical (supabase/functions/*/paypal.ts).
//
// Secrets (Supabase Edge Function secrets, never in code):
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET  – from a PayPal REST app
//   PAYPAL_ENV                              – "live" (default) or "sandbox"
//   PAYPAL_WEBHOOK_ID (optional)            – otherwise found/created automatically

export const PRODUCT_ID = "SLOTRECOVER";
export const BRAND_NAME = "Shiva Dhali Services";

export const WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.RE-ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
];

function clean(raw: string | undefined | null) {
  if (!raw) return "";
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
  return v;
}

export function paypalEnv(): "live" | "sandbox" {
  return clean(Deno.env.get("PAYPAL_ENV")).toLowerCase() === "sandbox" ? "sandbox" : "live";
}

// The REST app's client ID is public (the browser SDK needs it); the secret never leaves the server.
export function paypalClientId() {
  return clean(Deno.env.get("PAYPAL_CLIENT_ID"));
}

export function paypalConfigured() {
  return Boolean(clean(Deno.env.get("PAYPAL_CLIENT_ID")) && clean(Deno.env.get("PAYPAL_CLIENT_SECRET")));
}

const apiBase = () => (paypalEnv() === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");

let tokenCache: { token: string; expires: number } | null = null;

async function accessToken() {
  if (tokenCache && tokenCache.expires > Date.now() + 60_000) return tokenCache.token;
  const id = clean(Deno.env.get("PAYPAL_CLIENT_ID"));
  const secret = clean(Deno.env.get("PAYPAL_CLIENT_SECRET"));
  const res = await fetch(apiBase() + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(id + ":" + secret), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    // Never log the credentials themselves.
    console.error("PayPal auth failed", { status: res.status, error: data?.error, env: paypalEnv() });
    throw new Error(res.status === 401
      ? "PayPal rejected the API credentials. Check PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_ENV."
      : "PayPal sign-in failed (" + res.status + ").");
  }
  tokenCache = { token: data.access_token, expires: Date.now() + Number(data.expires_in || 300) * 1000 };
  return tokenCache.token;
}

// Calls the PayPal REST API. `body` may be an object or an already-serialised string.
export async function paypal(path: string, opts: { method?: string; body?: unknown; requestId?: string; allow?: number[] } = {}) {
  const headers: Record<string, string> = {
    Authorization: "Bearer " + (await accessToken()),
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;
  const res = await fetch(apiBase() + path, {
    method: opts.method || (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok && !(opts.allow || []).includes(res.status)) {
    const detail = data?.details?.[0]?.description || data?.details?.[0]?.issue || data?.message || data?.name || "request failed";
    console.error("PayPal API error", { path, status: res.status, name: data?.name, debug_id: data?.debug_id, details: data?.details });
    throw new Error("PayPal " + res.status + ": " + detail);
  }
  return { status: res.status, data };
}

// The PayPal plan for one of our billing_plans rows, created on first use.
export async function ensurePlan(admin: any, plan: any): Promise<string> {
  const column = paypalEnv() === "sandbox" ? "paypal_sandbox_plan_id" : "paypal_plan_id";
  if (plan[column]) return plan[column];

  await paypal("/v1/catalogs/products", {
    body: { id: PRODUCT_ID, name: "SlotRecover", description: "Appointment confirmation and cancellation recovery", type: "SERVICE", category: "SOFTWARE" },
    requestId: "slotrecover-product-v1",
    allow: [409, 422], // already exists
  });

  const months = plan.period === "quarterly" ? 3 : 1;
  const unit = plan.period === "yearly" ? "YEAR" : plan.period === "weekly" ? "WEEK" : "MONTH";
  const { data } = await paypal("/v1/billing/plans", {
    requestId: `slotrecover-plan-${plan.code}-${plan.amount_paise}-${plan.currency}`,
    body: {
      product_id: PRODUCT_ID,
      name: plan.name,
      description: "SlotRecover subscription",
      status: "ACTIVE",
      billing_cycles: [{
        frequency: { interval_unit: unit, interval_count: (plan.interval_count || 1) * months },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: (plan.amount_paise / 100).toFixed(2), currency_code: plan.currency } },
      }],
      payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: "CANCEL", payment_failure_threshold: 2 },
    },
  });
  if (!data?.id) throw new Error("PayPal did not return a plan id.");
  await admin.from("billing_plans").update({ [column]: data.id, updated_at: new Date().toISOString() }).eq("id", plan.id);
  return data.id;
}

export function webhookUrl() {
  return Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "") + "/functions/v1/slotrecover-paypal-webhook";
}

let webhookIdCache = "";

// Finds (or, when `create` is set, registers) the webhook pointing at our webhook function.
export async function ensureWebhook(create: boolean): Promise<string> {
  const fixed = clean(Deno.env.get("PAYPAL_WEBHOOK_ID"));
  if (fixed) return fixed;
  if (webhookIdCache) return webhookIdCache;
  const url = webhookUrl();
  const find = async () => {
    const { data } = await paypal("/v1/notifications/webhooks");
    return (data?.webhooks || []).find((w: any) => String(w.url).replace(/\/$/, "") === url)?.id || "";
  };
  let id = await find();
  if (!id && create) {
    const { status, data } = await paypal("/v1/notifications/webhooks", {
      body: { url, event_types: WEBHOOK_EVENTS.map((name) => ({ name })) },
      allow: [400, 409, 422],
    });
    id = status < 300 ? data?.id : await find(); // created elsewhere at the same time
  }
  if (id) webhookIdCache = id;
  return id;
}

export function getSubscription(id: string) {
  return paypal("/v1/billing/subscriptions/" + encodeURIComponent(id)).then((r) => r.data);
}

function mapStatus(status: string) {
  switch (status) {
    case "ACTIVE": return "active";
    case "APPROVED": return "authenticated";
    case "SUSPENDED": return "past_due"; // payments failed (or paused in PayPal)
    case "CANCELLED": return "cancelled";
    case "EXPIRED": return "expired";
    default: return null; // APPROVAL_PENDING: customer hasn't approved yet
  }
}

// Copies a PayPal subscription's state onto the billing account that owns it.
// Only the account whose current paypal_subscription_id matches is touched, so events for an
// abandoned or replaced subscription change nothing.
export async function applySubscription(admin: any, sub: any, source: string) {
  const { data: account } = await admin.from("billing_accounts")
    .select("user_id,authorization_verified_at")
    .eq("paypal_subscription_id", sub.id).maybeSingle();
  if (!account) return null;
  if (sub.custom_id && sub.custom_id !== account.user_id) {
    console.error("PayPal subscription custom_id mismatch", { subscription: sub.id });
    return null;
  }
  const now = new Date().toISOString();
  const status = mapStatus(String(sub.status || ""));
  const updates: Record<string, unknown> = { payment_provider: "paypal", last_event: source, last_event_at: now, updated_at: now };
  if (status) updates.status = status;
  if (status === "active" || status === "authenticated") {
    updates.authorization_verified_at = account.authorization_verified_at || now;
    updates.cancel_at_period_end = false;
  }
  const next = sub.billing_info?.next_billing_time;
  const last = sub.billing_info?.last_payment?.time;
  if (next && status !== "cancelled") updates.current_period_end = next;
  if (last) updates.current_period_start = last;
  await admin.from("billing_accounts").update(updates).eq("user_id", account.user_id);
  return { user_id: account.user_id as string, status: (status || null) as string | null };
}
