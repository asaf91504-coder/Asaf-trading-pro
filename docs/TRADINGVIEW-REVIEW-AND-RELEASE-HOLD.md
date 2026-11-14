# TradingView integration review and release hold

Reviewed: 2026-11-13.

## Release instruction

The owner requests saving ongoing changes in GitHub and publishing to the website later. Keep changes on feature branches / pull requests. Do not merge to main or deploy until the owner explicitly requests publication. PR #36 remains open and unmerged. Do not purchase services as part of this work.

## Proposed experience

Customers see only a chat. They request a symbol and receive analysis based on market data, without uploading chart screenshots. A hidden TradingView widget was proposed as the underlying source.

## Findings

- Embedded widgets do not expose a supported data-export interface for the assistant. Hiding the widget does not grant processing rights.
- There is an official TradingView MCP server. It supports symbol search, OHLCV history, screeners and other research tools. Access requires Essential or higher; trial plans exclude MCP. Authentication uses OAuth 2.1.
- Section 27.3 limits MCP to personal, non-commercial use and excludes business use and applications other people can use or instruct. Section 27.4 provides only a limited personal AI-processing exception. Therefore the public terms do not authorize ASAF Pro's customer-facing service.
- No publicly documented commercial MCP package authorizing this use was located in this review. This is not proof that a negotiated arrangement is impossible.
- A personal subscription, hidden chart, browser screenshot automation, or each customer bringing a subscription should not be treated as confirmed commercial authorization.

## Required before implementation

Obtain written approval covering the customer-facing application, third-party model processing, retained conversations and derived analysis, applicable exchange entitlements, supported authentication model and total pricing. Confirm freshness and coverage per instrument. No TradingView account was connected, no data was extracted, and no service purchased during this review.

## Official sources

- https://www.tradingview.com/mcp/docs
- https://www.tradingview.com/policies/ (sections 3, 12 and 27)
- https://www.tradingview.com/widget-docs/faq/data/

Technical ability and commercial permission are separate checks. The current assessment is: technically promising via official MCP, not authorized for this commercial use by the standard published terms.
