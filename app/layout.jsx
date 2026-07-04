import "./globals.css";

export const metadata = {
  title: "KTLYST Extract — grounded intel from any advisory",
  description:
    "Drop a threat advisory PDF, get structured source-grounded intelligence. Every fact is checked against the document; fabricated ones are dropped.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
