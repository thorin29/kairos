import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/user-session";
import { getFamilyColor, getFamilyAvatar } from "@/lib/settings";
import { Card, SectionHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

function versionLabel(d: {
  clientVersion: string | null;
  clientBuild: number | null;
}): string {
  if (d.clientVersion) return `v${d.clientVersion}`;
  if (d.clientBuild) return `Build ${d.clientBuild}`;
  return "Not reported yet";
}

function lastSeenLabel(when: Date | null): string {
  if (!when) return "never seen";
  const days = Math.floor((Date.now() - when.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return when.toLocaleDateString();
}

/**
 * The shared "Family" identity's page — reached by tapping the Family profile
 * on a shared device. Read-only: shows each person's phones and the app version
 * each is running, so it's easy to see who needs to update.
 */
export default async function FamilyPage() {
  const me = await currentUser();
  if (!me) redirect("/unlock");

  const [familyColor, familyAvatar, people] = await Promise.all([
    getFamilyColor(),
    getFamilyAvatar(),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        color: true,
        avatarPath: true,
        avatarPosition: true,
        devices: {
          where: { revokedAt: null },
          orderBy: [{ lastSeenAt: "desc" }],
          select: {
            id: true,
            name: true,
            clientBuild: true,
            clientVersion: true,
            lastSeenAt: true,
          },
        },
      },
    }),
  ]);

  const withPhones = people.filter((p) => p.devices.length > 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-8 mt-5 flex items-center gap-4 border-b border-hairline pb-5">
        <Avatar
          name="Family"
          color={familyColor}
          avatarPath={familyAvatar.path}
          avatarPosition={familyAvatar.position}
          size="lg"
        />
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Family
          </h1>
          <p className="mt-1 text-muted">This shared device.</p>
        </div>
      </header>

      <SectionHeading>Phones &amp; app versions</SectionHeading>
      {withPhones.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No phones are set up yet.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {withPhones.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar
                  name={p.displayName ?? p.name}
                  color={p.color}
                  avatarPath={p.avatarPath}
                  avatarPosition={p.avatarPosition}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {p.displayName ?? p.name}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {p.devices.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-muted">
                      {d.name?.trim() || "Phone"}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-medium tabular">{versionLabel(d)}</span>
                      <span className="ml-2 text-xs text-muted">
                        {lastSeenLabel(d.lastSeenAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
