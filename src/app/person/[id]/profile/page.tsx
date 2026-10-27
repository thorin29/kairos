import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { currentUser } from "@/lib/user-session";
import { BackLink } from "@/components/back-link";
import { fromDateColumn } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [person, me] = await Promise.all([prisma.user.findUnique({ where: { id } }), currentUser()]);
  if (!person) notFound();
  // Your own profile, and you sign in with a password.
  const ownPassword = me?.id === person.id && person.passwordHash != null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <BackLink href={`/person/${id}`} label={person.name} />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="mt-2 text-muted">
          Pick a picture and a color. Both show up across the dashboard.
        </p>
      </header>

      <ProfileForm
        canEditName={await isAdmin()}
        person={{
          id: person.id,
          name: person.name,
          displayName: person.displayName,
          color: person.color,
          avatarPath: person.avatarPath,
          avatarPosition:
            (person as { avatarPosition?: string }).avatarPosition ?? "50% 50%",
          birthdayISO: person.birthday ? fromDateColumn(person.birthday) : null,
          shadeBirthday:
            (person as { shadeBirthday?: boolean }).shadeBirthday ?? true,
        }}
      />

      {ownPassword && <PasswordForm />}
    </main>
  );
}
