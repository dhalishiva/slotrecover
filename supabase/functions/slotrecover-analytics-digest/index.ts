import { createClient } from "npm:@supabase/supabase-js@2";

// Sends a short traffic + product digest to Telegram. Called by pg_cron every 2 hours.
// Secrets (never logged): SLOTRECOVER_CRON_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, VERCEL_ANALYTICS_TOKEN.

const VERCEL_PROJECT = Deno.env.get("VERCEL_PROJECT_ID") || "prj_ml5JLNkJUaYUW6SfpJR46pGhGZaT";
const VERCEL_TEAM = Deno.env.get("VERCEL_TEAM_ID") || "team_UVQvQprHg1GL1O7xhA4rsD5v";
const TZ = Deno.env.get("DIGEST_TIMEZONE") || "Asia/Kolkata";
const WINDOW_HOURS = Number(Deno.env.get("DIGEST_WINDOW_HOURS") || 2);

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (v: unknown) => Number(v || 0).toLocaleString("en-US");

// Midnight "today" in the digest timezone, as a UTC Date.
function startOfToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = localAsUtc - now.getTime();
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")) - offsetMs);
}

async function vercel(path: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams({ projectId: VERCEL_PROJECT, teamId: VERCEL_TEAM, ...params });
  const res = await fetch(`https://api.vercel.com/v1/query/web-analytics/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`vercel_${res.status}`);
  return (await res.json())?.data;
}

async function traffic(token: string | undefined, since: Date, today: Date, now: Date) {
  if (!token) return { error: "Add the VERCEL_ANALYTICS_TOKEN secret to see visitors." };
  try {
    const range = (from: Date) => ({ since: from.toISOString(), until: now.toISOString() });
    const top = (by: string) => vercel("visits/aggregate", { ...range(today), by, limit: "5" }, token).catch(() => []);
    const [recent, day, pages, countries, sources] = await Promise.all([
      vercel("visits/count", range(since), token),
      vercel("visits/count", range(today), token),
      top("requestPath"), top("country"), top("referrerHostname"),
    ]);
    return { recent, day, pages, countries, sources };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "vercel_401" || msg === "vercel_403") return { error: "Vercel token was rejected. Check VERCEL_ANALYTICS_TOKEN." };
    return { error: "Couldn't load Vercel analytics (is Web Analytics enabled?)." };
  }
}

function topList(rows: unknown, key: string) {
  if (!Array.isArray(rows) || !rows.length) return "—";
  // deno-lint-ignore no-explicit-any
  return rows.slice(0, 5).map((r: any) => `${esc(r[key] || "(direct)")} <b>${n(r.visitors ?? r.count ?? r.pageviews)}</b>`).join(" · ");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("SLOTRECOVER_CRON_SECRET");
  if (!expected || req.headers.get("x-slotrecover-secret") !== expected) return Response.json({ error: "unauthorized" }, { status: 401 });

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("SLOTRECOVER_TELEGRAM_CHAT_ID") || Deno.env.get("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) return Response.json({ error: "telegram_not_configured" }, { status: 500 });

  try {
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_HOURS * 3600_000);
    const today = startOfToday(now);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const [t, statsRes] = await Promise.all([
      traffic(Deno.env.get("VERCEL_ANALYTICS_TOKEN"), since, today, now),
      admin.rpc("slotrecover_digest_stats", { p_since: since.toISOString(), p_today: today.toISOString() }),
    ]);
    const s = statsRes.data || {};

    const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const lines = [`📊 <b>SlotRecover</b> · ${esc(time)}`, ""];
    if ("error" in t) {
      lines.push(`🌐 ${esc(t.error)}`);
    } else {
      lines.push(
        `🌐 <b>Last ${WINDOW_HOURS}h:</b> ${n(t.recent?.visitors)} visitors · ${n(t.recent?.pageviews)} page views`,
        `📅 <b>Today:</b> ${n(t.day?.visitors)} visitors · ${n(t.day?.pageviews)} page views`,
        `📄 ${topList(t.pages, "requestPath")}`,
        `🌍 ${topList(t.countries, "country")}`,
        `🔗 ${topList(t.sources, "referrerHostname")}`,
      );
    }
    lines.push(
      "",
      `👤 <b>Signups:</b> ${n(s.signups_window)} (last ${WINDOW_HOURS}h) · ${n(s.signups_today)} today · ${n(s.users_total)} total`,
      `🏪 <b>Businesses set up today:</b> ${n(s.practices_today)}`,
      `💳 <b>Trials started today:</b> ${n(s.trials_today)} · <b>Active/trialing:</b> ${n(s.active_accounts)}`,
      `📆 <b>Appointments created today:</b> ${n(s.appointments_today)} · <b>Slots recovered today:</b> ${n(s.recovered_today)}`,
    );
    if (statsRes.error) lines.push("", "⚠️ App stats unavailable right now.");

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.ok) {
      console.error("Telegram rejected message", { status: res.status, code: result?.error_code });
      return Response.json({ error: "telegram_failed" }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch {
    // Don't log the exception: fetch errors can include the bot token in the URL.
    console.error("Digest failed");
    return Response.json({ error: "digest_failed" }, { status: 500 });
  }
});
