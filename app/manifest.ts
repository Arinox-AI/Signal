import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Signal — Company Intelligence",
    short_name: "Signal",
    description: "Source-aware public company intelligence briefs.",
    start_url: "/",
    display: "standalone",
    background_color: "#05070b",
    theme_color: "#05070b",
  };
}
