/**
 * Which admin page belongs to which main page, both ways (v0.796). One table
 * for the admin lock on every main page, "Close admin" and "Lock admin".
 */

/** A main page's lock opens its own admin section. */
export const ADMIN_FOR_PAGE: Record<string, string> = {
  "/": "/admin",
  "/tasks": "/admin/tasks",
  "/chores": "/admin/chores",
  "/coop": "/admin/chores",
  "/calendar": "/admin/calendar",
  "/exercise": "/admin/exercise",
  "/bible": "/admin/bible",
  "/school": "/admin/school",
  "/groceries": "/admin/groceries",
  "/money": "/admin/money",
  "/games": "/admin/games",
  "/hockey": "/admin/hockey",
  "/places": "/admin/places",
  // Points, rewards and the fresh-start reset live under Scoring & rewards.
  "/characters": "/admin/season",
  "/summary": "/admin/season",
  "/scoring": "/admin/season",
};

/** An admin section's own main page, for "Close admin" and "Lock admin". */
const PAGE_FOR_ADMIN: Record<string, string> = {
  tasks: "/tasks",
  chores: "/chores",
  calendar: "/calendar",
  addresses: "/calendar",
  "event-names": "/calendar",
  exercise: "/exercise",
  bible: "/bible",
  school: "/school",
  groceries: "/groceries",
  money: "/money",
  games: "/games",
  hockey: "/hockey",
  places: "/places",
  season: "/characters",
};

/** "/admin/bible/progress" → "/bible"; the hub and settings → home. */
export function pageForAdmin(path: string): string {
  return PAGE_FOR_ADMIN[path.split("/")[2] ?? ""] ?? "/";
}
