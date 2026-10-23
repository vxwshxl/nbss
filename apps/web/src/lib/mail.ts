import "server-only";

/**
 * Outgoing mail through ZeptoMail's HTTP API.
 *
 * The same ZeptoMail agent Supabase Auth sends sign-in codes through: the
 * SMTP password ZeptoMail issues *is* the API send token, so the site needs no
 * second credential and no SMTP library — one `fetch`. The API host is the SMTP
 * host's sibling (smtp.zeptomail.in → api.zeptomail.in), so the account's
 * region follows `.env` instead of being written here.
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: { address: string; name?: string };
};

export async function sendMail(mail: Mail): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = process.env.SMTP_HOST;
  const token = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !token || !from) return { ok: false, error: "SMTP_HOST, SMTP_PASS and SMTP_FROM must be set" };

  const api = `https://${host.replace(/^smtp\./, "api.")}/v1.1/email`;
  try {
    const res = await fetch(api, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${token.replace(/^Zoho-enczapikey\s+/, "")}`,
      },
      body: JSON.stringify({
        from: { address: from, name: "NBSS Kokrajhar" },
        to: [{ email_address: { address: mail.to } }],
        ...(mail.replyTo && { reply_to: [mail.replyTo] }),
        subject: mail.subject,
        textbody: mail.text,
        ...(mail.html && { htmlbody: mail.html }),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `ZeptoMail ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}
