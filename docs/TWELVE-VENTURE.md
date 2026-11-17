# Twelve Data Venture presentation — proposed scope

Implemented 17 November 2026 against Liam's clarification in the commercial-licence email thread. This is an implementation proposal for the USD 149 Venture budget, not written approval of the revised scanner or a purchase. Existing owner-only, expiry and public-licence gates remain in effect. Obtain confirmation of this exact revised design before enabling external customer access.

## Chart

Authenticated `public-market` returns a server-rendered PNG plus symbol, interval, source, snapshot receipt time and candle dates/count. The browser receives no numerical OHLCV series, SVG paths, data table or provider-data download. Symbol and interval selection request a new raster image. There is no local zoom, pan or price hover. MA20 and MA150 are included; selected moving averages, support/resistance and pattern overlays are calculated and rasterized on the server. Rendering supports candles and line views. Other indicator questions can be answered by the server-side AI, without claiming an unsupported visual overlay.

AI and chart rendering resolve the same timestamped cached provider dataset. The browser sends the dataset receipt, not bars, for Twelve Data analysis. A changed snapshot is rejected. Old raw-data browser sessions and scanner dataset events are rejected. The old passcode market endpoint is retired with HTTP 410.

The PNG and its surrounding UI attribute Twelve Data. A small, licensed ASCII font is bundled to keep chart labels visible in serverless runtimes. Rendered images may be saved; no raw price download is provided.

## Scanner

Scanning and all filtering happen on the server over the configured US-symbol allowlist (maximum 50; 10 per request). Previous daily sessions only are used; today's bar is excluded. Full EOD volume is distinguished from the non-consolidated intraday feed described by Liam. Missing or expired market cap fails a positive cap threshold.

The response uses an explicit allowlist: symbol, provenance dates, pass/fail and reasons, MA position booleans, ATR%, RVOL, RSI, ADX, trend direction, pattern type/stage and scenario percentages/ratios. No bars, close price, absolute moving-average values, pivot prices, raw volume, fundamental data values or absolute scenario levels are sent. CSV exports these derived results only. Clicking a result opens a separately rendered chart image.

Changing filters requires an explicit update. Cached filtering cannot fetch missing price series or missing fundamentals, and therefore cannot silently consume provider credits. Automatic background scanning from the browser is disabled. Existing bounded discovery and provider quotas remain. When the shared three-hour scanner is enabled, browser requests read that shared snapshot and receive the same derived-only projection; they never trigger a provider scan. Existing owner-reviewed setup publishing is preserved.

## AI

Inference stays server-side under the existing AI permission gate. Concise derived analysis and conditional entry/stop levels remain available. Raw provider dataset/export requests are rejected; the model is instructed not to reconstruct raw tables or bulk price series. This change does not activate paid inference or change model routing.

## Commercial review questions

Please confirm that Venture at USD 149/month permits:

1. The raster-only chart flow above, including new image generation for symbol/interval choices and server-generated annotations, without sending numerical chart series to browsers.
2. A server-only scanner whose API/CSV exposes only the derived fields listed above and no raw or last-close prices.
3. US data sent server-to-server for inference only, with no training/fine-tuning, and the current attribution placement.

The personal trial remains limited to its designated owner and expiry. No plan was purchased, upgraded or opened to customers by this change.
