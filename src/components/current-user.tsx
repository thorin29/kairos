import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { Avatar } from "@/components/avatar";

/**
 * Who the app thinks you are, and a way to change it. Sits in the header of
 * every page so a shared tablet never leaves you guessing whose list you're
 * looking at.
 */
export async function CurrentUserChip() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/switch"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link
      href="/switch"
      title="Switch profile"
      className="inline-flex h-11 items-center gap-2 rounded-full border border-hairline py-1 pl-1 pr-4 transition-colors hover:border-accent"
    >
      <Avatar
        name={user.displayName ?? user.name}
        color={user.color}
        avatarPath={user.avatarPath}
        size="sm"
      />
      <span className="text-sm font-medium">
        {user.displayName ?? user.name}
      </span>
    </Link>
  );
}
