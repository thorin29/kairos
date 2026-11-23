import { renderHistory } from "../../render";

export const dynamic = "force-dynamic";

/** A person's day in the phone app's WebView (v0.762). */
export default async function PlacesEmbedHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { personId } = await params;
  const { date } = await searchParams;
  return renderHistory(personId, date, true);
}
