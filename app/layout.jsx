import "./globals.css";

const TITLE = "Theia — pull IOCs from a threat intel report";
const DESC =
  "Paste a link to a threat intel report. Theia extracts every IOC, named threat, and vendor rule, each tied to the exact line that proves it. Deterministic, no model, no signup.";

export const metadata = {
  metadataBase: new URL("https://theia.ktlystlabs.com"),
  title: TITLE,
  description: DESC,
  keywords: [
    "IOC extractor", "indicators of compromise", "threat intelligence",
    "threat intel report", "CISA advisory", "MITRE ATT&CK", "Sigma rules",
    "detection engineering", "SOC", "deterministic", "no LLM",
  ],
  authors: [{ name: "KTLYST Labs" }],
  openGraph: {
    type: "website",
    url: "https://theia.ktlystlabs.com",
    siteName: "Theia",
    title: TITLE,
    description: DESC,
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Theia — pull the IOCs out of a threat intel report" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://theia.ktlystlabs.com" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
