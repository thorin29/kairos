"use client";

import { useState, useTransition } from "react";
import {
  saveAdminPinAction,
  disableAdminPinAction,
} from "@/lib/actions/session";

const field =
  "h-11 w-40 rounded-full border border-hairline bg-surface px-4 outline-none focus:border-accent";

export function AdminPinControls({ pinSet }: { pinSet: boolean }) {
  const [newPin, setNewPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    setMsg(null);
    start(async () => {
      const r = await saveAdminPinAction({
        currentPin: pinSet ? currentPin : undefined,
        newPin,
      });
      if (r.error) setError(r.error);
      else {
        setMsg(pinSet ? "PIN changed." : "PIN set — admin is now locked by PIN.");
        setNewPin("");
        setCurrentPin("");
      }
    });
  };

  const disable = () => {
    setError(null);
    setMsg(null);
    start(async () => {
      const r = await disableAdminPinAction({ pin: currentPin });
      if (r.error) setError(r.error);
      else {
        setMsg("PIN turned off — admin is open on this screen.");
        setCurrentPin("");
      }
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Admin PIN</p>
          <p className="text-sm text-muted">
            {pinSet
              ? "On \u2014 needed to open admin."
              : "Off \u2014 admin opens without a PIN."}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            pinSet ? "bg-accent/10 text-accent" : "bg-black/5 text-muted"
          }`}
        >
          {pinSet ? "On" : "Off"}
        </span>
      </div>

      {pinSet && (
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          placeholder="Current PIN"
          className={field}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          placeholder={pinSet ? "New PIN" : "New PIN (4\u20138 digits)"}
          className={field}
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-11 rounded-full bg-accent px-5 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pinSet ? "Change PIN" : "Set PIN"}
        </button>
      </div>

      {pinSet && (
        <button
          type="button"
          onClick={disable}
          disabled={pending}
          className="h-10 rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-red-400 hover:text-red-700 disabled:opacity-50"
        >
          Turn PIN off
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {msg && <p className="text-sm font-medium text-accent">{msg}</p>}
    </div>
  );
}
