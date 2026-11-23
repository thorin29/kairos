import { renderPlaces } from "../render";

export const dynamic = "force-dynamic";

/** Places in the phone app's WebView (v0.762); proxy.ts checks the Places cookie. */
export default async function PlacesEmbedPage() {
  return renderPlaces(true);
}
