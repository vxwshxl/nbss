/**
 * The operations emails, rendered by the worker from `email_outbox` rows.
 *
 * One layout, the sign-in code email's (public/email/auth-code.html): the green
 * NBSS band, a white card, one clear action. Each template is a function of the
 * row's `data`, written by the database function that queued it — so the
 * field names here must match those in 0022_field_ops.sql.
 */

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "https://nbsskokrajhar.com").replace(/\/$/, "");

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const SHIFT = { morning: "Morning", evening: "Evening", night: "Night", full_day: "24 Hours" };
const shifts = (list) => (Array.isArray(list) && list.length ? list.map((s) => SHIFT[s] ?? s).join(", ") : null);

function istTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rupees(paise) {
  if (paise == null) return null;
  return `₹${(Number(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function layout({ heading, intro, rows = [], action, note, tone = "green", text }) {
  const band =
    tone === "red"
      ? "background:#b91c1c;background-image:linear-gradient(100deg,#dc2626 10%,#991b1b 90%)"
      : "background:#009164;background-image:linear-gradient(100deg,#009164 10%,#006b4a 90%)";
  const table = rows
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:7px 0;font-size:13px;color:#8a8a8a;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:7px 0;font-size:14px;color:#171717;font-weight:500">${esc(v)}</td></tr>`,
    )
    .join("");
  const button = action
    ? `<a href="${esc(action.href)}" style="display:inline-block;margin-top:22px;background:${tone === "red" ? "#b91c1c" : "#009164"};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:999px">${esc(action.label)}</a>`
    : "";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f5;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ebebeb">
            <tr>
              <td style="${band};padding:22px 28px;color:#ffffff">
                <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em">NBSS</div>
                <div style="font-size:12px;opacity:.85;margin-top:2px">National Bodo Security Service</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                <p style="margin:0 0 6px;font-size:16px;font-weight:600">${esc(heading)}</p>
                <p style="margin:0 0 16px;font-size:14px;color:#5d5d5d;line-height:1.5">${esc(intro)}</p>
                ${table ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0">${table}</table>` : ""}
                ${button}
                ${note ? `<p style="margin:22px 0 0;font-size:12px;color:#8a8a8a;line-height:1.5">${esc(note)}</p>` : ""}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#8a8a8a">NBSS · Kokrajhar, Assam</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { html, text };
}

const KIND = { intruder: "Intruder", medical: "Medical", fire: "Fire", assault: "Assault", other: "Help needed" };

export const templates = {
  sos: (d) => {
    const map = d.lat != null ? `https://www.google.com/maps?q=${d.lat},${d.lng}` : null;
    return layout({
      tone: "red",
      heading: `SOS · ${d.site}`,
      intro: `${d.guard} (${d.code}) pressed SOS${d.on_duty ? "" : " while not checked in"}. Call them and send help.`,
      rows: [
        ["What", KIND[d.kind] ?? d.kind],
        ["Note", d.note],
        ["Guard's phone", d.phone],
        ["Raised", istTime(d.raised_at)],
        ["Location", map ? `${Number(d.lat).toFixed(5)}, ${Number(d.lng).toFixed(5)}` : "No GPS fix"],
      ],
      action: { label: "Open the SOS", href: `${BASE}/console/sos` },
      note: map ? `Map: ${map}` : "The phone could not get a GPS fix when the alert was raised.",
      text: `SOS at ${d.site}: ${d.guard} (${d.code}) needs help. ${KIND[d.kind] ?? ""} ${d.note ?? ""}\n${map ?? ""}\n${BASE}/console/sos`,
    });
  },

  device: (d) =>
    layout({
      heading: `New phone for ${d.guard}`,
      intro: d.shared_with
        ? `${d.guard} signed in on a phone that is registered to ${d.shared_with}. Their check-ins from it are held for review until you approve it.`
        : `${d.guard} signed in on a phone that is not yet approved for them. Their check-ins from it are held for review until you approve it.`,
      rows: [
        ["Guard", `${d.guard} (${d.code})`],
        ["Phone", d.device],
        ["System", [d.platform, d.os].filter(Boolean).join(" ")],
        ["Also registered to", d.shared_with ? `${d.shared_with} (${d.shared_code})` : null],
      ],
      action: { label: "Review devices", href: `${BASE}/console/devices` },
      text: `${d.guard} (${d.code}) signed in on a new phone: ${d.device}.${d.shared_with ? ` It is registered to ${d.shared_with}.` : ""} Review: ${BASE}/console/devices`,
    }),

  duty: (d) =>
    layout({
      heading: "You have a new duty",
      intro: `Hello ${d.guard}, you are replacing ${d.replacing}. Open the NBSS app on the day and check in at the site.`,
      rows: [
        ...(d.lines ?? []).map((line, i) => [i === 0 ? "Duty" : "", line]),
        ["Reason", d.reason],
      ],
      note: "If you cannot make it, open the app and press \"I can't come\" on the duty, or call the office.",
      text: `Hello ${d.guard}, you are replacing ${d.replacing}:\n${(d.lines ?? []).join("\n")}`,
    }),

  replacement_request: (d) =>
    layout({
      heading: `Replacement needed at ${d.site}`,
      intro: `${d.guard} (${d.code}) cannot make their duty and has asked for cover.`,
      rows: [
        ["Duty", d.when],
        ["Site", d.site],
        ["Reason", d.reason],
      ],
      action: { label: "Assign a replacement", href: `${BASE}/console/replacements` },
      text: `${d.guard} (${d.code}) cannot make ${d.when} at ${d.site}. ${d.reason ?? ""}\n${BASE}/console/replacements`,
    }),

  booking: (d) => {
    const status = {
      new: ["We have your booking", "Thank you. The deployment desk will call you to confirm the details and the quote."],
      quoted: ["Your quote is ready", "Here is the quote for your booking. Reply or call us to accept it."],
      accepted: ["Booking accepted", "Your booking is confirmed. We will let you know which guards are posted."],
      declined: ["About your booking", "We are unable to take this booking. Please call us to discuss other options."],
      converted: ["Your guards are on the way", "Your site is set up. You can watch attendance from your NBSS account."],
    }[d.status] ?? ["Booking update", `Your booking is now ${d.status}.`];
    return layout({
      heading: status[0],
      intro: `Hello ${d.name}. ${status[1]}`,
      rows: [
        ["Reference", d.reference],
        ["Guards", d.guards],
        ["Number of days", d.days],
        ["Shifts", shifts(d.shifts)],
        ["Starting", d.start],
        ["Quote", rupees(d.quote_paise)],
        ["Note", d.quote_note],
      ],
      action: { label: "View your booking", href: `${BASE}/console/book` },
      text: `${status[0]} (${d.reference}). ${status[1]}`,
    });
  },

  silent: (d) =>
    layout({
      tone: "red",
      heading: `No signal from ${d.guard}`,
      intro: `${d.guard} (${d.code}) is checked in at ${d.site}, but their phone has not reported its location for over 20 minutes. They have been asked to open the app. Call them to check they are safe and on post.`,
      rows: [
        ["Last heard", istTime(d.since)],
        ["Guard's phone", d.phone],
        ["Site", d.site],
      ],
      action: { label: "Open Live tracking", href: `${BASE}/console/live` },
      note: "Usually the app was closed and the phone's battery saver stopped it. If this repeats, ask the guard to set battery to Unrestricted for NBSS Kokrajhar.",
      text: `No signal from ${d.guard} (${d.code}) at ${d.site} since ${istTime(d.since)}. Phone: ${d.phone ?? "-"}. ${BASE}/console/live`,
    }),

  booking_staff: (d) =>
    layout({
      heading: `New booking ${d.reference}`,
      intro: `${d.name}${d.organisation ? ` from ${d.organisation}` : ""} has asked for guards.`,
      rows: [
        ["Phone", d.phone],
        ["Guards", d.guards],
        ["Number of days", d.days],
        ["Shifts", shifts(d.shifts)],
        ["Starting", d.start],
        ["District", d.district],
      ],
      action: { label: "Open bookings", href: `${BASE}/console/bookings` },
      text: `New booking ${d.reference} from ${d.name}, ${d.phone}. ${BASE}/console/bookings`,
    }),
};

export function render(row) {
  const fn = templates[row.template];
  if (!fn) return null;
  return fn(row.data ?? {});
}
