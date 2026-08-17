import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Signal — Know the company. See the signal.",
    template: "%s · Signal",
  },
  description:
    "Turn scattered company records, product activity, news, and operating context into one source-aware intelligence brief.",
  applicationName: "Signal",
  keywords: [
    "company intelligence",
    "GitHub activity",
    "company news",
    "AI research",
  ],
  authors: [{ name: "Signal" }],
  creator: "Signal",
  openGraph: {
    type: "website",
    title: "Signal — Know the company. See the signal.",
    description:
      "Scattered public company data, connected into one clear brief.",
    siteName: "Signal",
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 1024,
        alt: "Signal company intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Signal — Know the company. See the signal.",
    description:
      "Scattered public company data, connected into one clear brief.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      data-theme="dark"
      className="dark h-full antialiased"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
