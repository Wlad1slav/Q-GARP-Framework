import type { Metadata } from "next";
import { AppHeader } from "./app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-GARP Framework",
  description: "Quality growth checklist / Чеклист якісного зростання за розумною ціною",
  openGraph: {
    title: "Q-GARP Framework",
    description: "Quality growth checklist / Чеклист якісного зростання за розумною ціною",
    siteName: "Q-GARP Framework",
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
      <body>
        <AppHeader />
        <div className="appContent">{children}</div>
      </body>
    </html>
  );
}
