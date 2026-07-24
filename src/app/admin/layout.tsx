import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";

/**
 * One guard for every admin route. Putting it in the layout rather than in
 * each page means a new sub-page is protected the moment it exists — and a
 * typed URL never reaches one, which a per-page check invites you to forget.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect("/admin/unlock");
  return <>{children}</>;
}
