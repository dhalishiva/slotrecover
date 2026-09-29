import * as webpush from "jsr:@negrel/webpush@0.5.0";

// VAPID keys are generated once, server-side, and stored in Supabase Vault.
// They never appear in source code or logs.
// deno-lint-ignore no-explicit-any
export async function getPushServer(admin: any) {
  let { data: stored, error } = await admin.rpc("app_secret_get_or_init", { p_name: "vapid_keys" });
  if (error) throw error;
  if (!stored) {
    const keys = await webpush.generateVapidKeys({ extractable: true });
    const exported = await webpush.exportVapidKeys(keys);
    const res = await admin.rpc("app_secret_get_or_init", { p_name: "vapid_keys", p_initial_value: JSON.stringify(exported) });
    if (res.error) throw res.error;
    stored = res.data;
  }
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(stored), { extractable: false });
  const contact = Deno.env.get("SLOTRECOVER_PUSH_CONTACT") || "mailto:support@slotrecover.com";
  const appServer = await webpush.ApplicationServer.new({ contactInformation: contact, vapidKeys });
  const publicKey = await webpush.exportApplicationServerKey(vapidKeys);
  return { appServer, publicKey };
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string; actions?: { action: string; title: string }[] };

// Sends to every subscription row given; removes subscriptions the push service says are gone.
// deno-lint-ignore no-explicit-any
export async function sendPush(admin: any, appServer: any, subs: any[], payload: PushPayload) {
  let sent = 0;
  for (const sub of subs) {
    try {
      const subscriber = appServer.subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } });
      await subscriber.pushTextMessage(JSON.stringify(payload), { ttl: 6 * 3600 });
      sent++;
    } catch (e) {
      // deno-lint-ignore no-explicit-any
      const status = (e as any)?.response?.status;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", sub.id);
      else console.error("push failed", status || String(e));
    }
  }
  return sent;
}
