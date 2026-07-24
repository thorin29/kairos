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
  // The unlock page deliberately lives outside /admin. Nesting it here made
  // the guard redirect that page to itself, which is an infinite loop and a
  // 500 rather than a login prompt.
  if (!(await isAdmin())) redirect("/unlock");
  return <>{children}</>;
}
