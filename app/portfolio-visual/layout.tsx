import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio Visual · Q-GARP",
  description: "Generate a shareable portfolio allocation poster from Yahoo, Revolut, or IBKR CSV exports, or try a public-disclosure example.",
};

export default function PortfolioVisualLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
