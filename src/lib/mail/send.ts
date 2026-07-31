import "server-only";
import nodemailer from "nodemailer";
import { resolveSmtp, type SmtpConfig } from "@/lib/mail/config";

/**
 * The SMTP send path. Bridge-friendly by construction: the security mode maps
 * to STARTTLS / implicit TLS / none, the self-signed cert is handled by
 * skipVerify, and a minimum TLS version is set explicitly — the same three
 * dials your Authelia and Vaultwarden configs use.
 */
function transportFor(cfg: SmtpConfig) {
  const timeout = Math.max(1, cfg.timeoutSec) * 1000;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.security === "tls", // implicit TLS (e.g. 465)
    requireTLS: cfg.security === "starttls", // upgrade with STARTTLS
    ignoreTLS: cfg.security === "none", // plaintext
    auth: cfg.username ? { user: cfg.username, pass: cfg.password } : undefined,
    tls: {
      rejectUnauthorized: !cfg.skipVerify,
      minVersion: cfg.minTls,
    },
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
  });
}

function fromLine(cfg: SmtpConfig): string {
  const addr = cfg.fromAddress || cfg.username;
  return cfg.fromName ? `"${cfg.fromName}" <${addr}>` : addr;
}

export type SendResult = { ok: boolean; error?: string };

/** Verify the connection and deliver a test message, surfacing the raw SMTP
 *  error so Bridge's TLS quirks are debuggable from the GUI. */
export async function sendTestEmail(to: string): Promise<SendResult> {
  const cfg = await resolveSmtp();
  if (!cfg.host.trim()) return { ok: false, error: "Set a host first." };

  try {
    const t = transportFor(cfg);
    await t.verify();
    await t.sendMail({
      from: fromLine(cfg),
      to,
      subject: "Kairos test email",
      text: "This is a test from Kairos. If you're reading this, SMTP works.",
      html: "<p>This is a test from Kairos. If you're reading this, SMTP works.</p>",
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Email an invite link. Returns sent:false (not an error) when SMTP isn't
 *  configured, so the caller can quietly fall back to the copy link. */
export async function sendInviteEmail(
  to: string,
  name: string,
  link: string,
): Promise<{ sent: boolean; error?: string }> {
  const cfg = await resolveSmtp();
  if (!cfg.configured) return { sent: false };

  const text = [
    `Hi ${name},`,
    "",
    "You've been invited to set up a personal Kairos account.",
    "Open this link to choose a password and sign in:",
    link,
    "",
    "The link is single-use and expires. If it has, ask for a new one.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
      <p>Hi ${escapeHtml(name)},</p>
      <p>You've been invited to set up a personal Kairos account. Choose a
         password and sign in:</p>
      <p><a href="${escapeAttr(link)}"
            style="display:inline-block;padding:10px 18px;border-radius:9999px;background:#0f5c63;color:#fff;text-decoration:none">
         Set up your account</a></p>
      <p style="font-size:13px;color:#666">Or paste this link:<br>${escapeHtml(link)}</p>
      <p style="font-size:13px;color:#666">The link is single-use and expires.
         If it has, ask for a new one.</p>
    </div>`;

  try {
    await transportFor(cfg).sendMail({
      from: fromLine(cfg),
      to,
      subject: "Your Kairos invite",
      text,
      html,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
