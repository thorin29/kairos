"use server";

import { requireAdmin } from "@/lib/session";
import {
  issueEnrollmentCode,
  listDevices,
  revokeDevice,
  type DeviceSummary,
} from "@/lib/api/device-auth";

/**
 * The parent-facing side of device enrollment. Generating a code and managing a
 * person's enrolled devices is admin-only; the phone-facing redemption lives in
 * the `/api/v1/auth/enroll` route, which needs no session. These are the seam
 * the admin UI (a "Generate enrollment code" button per person, and a device
 * list) calls — the API contract and token backend ship first (v0.177); the
 * admin screen is the next increment.
 */

/** Generate a one-time enrollment code for a person. Returns the raw code
 *  (shown once — render it as text and a QR) and when it expires. */
export async function issueEnrollmentCodeAction(userId: string): Promise<{
  code: string;
  expiresAt: string;
}> {
  await requireAdmin();
  const { code, expiresAt } = await issueEnrollmentCode(userId);
  return { code, expiresAt: expiresAt.toISOString() };
}

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
