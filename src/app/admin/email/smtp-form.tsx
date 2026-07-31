"use client";

import { useState, useTransition } from "react";
import { saveSmtpAction, sendTestEmailAction } from "@/lib/actions/accounts";
import type {
  SmtpForm as SmtpFormValues,
  SmtpSecurity,
  MinTls,
} from "@/lib/mail/config";

const field =
  "h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent";
const labelCls = "mb-1 block text-sm font-medium";

/**
 * SMTP settings, the Vaultwarden-style GUI half of the config. Environment
 * variables, if set, win over anything saved here — the note calls out which
 * ones are currently doing that. The three Bridge dials (security, accept
 * invalid cert, minimum TLS) are front and centre, and the test button reports
 * the raw SMTP error so a refused handshake is debuggable.
 */
export function SmtpForm({ initial }: { initial: SmtpFormValues }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(initial.enabled);
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(initial.port);
  const [security, setSecurity] = useState<SmtpSecurity>(initial.security);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
  const [fromAddress, setFromAddress] = useState(initial.fromAddress);
  const [fromName, setFromName] = useState(initial.fromName);
  const [skipVerify, setSkipVerify] = useState(initial.skipVerify);
  const [minTls, setMinTls] = useState<MinTls>(initial.minTls);
  const [timeoutSec, setTimeoutSec] = useState(initial.timeoutSec);
  const [publicUrl, setPublicUrl] = useState(initial.publicUrl);

  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState<
    { ok: boolean; error?: string } | null
  >(null);

  const save = () =>
    startTransition(async () => {
      setSaved(false);
      await saveSmtpAction({
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
      });
      setPassword("");
      setSaved(true);
    });

  const test = () =>
    startTransition(async () => {
      setTestResult(null);
      const res = await sendTestEmailAction(testTo);
      setTestResult(res);
    });

  return (
    <div className="space-y-6">
      {initial.envOverrides.length > 0 && (
        <p className="rounded-lg border border-hairline bg-surface px-3 py-2 text-xs text-muted">
          Set from environment variables (these override the fields below):{" "}
          <span className="font-medium text-ink">
            {initial.envOverrides.join(", ")}
          </span>
        </p>
      )}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        Send invite emails through this server
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Host</label>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="10.29.29.200"
            className={field}
          />
        </div>

        <div>
          <label className={labelCls}>Port</label>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            inputMode="numeric"
            placeholder="1025"
            className={field}
          />
        </div>

        <div>
          <label className={labelCls}>Security</label>
          <select
            value={security}
            onChange={(e) => setSecurity(e.target.value as SmtpSecurity)}
            className={field}
          >
            <option value="none">None (plaintext)</option>
            <option value="starttls">STARTTLS</option>
            <option value="tls">TLS (implicit)</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            placeholder="marcolish@protonmail.com"
            className={field}
          />
        </div>

        <div>
          <label className={labelCls}>
            Password{" "}
            {initial.passwordSet && (
              <span className="font-normal text-muted">(set — blank keeps it)</span>
            )}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={initial.passwordSet ? "••••••••" : ""}
            className={field}
          />
        </div>

        <div>
          <label className={labelCls}>From address</label>
          <input
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="admin@ninjaknox.net"
            className={field}
          />
        </div>

        <div>
          <label className={labelCls}>From name</label>
          <input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Kairos"
            className={field}
          />
        </div>

        <div>
          <label className={labelCls}>Minimum TLS</label>
          <select
            value={minTls}
            onChange={(e) => setMinTls(e.target.value as MinTls)}
            className={field}
          >
            <option value="TLSv1">TLS 1.0</option>
            <option value="TLSv1.1">TLS 1.1</option>
            <option value="TLSv1.2">TLS 1.2</option>
            <option value="TLSv1.3">TLS 1.3</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Timeout (seconds)</label>
          <input
            value={timeoutSec}
            onChange={(e) => setTimeoutSec(e.target.value)}
            inputMode="numeric"
            placeholder="15"
            className={field}
          />
        </div>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={skipVerify}
            onChange={(e) => setSkipVerify(e.target.checked)}
            className="h-4 w-4"
          />
          Accept an invalid / self-signed certificate (Proton Bridge needs this)
        </label>

        <div className="sm:col-span-2">
          <label className={labelCls}>
            Public URL{" "}
            <span className="font-normal text-muted">
              (base for links in emails; blank = use the request&rsquo;s own
              address)
            </span>
          </label>
          <input
            value={publicUrl}
            onChange={(e) => setPublicUrl(e.target.value)}
            placeholder="https://kairos.ninjaknox.net"
            className={field}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-4">
        <label className={labelCls}>Send a test email</label>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => {
              setTestTo(e.target.value);
              setTestResult(null);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            className={field}
          />
          <button
            type="button"
            onClick={test}
            disabled={pending || !testTo.trim()}
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-ink/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-ink/10 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send test"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Save first — the test uses the saved settings.
        </p>
        {testResult?.ok && (
          <p className="mt-2 text-sm font-medium text-emerald-700">
            Sent. Check the inbox.
          </p>
        )}
        {testResult && !testResult.ok && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium text-red-700">
            {testResult.error}
          </p>
        )}
      </div>
    </div>
  );
}
