"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { LinkIcon, TrashIcon, CheckIcon } from "@/components/icons";
import {
  createInviteAction,
  revokeInviteAction,
  disableLoginAction,
  setUserEmailAction,
} from "@/lib/actions/accounts";
import type { AccountState } from "@/lib/accounts";

/**
 * One person's login state and the actions on it. The invite link is a
 * one-time token: it's shown here the moment it's created and never again, so
 * the reveal box makes that explicit. Re-issuing (New link / Reset password)
 * simply mints a fresh one and invalidates the old.
 */
export function AccountRow({ account }: { account: AccountState }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState(account.email ?? "");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const dirty = email.trim() !== (account.email ?? "");

  const name = account.displayName ?? account.name;

  const invite = () =>
    startTransition(async () => {
      setCopied(false);
      setCopyFailed(false);
      setEmailedTo(null);
      setEmailError(null);
      const res = await createInviteAction(account.userId);
      if (res.token) {
        setLink(`${window.location.origin}/join?token=${res.token}`);
      }
      setEmailedTo(res.emailedTo ?? null);
      setEmailError(res.emailError ?? null);
    });

  const saveEmail = () =>
    startTransition(async () => {
      setEmailStatus(null);
      const res = await setUserEmailAction(account.userId, email);
      setEmailStatus(res.error ?? "Saved");
    });

  const revoke = () =>
    startTransition(async () => {
      setLink(null);
      await revokeInviteAction(account.userId);
    });

  const disable = () =>
    startTransition(async () => {
      setLink(null);
      await disableLoginAction(account.userId);
    });

  const copy = async () => {
    if (!link) return;
    setCopyFailed(false);

    // The async Clipboard API only exists in a secure context (HTTPS or
    // localhost). Over plain HTTP on the LAN it's undefined, so guard for it
    // and fall through to the legacy path rather than throwing.
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        return;
      } catch {
        /* fall through */
      }
    }

    // Legacy path: select the field and ask the document to copy. Works on
    // plain-HTTP LAN where the Clipboard API isn't available.
    const el = linkRef.current;
    if (el) {
      el.focus();
      el.select();
      el.setSelectionRange(0, link.length);
      try {
        if (document.execCommand("copy")) {
          setCopied(true);
          return;
        }
      } catch {
        /* fall through */
      }
    }

    // Nothing automatic worked (some locked-down mobile browsers). The link is
    // now selected, so it can be copied by hand.
    setCopyFailed(true);
  };

  const status = account.hasPassword
    ? { label: "Active", tone: "bg-emerald-500/10 text-emerald-700" }
    : account.invitePending
      ? { label: "Invite pending", tone: "bg-amber-500/10 text-amber-700" }
      : { label: "No login", tone: "bg-ink/5 text-muted" };

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors disabled:opacity-50";

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar
          name={name}
          color={account.color}
          avatarPath={account.avatarPath} avatarPosition={account.avatarPosition}
          size="sm"
        />
        <span className="font-medium">{name}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.tone}`}
        >
          {status.label}
        </span>

        <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {account.hasPassword ? (
            <>
              <button
                type="button"
                onClick={invite}
                disabled={pending}
                className={`${btn} bg-ink/5 text-ink hover:bg-ink/10`}
              >
                <LinkIcon className="h-4 w-4" />
                Reset password
              </button>
              <button
                type="button"
                onClick={disable}
                disabled={pending}
                className={`${btn} text-red-700 hover:bg-red-500/10`}
              >
                <TrashIcon className="h-4 w-4" />
                Disable
              </button>
            </>
          ) : account.invitePending ? (
            <>
              <button
                type="button"
                onClick={invite}
                disabled={pending}
                className={`${btn} bg-accent/10 text-accent hover:bg-accent/20`}
              >
                <LinkIcon className="h-4 w-4" />
                New link
              </button>
              <button
                type="button"
                onClick={revoke}
                disabled={pending}
                className={`${btn} text-red-700 hover:bg-red-500/10`}
              >
                <TrashIcon className="h-4 w-4" />
                Revoke
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={invite}
              disabled={pending}
              className={`${btn} bg-accent text-white hover:brightness-110`}
            >
              <LinkIcon className="h-4 w-4" />
              Send invite
            </button>
          )}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailStatus(null);
          }}
          placeholder="email (optional) — where an invite is sent"
          autoComplete="off"
          autoCapitalize="none"
          className="h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={saveEmail}
          disabled={pending || !dirty}
          className={`${btn} shrink-0 bg-ink/5 text-ink hover:bg-ink/10`}
        >
          Save
        </button>
        {emailStatus && (
          <span
            className={`shrink-0 text-xs ${
              emailStatus === "Saved" ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {emailStatus}
          </span>
        )}
      </div>

      {link && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          {emailedTo && (
            <p className="mb-2 text-xs font-medium text-emerald-700">
              Invite emailed to {emailedTo}. The link below is a backup.
            </p>
          )}
          {emailError && (
            <p className="mb-2 text-xs font-medium text-amber-700">
              Couldn&rsquo;t email the invite ({emailError}). Share the link
              below instead.
            </p>
          )}
          <p className="mb-2 text-xs font-medium text-accent">
            One-time invite link — copy it now, it won&rsquo;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={linkRef}
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={copy}
              className={`${btn} shrink-0 bg-accent text-white hover:brightness-110`}
            >
              {copied ? (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Copied
                </>
              ) : (
                "Copy"
              )}
            </button>
          </div>
          {copyFailed && (
            <p className="mt-2 text-xs text-muted">
              Couldn&rsquo;t copy automatically &mdash; the link is selected, so
              press &#8984;/Ctrl-C, or long-press it to copy.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
