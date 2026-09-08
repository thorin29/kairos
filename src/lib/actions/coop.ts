"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  proposeCoopCore,
  toggleCoopVoteCore,
  selectCoopCore,
  grantCoopCore,
  removeCoopCore,
} from "@/lib/coop-core";
import { setSetting, SEASON_COOP_FLOOR } from "@/lib/settings";

function bump() {
  revalidatePath("/coop");
  revalidatePath("/summary");
}

export async function proposeCoopReward(input: {
  title: string;
  detail: string;
  proposedById: string;
}): Promise<{ error: string | null }> {
  const r = await proposeCoopCore(input);
  bump();
  return r;
}

export async function toggleCoopVote(input: {
  proposalId: string;
  userId: string;
}): Promise<{ error: string | null }> {
  const r = await toggleCoopVoteCore(input);
  bump();
  return r;
}

export async function selectCoopReward(proposalId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const r = await selectCoopCore(proposalId);
  bump();
  return r;
}

export async function grantCoopReward(proposalId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const r = await grantCoopCore(proposalId);
  bump();
  return r;
}

export async function removeCoopProposal(proposalId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const r = await removeCoopCore(proposalId);
  bump();
  return r;
}

export async function setCoopFloor(tier: number): Promise<{ error: string | null }> {
  await requireAdmin();
  const n = Math.min(10, Math.max(1, Math.round(tier)));
  await setSetting(SEASON_COOP_FLOOR, String(n));
  bump();
  return { error: null };
}
