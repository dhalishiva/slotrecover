
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";
import { getPushServer, sendPush } from "./push.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// Format appointment times in the practice's own timezone (e.g. "Oct 1, 2026, 9:00 AM EDT").
function formatStart(iso: string, timeZone?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  try {
    return new Date(iso).toLocaleString("en-US", { ...opts, timeZone: timeZone || "UTC", timeZoneName: "short" } as Intl.DateTimeFormatOptions);
  } catch {
    return new Date(iso).toLocaleString("en-US", { ...opts, timeZone: "UTC" }) + " UTC";
  }
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function noteHtml(note?: string | null) {
  if (!note) return "";
  return '<p style="margin-top:18px;padding:12px;border-radius:8px;background:#f6f7f9;color:#444;font-size:14px"><strong>Note:</strong> ' + esc(note).replace(/\n/g, "<br>") + '</p>';
}

function formatPrice(cents: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
  } catch {
    return "$" + ((cents || 0) / 100).toFixed(0);
  }
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("SLOTRECOVER_CRON_SECRET");
  if (!expected || req.headers.get("x-slotrecover-secret") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const smtpHost = Deno.env.get("SLOTRECOVER_SMTP_HOST");
  const smtpPort = Number(Deno.env.get("SLOTRECOVER_SMTP_PORT") || "587");
  const smtpUser = Deno.env.get("SLOTRECOVER_SMTP_USER");
  const smtpPass = Deno.env.get("SLOTRECOVER_SMTP_PASS");
  const smtpFrom = Deno.env.get("SLOTRECOVER_SMTP_FROM");
  const appUrl = Deno.env.get("SLOTRECOVER_APP_URL") || "https://slotrecover.vercel.app";
  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) return json({ error: "smtp_not_configured" }, 503);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  let sentConfirmations = 0;
  const notifyQueue: { practice_id: string; title: string; body: string; url: string; tag: string }[] = [];
  let sentOffers = 0;
  const errors: string[] = [];
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: appointments, error: apptError } = await admin
    .from("appointments")
    .select("id,public_token,start_at,practice_id,clients(first_name,last_name,email),services(name),practices(name,timezone,client_note),staff(name)")
    .eq("status", "booked")
    .gt("start_at", now.toISOString())
    .lte("start_at", horizon.toISOString());

  if (apptError) errors.push("appointments: " + apptError.message);

  for (const appt of appointments || []) {
    if (!appt.clients?.email) continue;
    const { data: existing } = await admin
      .from("reminder_jobs")
      .select("id,status,sent_at")
      .eq("appointment_id", appt.id)
      .eq("template_key", "confirm_24h")
      .maybeSingle();

    if (existing?.sent_at || existing?.status === "sent") continue;

    const confirmUrl = appUrl + "/?action=confirm&token=" + appt.public_token;
    const rescheduleUrl = appUrl + "/?action=reschedule&token=" + appt.public_token;
    const cancelUrl = appUrl + "/?action=cancel&token=" + appt.public_token;
    const start = formatStart(appt.start_at, appt.practices?.timezone);
    const withWho = appt.staff?.name ? " with " + esc(appt.staff.name) : "";
    const business = appt.practices?.name ? " at " + esc(appt.practices.name) : "";

    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: appt.clients.email,
        subject: "Please confirm your " + appt.services.name + " appointment",
        html:
          '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">' +
          '<h2>Please confirm your appointment</h2>' +
          '<p>Hi ' + esc(appt.clients.first_name || "there") + ',</p>' +
          '<p>Your <strong>' + esc(appt.services.name) + '</strong> appointment' + withWho + business + ' is scheduled for <strong>' + start + '</strong>.</p>' +
          '<p><a href="' + confirmUrl + '">Confirm</a>&nbsp;&nbsp; <a href="' + rescheduleUrl + '">Reschedule</a>&nbsp;&nbsp; <a href="' + cancelUrl + '">Cancel</a></p>' +
          noteHtml(appt.practices?.client_note) +
          '</div>',
      });

      if (existing?.id) {
        await admin.from("reminder_jobs").update({ status:"sent", sent_at:now.toISOString(), last_error:null }).eq("id", existing.id);
      } else {
        await admin.from("reminder_jobs").insert({
          practice_id: appt.practice_id,
          appointment_id: appt.id,
          channel: "email",
          template_key: "confirm_24h",
          scheduled_for: now.toISOString(),
          status: "sent",
          sent_at: now.toISOString(),
        });
      }
      sentConfirmations++;
      notifyQueue.push({
        practice_id: appt.practice_id,
        title: "Confirmation sent · " + (appt.clients.first_name || "Client") + " " + (appt.clients.last_name || ""),
        body: appt.services.name + (appt.staff?.name ? " with " + appt.staff.name : "") + " · " + start + ". Tap to send a WhatsApp reminder.",
        url: "/?remind=" + appt.id,
        tag: "confirm-" + appt.id,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push("confirmation " + appt.id + ": " + message);
      if (existing?.id) await admin.from("reminder_jobs").update({ status:"failed", last_error:message }).eq("id", existing.id);
    }
  }

  const { data: offers, error: offerError } = await admin
    .from("recovery_offers")
    .select("id,public_token,expires_at,clients(first_name,email),appointments(start_at,services(name,price_cents),staff(name)),practices(name,timezone,currency)")
    .eq("status","offered")
    .is("notified_at", null)
    .gt("expires_at", now.toISOString());

  if (offerError) errors.push("offers: " + offerError.message);

  for (const offer of offers || []) {
    if (!offer.clients?.email) continue;
    const acceptUrl = appUrl + "/?action=recovery&decision=accept&token=" + offer.public_token;
    const declineUrl = appUrl + "/?action=recovery&decision=decline&token=" + offer.public_token;
    const start = formatStart(offer.appointments.start_at, offer.practices?.timezone);
    const price = formatPrice(offer.appointments.services?.price_cents || 0, offer.practices?.currency);
    const business = offer.practices?.name ? " at " + offer.practices.name : "";
    const offerStaff = offer.appointments?.staff?.name ? " with " + esc(offer.appointments.staff.name) : "";

    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: offer.clients.email,
        subject: "An appointment slot just opened" + business,
        html:
          '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">' +
          '<h2>A slot just opened</h2>' +
          '<p>Hi ' + esc(offer.clients.first_name || "there") + ',</p>' +
          '<p><strong>' + esc(offer.appointments.services.name) + '</strong>' + offerStaff + '<br>' + start + '<br>' + price + '</p>' +
          '<p>This offer expires soon.</p>' +
          '<p><a href="' + acceptUrl + '">Take this slot</a>&nbsp;&nbsp; <a href="' + declineUrl + '">Not interested</a></p>' +
          '</div>',
      });
      await admin.from("recovery_offers").update({ notified_at: now.toISOString(), notification_error: null }).eq("id", offer.id);
      sentOffers++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push("offer " + offer.id + ": " + message);
      await admin.from("recovery_offers").update({ notification_error: message }).eq("id", offer.id);
    }
  }

  // Tell the business on their devices, with a shortcut to a WhatsApp reminder.
  let sentPush = 0;
  if (notifyQueue.length) {
    try {
      const practiceIds = [...new Set(notifyQueue.map((n) => n.practice_id))];
      const { data: subs } = await admin.from("push_subscriptions").select("id,practice_id,endpoint,p256dh,auth").in("practice_id", practiceIds);
      if (subs?.length) {
        const { appServer } = await getPushServer(admin);
        for (const n of notifyQueue) {
          sentPush += await sendPush(admin, appServer, subs.filter((s) => s.practice_id === n.practice_id), {
            title: n.title.trim(), body: n.body, url: n.url, tag: n.tag,
            actions: [{ action: "whatsapp", title: "Send WhatsApp" }],
          });
        }
      }
    } catch (e) {
      errors.push("push: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return json({ ok:true, sent_confirmations:sentConfirmations, sent_offers:sentOffers, sent_push:sentPush, errors });
});
