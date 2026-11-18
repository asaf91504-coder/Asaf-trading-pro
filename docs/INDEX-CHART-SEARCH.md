# Index chart search audit

The catalogue is a dated holdings proxy, not an official index-constituent list or a guarantee of Twelve Data coverage. Source holdings as of November 16, 2026:

| Group | Source | Equity rows | Listed symbols retained |
| --- | --- | ---: | ---: |
| S&P 500 | [iShares IVV](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv) | 505 | 503 |
| Russell 2000 | [iShares IWM](https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/latest-holdings.csv) | 1970 | 1959 |

All 2,462 distinct listed symbols are searchable by ticker/name, selectable by group, and accepted by chart symbol validation. Shortcuts including CRWV and crypto remain. Exact tickers take priority over substring results. Search has 24-item pages and a Show More button. The UI labels the source basis and date instead of claiming current index membership or verified market-data availability.

Excluded records and their names are recorded in `indexCatalogueMetadata.excluded`. Cash, futures, warrants, unlisted and restricted/private records are not ordinary listed shares. Share-class spaces become dots (BRK B → BRK.B); actual provider coverage of those symbols remains to be verified. No prices, volumes, holding quantities or portfolio weights are redistributed in the catalogue.

The scanner still uses `ASAF_MARKET_ALLOWED_SYMBOLS` (maximum 50). Chart symbols use its union with the catalogue and optional `ASAF_MARKET_CHART_SYMBOLS` extras. No scan cadence, quota, billing flag, public licensing flag or trial-owner gate changed. Listing/searching symbols makes no quote API requests. Selecting a chart uses the existing authenticated provider path, cache and shared quotas. No bulk live-data sweep was run: it would unnecessarily consume thousands of provider credits. Unauthorized and expired trial access remain blocked.

To refresh: download the two public source CSVs, then run `python scripts/import-index-catalogue.py /path/ivv.csv /path/iwm.csv`. The importer checks counts and duplicates, records provenance and exclusions, and emits names/symbols only. Review the diff and run `node --test tests/*.test.mjs` before deployment. Refresh is manual; a stale snapshot is not silently advertised as current.

Validation: exhaustive offline checks of every imported ticker through search resolution, exact-match ranking and server selection; exhaustive pagination/group membership; provider restriction filtering; class-share symbols; private owner isolation; full existing regression suite. This does not certify a successful live quote for every symbol, official index completeness, or permission to expose trial data to customers.
