"use server";

import { requireAdmin } from "@/lib/session";
import {
  listDevices,
  revokeDevice, deleteDevice,
  type DeviceSummary,
} from "@/lib/api/device-auth";

/**
 * The parent-facing side of device management: list a person's enrolled phones
 * and revoke or delete them. Admin-only. Enrolling a new phone is done from the
 * invite / "Add a phone" buttons, which issue an invitation code the app
 * redeems (POST /auth/join) — there is no separate enrollment-code step.
 */

/** Enrolled devices for a person, for the admin list. */
export async function listDevicesAction(
  userId: string,
): Promise<DeviceSummary[]> {
  await requireAdmin();
  return listDevices(userId);
}

/** Revoke one enrolled device. */
export async function revokeDeviceAction(deviceId: string): Promise<void> {
  await requireAdmin();
  await revokeDevice(deviceId);
}

/** Permanently delete a device row (typically an old revoked one). */
export async function deleteDeviceAction(deviceId: string): Promise<void> {
  await requireAdmin();
  await deleteDevice(deviceId);
}
