import { renderPlaces } from "./render";

export const dynamic = "force-dynamic";

/** Places (v0.757): where everyone is, on one Google map. */
export default async function PlacesPage() {
  return renderPlaces(false);
}
