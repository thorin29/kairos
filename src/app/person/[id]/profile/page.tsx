import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = await prisma.user.findUnique({ where: { id } });
  if (!person) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <BackLink href={`/person/${id}`} label={person.name} />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Profile
        </h1>
        <p className="mt-2 text-muted">
          Pick a picture and a colour. Both show up across the dashboard.
        </p>
      </header>

      <ProfileForm
        person={{
          id: person.id,
          name: person.name,
          displayName: person.displayName,
          color: person.color,
          avatarPath: person.avatarPath,
        }}
      />
    </main>
  );
}
