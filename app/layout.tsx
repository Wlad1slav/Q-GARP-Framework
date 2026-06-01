import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quality Growth at a Reasonable Price",
  description: "Quality growth checklist / Чеклист якісного зростання за розумною ціною",
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
