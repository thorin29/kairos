import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { AdminLock } from "@/components/admin-lock";
import { UserBadge } from "@/components/user-badge";
import { isAdmin, adminPinSet } from "@/lib/session";
import { currentUser } from "@/lib/user-session";
import { loginRequired, isPublicPath } from "@/lib/gate";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
