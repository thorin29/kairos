import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ProfilePicker } from "./profile-picker";

export const dynamic = "force-dynamic";

export default async function SwitchPage() {
  const [people, current] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    }),
    getCurrentUser(),
  ]);

  if (people.length === 0) redirect("/setup");

  const profiles = people.map((p) => ({
    id: p.id,
    name: p.displayName ?? p.name,
    color: p.color,
    avatarPath: p.avatarPath,
    isAdmin: p.role === "ADMIN",
    hasPin: Boolean(p.pinHash),
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Who&rsquo;s using this?
        </h1>
        <p className="mt-2 text-muted">
          Pick your profile. Parent accounts ask for a PIN.
        </p>
      </header>

      <ProfilePicker profiles={profiles} currentId={current?.id ?? null} />
    </main>
  );
}
