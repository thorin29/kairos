import { renderSearch } from "../render";

export const dynamic = "force-dynamic";

/** Places (v0.795): search where the family has been. */
export default async function PlacesSearchPage() {
  return renderSearch(false);
}
