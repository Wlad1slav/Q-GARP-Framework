import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quality Growth at a Reasonable Price",
  description: "Quality growth checklist / Чеклист якісного зростання за розумною ціною",
  openGraph: {
    title: "Quality Growth at a Reasonable Price",
    description: "Quality growth checklist / Чеклист якісного зростання за розумною ціною",
    siteName: "Invest Rate",
    locale: "uk_UA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
