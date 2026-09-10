import Link from "next/link";
import { AdminBack } from "@/components/admin-back";
import {
  DeviceIcon,
  PaletteIcon,
  MailIcon,
  PeopleIcon,
  StarIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

type Tile = { href: string; label: string; blurb: string; icon: React.ReactNode };

const TILES: Tile[] = [
  {
    href: "/admin/device",
    label: "Device",
    blurb: "Shared or personal mode for this screen; require sign-in",
    icon: <DeviceIcon className="h-7 w-7" />,
  },
  {
    href: "/admin/appearance",
    label: "Appearance",
    blurb: "Color theme and dark mode for the household's web view",
    icon: <PaletteIcon className="h-7 w-7" />,
  },
  {
    href: "/admin/email",
    label: "Email",
    blurb: "SMTP server for sending invites, with a test button",
    icon: <MailIcon className="h-7 w-7" />,
  },
  {
    href: "/setup",
    label: "Household",
    blurb: "People, roles, PINs, scoring start date",
    icon: <PeopleIcon className="h-7 w-7" />,
  },
  {
    href: "/admin/season",
    label: "Season planner",
    blurb: "Project leveling at the loaded workload; set season length",
    icon: <StarIcon className="h-7 w-7" />,
  },
];

export default async function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <AdminBack />

      <header className="mb-8 mt-5 border-b border-hairline pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Device and appearance for this screen, plus household setup.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className="flex h-full flex-col gap-3 rounded-2xl border border-hairline bg-surface p-5 transition-all hover:border-accent hover:shadow-sm"
            >
              <span className="text-accent">{tile.icon}</span>
              <span className="font-display text-lg font-semibold">{tile.label}</span>
              <span className="text-sm text-muted">{tile.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
