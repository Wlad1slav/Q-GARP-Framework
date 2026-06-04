const LOGODEV_PUBLIC_TOKEN = process.env.NEXT_PUBLIC_LOGODEV_PUBLIC ?? "";

export function companyLogoUrl(symbol: string) {
  const ticker = symbol.trim().toUpperCase().replace(/\s+/g, "");

  return `https://img.logo.dev/ticker/${encodeURIComponent(ticker)}?token=${encodeURIComponent(LOGODEV_PUBLIC_TOKEN)}`;
}
