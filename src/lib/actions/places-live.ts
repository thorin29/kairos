"use server";

import { loadLive } from "@/lib/places/live";
import type { LiveData } from "@/lib/places/live-types";
import { bump } from "@/lib/places/usage";

/**
 * The Places page's live refresh. Behind the web sign-in (proxy.ts) like
 * every server action; everyone in the house sees everyone (owner's choice).
 */
export async function refreshPlacesLive(): Promise<LiveData> {
  return loadLive();
}

/** Counted once per map the browser opens — Google bills per map load. */
export async function notePlacesMapLoad(): Promise<void> {
  await bump("mapload");
}
