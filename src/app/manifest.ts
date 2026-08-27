import type { MetadataRoute } from "next";

/**
 * Web App Manifest for PalmTrack install metadata.
 *
 * Provides standalone installability and theme styling using existing design tokens.
 * Explicit scope: Install metadata only (no service worker, cache strategy, or background sync).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PalmTrack",
    short_name: "PalmTrack",
    description: "ระบบบริหารงานวิจัยและสวนปาล์มสำหรับโครงการศรีสาคร",
    lang: "th",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#233b68",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
