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
  appLink: string,
  webLink: string,
): Promise<{ sent: boolean; error?: string }> {
  const cfg = await resolveSmtp();
  if (!cfg.configured) return { sent: false };

  const text = [
    `Hi ${name},`,
    "",
    "You've been invited to set up your Kairos account.",
    "On your phone with the Kairos app installed, open this link (or paste it",
    "into the app's Join screen):",
    appLink,
    "",
    `On a computer instead, use: ${webLink}`,
    "",
    "The link is single-use and expires. If it has, ask for a new one.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
      <p>Hi ${escapeHtml(name)},</p>
      <p>You've been invited to set up your Kairos account. On your phone (with
         the Kairos app installed), tap to open it in the app:</p>
      <p><a href="${escapeAttr(appLink)}"
            style="display:inline-block;padding:10px 18px;border-radius:9999px;background:#0f5c63;color:#fff;text-decoration:none">
         Open in the Kairos app</a></p>
      <p style="font-size:13px;color:#666">Or paste this into the app's Join screen:<br>${escapeHtml(appLink)}</p>
      <p style="font-size:13px;color:#666">On a computer instead, use
         <a href="${escapeAttr(webLink)}">${escapeHtml(webLink)}</a>.</p>
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

/** Email a password-reset link. Same shape as the invite mail, but worded for a
 *  reset and reassuring that ignoring it changes nothing. Returns sent:false
 *  (not an error) when SMTP isn't configured. */
export async function sendResetEmail(
  to: string,
  name: string,
  appLink: string,
  webLink: string,
): Promise<{ sent: boolean; error?: string }> {
  const cfg = await resolveSmtp();
  if (!cfg.configured) return { sent: false };

  const text = [
    `Hi ${name},`,
    "",
    "Someone asked to reset your Kairos password. If that was you, open this",
    "link on your phone with the Kairos app to choose a new one (or paste it",
    "into the app's Join screen):",
    appLink,
    "",
    `On a computer instead, use: ${webLink}`,
    "",
    "If you didn't ask for this, ignore this email — nothing changes until the",
    "link is used, and it's single-use and expires.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Someone asked to reset your Kairos password. If that was you, open this
         on your phone to choose a new one:</p>
      <p><a href="${escapeAttr(appLink)}"
            style="display:inline-block;padding:10px 18px;border-radius:9999px;background:#0f5c63;color:#fff;text-decoration:none">
         Reset password in the app</a></p>
      <p style="font-size:13px;color:#666">Or paste this into the app's Join screen:<br>${escapeHtml(appLink)}</p>
      <p style="font-size:13px;color:#666">On a computer instead, use
         <a href="${escapeAttr(webLink)}">${escapeHtml(webLink)}</a>.</p>
      <p style="font-size:13px;color:#666">If you didn't ask for this, ignore this
         email — nothing changes until the link is used, and it's single-use and expires.</p>
    </div>`;

  try {
    await transportFor(cfg).sendMail({
      from: fromLine(cfg),
      to,
      subject: "Reset your Kairos password",
      text,
      html,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Alert a person that a new device was just enrolled to their account — the
 *  tripwire for an unexpected enrollment. No-op when SMTP isn't configured or
 *  the person has no email. */
export async function sendNewDeviceEmail(
  to: string,
  name: string,
  deviceName: string,
): Promise<{ sent: boolean; error?: string }> {
  const cfg = await resolveSmtp();
  if (!cfg.configured) return { sent: false };

  const device = deviceName.trim() || "A new phone";
  const text = [
    `Hi ${name},`,
    "",
    `${device} was just enrolled to your Kairos account.`,
    "If this was you, no action is needed.",
    "If it wasn't, open Kairos on a device you trust, revoke it under",
    "Settings → Devices, and change your password.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
      <p>Hi ${escapeHtml(name)},</p>
      <p><strong>${escapeHtml(device)}</strong> was just enrolled to your Kairos
         account.</p>
      <p>If this was you, no action is needed. If it wasn't, open Kairos on a
         device you trust, revoke it under <em>Settings → Devices</em>, and
         change your password.</p>
    </div>`;

  try {
    await transportFor(cfg).sendMail({
      from: fromLine(cfg),
      to,
      subject: "New device added to your Kairos account",
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
