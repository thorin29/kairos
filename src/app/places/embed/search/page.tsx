import { renderSearch } from "../../render";

export const dynamic = "force-dynamic";

/** Places in the phone app's WebView (v0.795); proxy.ts checks the Places cookie. */
export default async function PlacesEmbedSearchPage() {
  return renderSearch(true);
}
