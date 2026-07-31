import "server-only";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * SMTP settings resolve as: environment variable, then the value saved in the
 * admin Email page, then a default. That lets everything live in the Unraid
 * container variables, or in the GUI (with a test button, the Vaultwarden
 * way), or a mix — e.g. the password in the environment, out of the database,
 * and the rest in the GUI. Bridge's quirks (self-signed cert on a STARTTLS
 * port) are just settings here: security + skipVerify + minTls.
 */
export type SmtpSecurity = "none" | "starttls" | "tls";
export type MinTls = "TLSv1" | "TLSv1.1" | "TLSv1.2" | "TLSv1.3";

export type SmtpConfig = {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
  skipVerify: boolean;
  minTls: MinTls;
  timeoutSec: number;
  /** Enough to attempt a send: enabled and a host set. */
  configured: boolean;
};

// key in AppSetting, matching env var, parser
type Field = {
  key: string;
  env: string;
};

const F = {
  enabled: { key: "smtp.enabled", env: "SMTP_ENABLED" },
  host: { key: "smtp.host", env: "SMTP_HOST" },
  port: { key: "smtp.port", env: "SMTP_PORT" },
  security: { key: "smtp.security", env: "SMTP_SECURITY" },
  username: { key: "smtp.username", env: "SMTP_USERNAME" },
  password: { key: "smtp.password", env: "SMTP_PASSWORD" },
  fromAddress: { key: "smtp.from", env: "SMTP_FROM" },
  fromName: { key: "smtp.fromName", env: "SMTP_FROM_NAME" },
  skipVerify: { key: "smtp.skipVerify", env: "SMTP_SKIP_VERIFY" },
  minTls: { key: "smtp.minTls", env: "SMTP_MIN_TLS" },
  timeoutSec: { key: "smtp.timeout", env: "SMTP_TIMEOUT" },
} satisfies Record<string, Field>;

const PUBLIC_URL = { key: "publicUrl", env: "PUBLIC_URL" };

function truthy(v: string): boolean {
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

/** env value if set (non-empty), else the saved value, else null. */
async function resolve(f: Field): Promise<string | null> {
  const fromEnv = process.env[f.env];
  if (fromEnv != null && fromEnv !== "") return fromEnv;
  return getSetting(f.key);
}

function asSecurity(v: string | null): SmtpSecurity {
  return v === "none" || v === "starttls" || v === "tls" ? v : "starttls";
}

function asMinTls(v: string | null): MinTls {
  return v === "TLSv1" || v === "TLSv1.1" || v === "TLSv1.2" || v === "TLSv1.3"
    ? v
    : "TLSv1.2";
}

export async function resolveSmtp(): Promise<SmtpConfig> {
  const [
    enabled,
    host,
    port,
    security,
    username,
    password,
    fromAddress,
    fromName,
    skipVerify,
    minTls,
    timeoutSec,
  ] = await Promise.all([
    resolve(F.enabled),
    resolve(F.host),
    resolve(F.port),
    resolve(F.security),
    resolve(F.username),
    resolve(F.password),
    resolve(F.fromAddress),
    resolve(F.fromName),
    resolve(F.skipVerify),
    resolve(F.minTls),
    resolve(F.timeoutSec),
  ]);

  const cfg: SmtpConfig = {
    enabled: enabled != null && truthy(enabled),
    host: host ?? "",
    port: port != null && port !== "" ? Number(port) : 587,
    security: asSecurity(security),
    username: username ?? "",
    password: password ?? "",
    fromAddress: fromAddress ?? "",
    fromName: fromName ?? "Kairos",
    skipVerify: skipVerify != null && truthy(skipVerify),
    minTls: asMinTls(minTls),
    timeoutSec:
      timeoutSec != null && timeoutSec !== "" ? Number(timeoutSec) : 15,
    configured: false,
  };
  cfg.configured = cfg.enabled && cfg.host.trim() !== "";
  return cfg;
}

/** The values as saved in the GUI (not env), for editing. Password is never
 *  returned — the form only shows whether one is set. */
export type SmtpForm = {
  enabled: boolean;
  host: string;
  port: string;
  security: SmtpSecurity;
  username: string;
  passwordSet: boolean;
  fromAddress: string;
  fromName: string;
  skipVerify: boolean;
  minTls: MinTls;
  timeoutSec: string;
  publicUrl: string;
  /** env vars currently overriding a saved value, by human label. */
  envOverrides: string[];
};

export async function smtpForm(): Promise<SmtpForm> {
  const [
    enabled,
    host,
    port,
    security,
    username,
    password,
    fromAddress,
    fromName,
    skipVerify,
    minTls,
    timeoutSec,
    publicUrl,
  ] = await Promise.all([
    getSetting(F.enabled.key),
    getSetting(F.host.key),
    getSetting(F.port.key),
    getSetting(F.security.key),
    getSetting(F.username.key),
    getSetting(F.password.key),
    getSetting(F.fromAddress.key),
    getSetting(F.fromName.key),
    getSetting(F.skipVerify.key),
    getSetting(F.minTls.key),
    getSetting(F.timeoutSec.key),
    getSetting(PUBLIC_URL.key),
  ]);

  const labels: Record<string, string> = {
    SMTP_ENABLED: "Enabled",
    SMTP_HOST: "Host",
    SMTP_PORT: "Port",
    SMTP_SECURITY: "Security",
    SMTP_USERNAME: "Username",
    SMTP_PASSWORD: "Password",
    SMTP_FROM: "From address",
    SMTP_FROM_NAME: "From name",
    SMTP_SKIP_VERIFY: "Skip cert check",
    SMTP_MIN_TLS: "Minimum TLS",
    SMTP_TIMEOUT: "Timeout",
    PUBLIC_URL: "Public URL",
  };
  const envOverrides = Object.entries(labels)
    .filter(([env]) => {
      const v = process.env[env];
      return v != null && v !== "";
    })
    .map(([, label]) => label);

  return {
    enabled: enabled != null && truthy(enabled),
    host: host ?? "",
    port: port ?? "",
    security: asSecurity(security),
    username: username ?? "",
    passwordSet: (password ?? "") !== "",
    fromAddress: fromAddress ?? "",
    fromName: fromName ?? "",
    skipVerify: skipVerify != null && truthy(skipVerify),
    minTls: asMinTls(minTls),
    timeoutSec: timeoutSec ?? "",
    publicUrl: publicUrl ?? "",
    envOverrides,
  };
}

export type SmtpInput = {
  enabled: boolean;
  host: string;
  port: string;
  security: SmtpSecurity;
  username: string;
  password: string; // blank = leave unchanged
  fromAddress: string;
  fromName: string;
  skipVerify: boolean;
  minTls: MinTls;
  timeoutSec: string;
  publicUrl: string;
};

/** Persist GUI values. A blank password is left untouched, so saving other
 *  fields never wipes a stored secret. */
export async function saveSmtp(input: SmtpInput): Promise<void> {
  await Promise.all([
    setSetting(F.enabled.key, input.enabled ? "true" : "false"),
    setSetting(F.host.key, input.host.trim()),
    setSetting(F.port.key, input.port.trim()),
    setSetting(F.security.key, input.security),
    setSetting(F.username.key, input.username.trim()),
    setSetting(F.fromAddress.key, input.fromAddress.trim()),
    setSetting(F.fromName.key, input.fromName.trim()),
    setSetting(F.skipVerify.key, input.skipVerify ? "true" : "false"),
    setSetting(F.minTls.key, input.minTls),
    setSetting(F.timeoutSec.key, input.timeoutSec.trim()),
    setSetting(PUBLIC_URL.key, input.publicUrl.trim()),
  ]);
  if (input.password !== "") {
    await setSetting(F.password.key, input.password);
  }
}

/** Base URL for links in emails: PUBLIC_URL (env or saved), else null so the
 *  caller can fall back to the request's own origin. */
export async function configuredBaseUrl(): Promise<string | null> {
  const fromEnv = process.env[PUBLIC_URL.env];
  if (fromEnv != null && fromEnv !== "") return fromEnv.replace(/\/+$/, "");
  const saved = await getSetting(PUBLIC_URL.key);
  return saved && saved !== "" ? saved.replace(/\/+$/, "") : null;
}
