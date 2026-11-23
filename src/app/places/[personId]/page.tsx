import { renderHistory } from "../render";

export const dynamic = "force-dynamic";

/** Places → a person's day: path, stops and trips, with replay (v0.758). */
export default async function PlacesHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { personId } = await params;
  const { date } = await searchParams;
  return renderHistory(personId, date, false);
}
