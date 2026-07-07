import "./globals.css";

export const metadata = {
  title: "Theia — threat advisory in, grounded intel out",
  description:
    "Drop a threat advisory PDF. Every observable, named threat, and vendor rule is pulled out and linked to the exact line that proves it. 100% deterministic, client-side, no LLM.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
