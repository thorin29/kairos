import { AdminBack } from "@/components/admin-back";
import { LockButton } from "../lock-button";
import { deviceMode } from "@/lib/device";
import { adminPinSet, adminIdleMinutes } from "@/lib/session";
import { DeviceControls } from "./device-controls";

export const dynamic = "force-dynamic";

export default async function DeviceAdminPage() {
  const [mode, pinSet, idleMinutes] = await Promise.all([
    deviceMode(),
    adminPinSet(),
    adminIdleMinutes(),
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
            How this particular screen behaves.
          </p>
        </div>
        <LockButton />
      </header>

      <DeviceControls
        mode={mode}
        pinSet={pinSet}
        idleMinutes={idleMinutes}
      />
    </main>
  );
}
