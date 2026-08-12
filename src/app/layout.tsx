import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { AdminLock } from "@/components/admin-lock";
import { UserBadge } from "@/components/user-badge";
import { isAdmin, adminPinSet } from "@/lib/session";
import { currentUser } from "@/lib/user-session";
import { loginRequired, isPublicPath } from "@/lib/gate";

// Self-hosted so the production build never depends on fetching from Google
// Fonts at build time (a flaky, deploy-blocking network step in CI). Same
// families, weights and CSS variables as before.
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-variable.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

const plexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "καιρός",
  description: "Chores, school, and schedules for the whole house",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// The layout reads the admin lock state (cookie + DB) on each request.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [unlocked, pinSet, me, gate, path] = await Promise.all([
    isAdmin(),
    adminPinSet(),
    currentUser(),
    loginRequired(),
    headers().then((h) => h.get("x-pathname") ?? "/"),
  ]);

  // When login is required, every page but the public ones needs a session.
  // The gate is here (not middleware) because deciding it needs the database.
  if (gate && !me && !isPublicPath(path)) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  return (
    <html lang="en">
      <body
        className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} min-h-dvh bg-ground text-ink antialiased`}
      >
        {children}
        <AdminLock unlocked={unlocked} pinSet={pinSet} />
        {me && (
          <UserBadge
            name={me.displayName ?? me.name}
            color={me.color}
            avatarPath={me.avatarPath}
          />
        )}
      </body>
    </html>
  );
}
