# Q-GARP Framework

App for checking whether a public company
fits a quality growth at a reasonable price profile. Enter a ticker, review the
score, and compare growth, valuation, margins, and PEG adjusted for stock-based
compensation.

The app uses Yahoo Finance data through `yahoo-finance2`. It is a research
helper, not investment advice.

## Features

- Ticker analysis with a 0-100 quality/growth/valuation score.
- Five checklist areas: 5-year doubling pace, valuation, growth versus peers,
  margin quality, and PEG with SBC.
- S&P 500 top page at `/sp500-top`, with live batch scanning and leaderboards
  for each of the five indicators.
- Automatic Yahoo peer suggestions plus manually saved peer groups.
- Ukrainian and English UI copy.
- Lightweight API routes for ticker analysis, S&P 500 constituents, and batch
  S&P 500 scoring.

## App Pages

- `/` - single-ticker Q-GARP checklist with score breakdown, peer controls, and
  evidence for all five indicators.
- `/sp500-top` - S&P 500 scanner that ranks companies by overall score and by
  each indicator: doubling pace, valuation, growth, margins, and PEG with SBC.

## API

- `GET /api/analyze?ticker=AAPL` - returns the full checklist result for one
  ticker. Optional query params: `lang=uk|en`, `peers=MSFT,GOOGL,AMZN`.
- `GET /api/sp500-constituents` - returns the current S&P 500 constituent list
  used by the scanner.
- `GET /api/sp500-top?tickers=AAPL,MSFT,NVDA` - scores a small batch of S&P 500
  tickers and returns compact fields needed for the top page.

The deployed single-ticker API is available at
`https://q-garp.netlify.app/api/analyze?ticker=AAPL`.

## Methodology

The score is a confidence-aware Q-GARP checklist, not a simple average. The app
selects a sector profile, scores five weighted indicators, calculates data
confidence, then subtracts a risk/data penalty:

```text
final score = weighted raw score - risk/data penalty
```

Missing critical data is penalized instead of being silently ignored. The UI
shows the final score, raw score, confidence, scoring profile, penalty, and risk
flags. See [METHODOLOGY.md](METHODOLOGY.md) for the full formulas, weights, and
infographic-style Mermaid diagrams.

## Data Notes

Financial data availability depends on Yahoo Finance coverage for each ticker.
Some companies may have incomplete trailing financials, cash flow, SBC, peer, or
historical valuation data. Peer groups are best treated as a starting point and
reviewed manually for each company.

The S&P 500 scanner gets its constituent universe from Wikipedia and uses Yahoo
Finance for financial data. Batch scoring uses the same default methodology as
the single-ticker checklist, including Yahoo recommended peers. Browser-saved
manual peer groups from the single-ticker page are local to that page and are
not applied to the S&P 500 scanner.

## Forking

Forks are welcome. You can use, modify, publish, and adapt it with minimal restrictions. 

## License

MIT. See [LICENSE](LICENSE).
