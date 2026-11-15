"use server";

import { requireInteractive, requireCanActFor } from "@/lib/gate";
import { isAdmin } from "@/lib/session";
import {
  addReadingsCore,
  exportPlanCore,
  importPlanCore,
  planRef,
  type AddInput,
  type ImportInput,
  type ImportResult,
  type PlanRef,
} from "@/lib/bible/plan-edit-core";
import type { AddResult } from "@/lib/bible/plan-edit";

/** A family plan is a parent's to change; a personal plan its owner's. */
async function editablePlan(planId: string): Promise<PlanRef | null> {
  await requireInteractive();
  const plan = await planRef(planId);
  if (!plan) return null;
  if (plan.ownerId === null) return (await isAdmin()) ? plan : null;
  await requireCanActFor(plan.ownerId);
  return plan;
}

export async function addReadingsAction(planId: string, input: AddInput): Promise<AddResult> {
  const plan = await editablePlan(planId);
  if (!plan) return { error: "Only a parent can change this plan.", days: [], oldEndISO: null, endISO: null };
  return addReadingsCore(plan, input);
}

/** Import for the family (a parent: a new draft, or into an existing plan) or
 *  for one person (their own plan). */
export async function importPlanAction(
  target: { scope: "family"; intoPlanId?: string | null } | { scope: "mine"; userId: string },
  input: ImportInput,
): Promise<ImportResult> {
  await requireInteractive();
  const fail = (error: string): ImportResult => ({ error, name: null, dated: false, days: [], skipped: [], saved: false });
  if (target.scope === "family") {
    if (!(await isAdmin())) return fail("Only a parent can import a family plan.");
    const into = target.intoPlanId ? await planRef(target.intoPlanId) : null;
    if (into && into.ownerId !== null) return fail("Pick a family plan.");
    return importPlanCore({ ownerId: null, into }, input);
  }
  await requireCanActFor(target.userId);
  return importPlanCore({ ownerId: target.userId }, input);
}

export async function exportPlanAction(
  planId: string,
): Promise<{ name: string; fileName: string; text: string } | null> {
  const plan = await editablePlan(planId);
  return plan ? exportPlanCore(plan) : null;
}
