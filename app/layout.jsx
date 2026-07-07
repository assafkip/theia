import "./globals.css";

export const metadata = {
  title: "Theia — pull IOCs from a threat intel report",
  description:
    "Paste a link to a threat intel report. Theia extracts every IOC, named threat, and vendor rule, each tied to the exact line that proves it. Deterministic, no model, no signup.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
