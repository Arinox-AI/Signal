import { describe, expect, it } from "vitest";

import { parseWebsiteProfile } from "./website-profile";

describe("website organization profile", () => {
  it("reads order-independent metadata and schema.org organization data", () => {
    const html = `
      <html>
        <head>
          <meta content="Alba Corporation" property="og:title" />
          <meta content="Dubai" name="geo.placename" />
          <meta content="A diversified UAE holding group." name="description" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Alba Corporation",
              "description": "A Dubai-based holding group.",
              "foundingDate": "2016",
              "knowsAbout": ["Automotive", "Real Estate"],
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Dubai",
                "addressCountry": "AE"
              }
            }
          </script>
        </head>
      </html>
    `;
    const profile = parseWebsiteProfile(html, new URL("https://albacorp.net/"));

    expect(profile.organizationName).toBe("Alba Corporation");
    expect(profile.countryName).toBe("United Arab Emirates");
    expect(profile.locality).toBe("Dubai");
    expect(profile.foundedYear).toBe(2016);
    expect(profile.industry).toBe("Automotive");
    expect(profile.description).toBe("A diversified UAE holding group.");
  });
});
