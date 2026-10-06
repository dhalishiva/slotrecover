
import { createClient } from "npm:@supabase/supabase-js@2";
import { applySubscription, BRAND_NAME, ensurePlan, ensureWebhook, getSubscription, paypal, paypalConfigured } from "./paypal.ts";

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

const PLAN_FIELDS = "id,code,name,amount_paise,currency,period,interval_count,trial_days,paypal_plan_id,paypal_sandbox_plan_id,test_mode,plan_group";

// Where PayPal sends the customer back. Only our own sites are allowed.
function appOrigin(req: Request) {
  const origin = req.headers.get("origin") || "";
  if (/^https:\/\/(www\.)?slotrecover\.pro$/.test(origin) || /^https:\/\/slotrecover[a-z0-9-]*\.vercel\.app$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
    return origin;
  }
  return "https://www.slotrecover.pro";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "missing_authorization" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");

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

    const { data: billingRow, error: billingError } = await admin
      .from("billing_accounts")
      .select(`user_id,status,trial_started_at,trial_ends_at,payment_provider,paypal_subscription_id,razorpay_subscription_id,authorization_verified_at,current_period_start,current_period_end,cancel_at_period_end,plan_id,billing_plans(${PLAN_FIELDS})`)
      .eq("user_id", user.id)
      .single();

    if (billingError || !billingRow) throw billingError || new Error("Billing account not found");
    const billing: any = billingRow;

    if (action === "status") {
      const { billing_plans, ...rest } = billing as any;
      const { paypal_plan_id: _a, paypal_sandbox_plan_id: _b, ...plan } = billing_plans || {};
      return respond({ ok: true, billing: { ...rest, billing_plans: billing_plans ? plan : null } });
    }

    if (!paypalConfigured()) {
      return respond({
        error: "paypal_not_configured",
        message: "Payments are being set up. Please try again shortly.",
      }, 503);
    }

    if (action === "create_subscription") {
      const paying = ["active", "authenticated"].includes(billing.status) && billing.paypal_subscription_id;
      if (paying) {
        return respond({ error: "already_subscribed", message: "Your subscription is already active." }, 400);
      }

      // The plan the user picked (monthly, 6 months or yearly).
      const planCode = String(body?.plan_code || "");
      if (planCode && planCode !== billing.billing_plans?.code) {
        const { data: chosen } = await admin.from("billing_plans").select(PLAN_FIELDS)
          .eq("code", planCode).eq("active", true).eq("plan_group", billing.billing_plans?.plan_group || "standard").maybeSingle();
        if (chosen) {
          await admin.from("billing_accounts").update({ plan_id: chosen.id, updated_at: new Date().toISOString() }).eq("user_id", user.id);
          billing.plan_id = chosen.id;
          (billing as any).billing_plans = chosen;
        }
      }
      const plan: any = billing.billing_plans;
      if (!plan) throw new Error("No plan selected.");

      const paypalPlanId = await ensurePlan(admin, plan);

      // Make sure PayPal will tell us about renewals and cancellations. Checkout still works
      // without it (the return page confirms the subscription), so don't block on a failure.
      await ensureWebhook(true).catch((e) => console.error("PayPal webhook setup failed", String(e?.message || e)));

      // A suspended subscription (failed payments) is replaced by the new one.
      if (billing.paypal_subscription_id && billing.status === "past_due") {
        await paypal("/v1/billing/subscriptions/" + billing.paypal_subscription_id + "/cancel", {
          body: { reason: "Replaced by a new SlotRecover subscription" },
          allow: [404, 422],
        }).catch(() => {});
      }

      const origin = appOrigin(req);
      // Upgrading starts the paid plan straight away: the first charge happens on approval.
      const { data: sub } = await paypal("/v1/billing/subscriptions", {
        requestId: crypto.randomUUID(),
        body: {
          plan_id: paypalPlanId,
          custom_id: user.id,
          ...(user.email ? { subscriber: { email_address: user.email } } : {}),
          application_context: {
            brand_name: BRAND_NAME,
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            payment_method: { payer_selected: "PAYPAL", payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED" },
            return_url: origin + "/app?paypal=return",
            cancel_url: origin + "/app?paypal=cancel",
          },
        },
      });
      const approveUrl = (sub?.links || []).find((l: any) => l.rel === "approve")?.href;
      if (!sub?.id || !approveUrl) throw new Error("PayPal did not return a checkout link.");

      // Remember the pending subscription. Access doesn't change until it is approved.
      await admin.from("billing_accounts").update({
        paypal_subscription_id: sub.id,
        payment_provider: "paypal",
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      await admin.from("billing_events").insert({
        user_id: user.id,
        paypal_subscription_id: sub.id,
        event_type: "app.checkout_started",
        payload: { plan_code: plan.code, paypal_plan_id: paypalPlanId },
      });

      return respond({ ok: true, subscription_id: sub.id, approve_url: approveUrl });
    }

    if (action === "verify_checkout") {
      const subscriptionId = String(body?.subscription_id || "");
      if (!subscriptionId) return respond({ error: "missing_subscription", message: "PayPal didn't return a subscription." }, 400);
      if (subscriptionId !== billing.paypal_subscription_id) {
        return respond({ error: "subscription_mismatch", message: "This PayPal subscription doesn't belong to your account." }, 400);
      }

      const sub = await getSubscription(subscriptionId);
      if (sub?.custom_id !== user.id) {
        return respond({ error: "subscription_mismatch", message: "This PayPal subscription doesn't belong to your account." }, 400);
      }
      if (!["ACTIVE", "APPROVED"].includes(String(sub?.status))) {
        return respond({
          error: "not_approved",
          message: sub?.status === "APPROVAL_PENDING"
            ? "The PayPal checkout wasn't completed, so nothing was charged."
            : "PayPal reports this subscription as " + String(sub?.status || "unknown").toLowerCase() + ".",
        }, 400);
      }

      const applied = await applySubscription(admin, sub, "checkout.approved");
      await admin.from("billing_events").insert({
        user_id: user.id,
        paypal_subscription_id: subscriptionId,
        event_type: "checkout.approved",
        payload: { status: sub.status, plan_id: sub.plan_id, next_billing_time: sub.billing_info?.next_billing_time || null },
      });

      return respond({ ok: true, status: applied?.status || "active" });
    }

    if (action === "cancel_subscription") {
      const subscriptionId = billing.paypal_subscription_id;
      if (!subscriptionId || billing.payment_provider !== "paypal" || ["cancelled", "expired"].includes(billing.status)) {
        return respond({ error: "no_active_subscription", message: "There is no active subscription to cancel." }, 400);
      }

      const current = await getSubscription(subscriptionId);
      const ppStatus = String(current?.status || "");
      if (["ACTIVE", "SUSPENDED", "APPROVED"].includes(ppStatus)) {
        await paypal("/v1/billing/subscriptions/" + subscriptionId + "/cancel", {
          body: { reason: "Cancelled by the customer in SlotRecover" },
        });
      }

      // PayPal stops future charges at once; access continues to the end of the paid period.
      const now = new Date().toISOString();
      const accessUntil = current?.billing_info?.next_billing_time || billing.current_period_end || billing.trial_ends_at;
      await admin.from("billing_accounts").update({
        status: "cancelled",
        cancel_at_period_end: false,
        current_period_end: accessUntil,
        last_event: "app.cancel_requested",
        last_event_at: now,
        updated_at: now,
      }).eq("user_id", user.id);

      await admin.from("billing_events").insert({
        user_id: user.id,
        paypal_subscription_id: subscriptionId,
        event_type: "app.cancel_requested",
        payload: { paypal_status_before: ppStatus, access_until: accessUntil },
      });

      return respond({ ok: true, access_until: accessUntil, immediate: false });
    }

    return respond({ error: "unsupported_action" }, 400);
  } catch (error) {
    console.error("billing error", error instanceof Error ? error.message : String(error));
    return respond({
      error: "request_failed",
      message: error instanceof Error ? error.message : String(error),
    }, 400);
  }
});
