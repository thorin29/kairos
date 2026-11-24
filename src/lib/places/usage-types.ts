/** Google call kinds Kairos counts (shared with the Admin page). */
export type ApiKind = "nearby" | "geocode" | "roads" | "routes" | "search" | "mapload" | "elevation";

export type UsageSummary = Record<ApiKind, { today: number; month: number; free: number; limit: number | null }>;
