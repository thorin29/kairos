/** A video search for how a movement is done (kept apart from the library so
 *  the ⓘ popover doesn't pull the whole library into the page). */
export function watchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercise how to`)}`;
}
