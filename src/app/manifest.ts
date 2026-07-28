import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kairos",
    short_name: "Kairos",
    description: "Chores, school, and schedules for the whole house",
    start_url: "/",
    display: "standalone",
    background_color: "#edf1f5",
    theme_color: "#0f5c63",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
