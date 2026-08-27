import { AdminBack } from "@/components/admin-back";
import { LockButton } from "../lock-button";
import { deviceMode } from "@/lib/device";
import { loginRequired } from "@/lib/gate";
import { loginableCount } from "@/lib/accounts";
import { adminPinSet } from "@/lib/session";
import { DeviceControls } from "./device-controls";

export const dynamic = "force-dynamic";

export default async function DeviceAdminPage() {
  const [mode, gate, loginable, pinSet] = await Promise.all([
    deviceMode(),
    loginRequired(),
    loginableCount(),
    adminPinSet(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Device
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            How this particular screen behaves, and whether the whole app
            requires signing in.
          </p>
        </div>
        <LockButton />
      </header>

      <DeviceControls
        mode={mode}
        requireLogin={gate}
        loginable={loginable}
        pinSet={pinSet}
      />
    </main>
  );
}
