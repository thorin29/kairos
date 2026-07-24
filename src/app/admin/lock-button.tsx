"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { lockAdmin } from "@/lib/actions/session";

export function LockButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await lockAdmin();
          router.push("/");
        })
      }
      className="inline-flex h-10 items-center rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {pending ? "Locking\u2026" : "Lock admin"}
    </button>
  );
}
