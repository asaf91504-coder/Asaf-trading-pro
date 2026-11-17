# OpenAI API subscription benefit

The subscription benefit has been claimed and a project API key provisioned securely. Credits belong to the selected organization, expire each billing cycle, and the initial grant can be prorated. Do not add a payment method, buy credits or enable Auto Recharge as part of activation.

This change preserves the deployed OpenRouter configuration until the following server-only variables are deliberately set in Netlify:

```
ASAF_AI_PROVIDER=openai
ASAF_OPENAI_ENABLED=true
OPENAI_API_KEY=<secure project key from the credited organization>
OPENAI_MODEL=gpt-6.1-terra
```

Never write the key into source, a browser bundle, localStorage, chat or a commit. Keep `ASAF_CHAT_ENABLED=false` (the unrelated old private endpoint). Preserve existing public auth, Redis quotas, application credits and trial-owner restrictions.

The real `free-chat` endpoint now supports Responses API text/vision, bounded history, languages and existing validated chart actions. Requests use `store:false`, a single low-detail image, low reasoning effort, 1,800 output tokens and at most 48,000 UTF-8 text bytes, trimming oldest history first. No OpenAI-hosted tools, retries, auto top-ups or provider fallback are enabled. `store:false` does not assert Zero Data Retention: normal abuse-monitoring retention may apply.

GPT-6.1 Terra is fixed to avoid an arbitrary model bypassing the application-credit reservation. At the standard $1/M input, $1.25/M cache-write and $5/M output prices reviewed on 17 November, the request reserves $0.08 (four application credits). The UI must show and obtain consent to the quote. Existing OpenRouter remains one application credit. Recheck tokenization/pricing and test a real request before enabling production; account/regional pricing, other applications using the key and purchased balances are outside these application bounds. This code does not verify or promise the organization's grant balance.

Twelve Data's 17 November follow-up explicitly permits direct OpenAI inference for the sole owner during the evaluation trial, with `store:false`, no training/fine-tuning and no customers; ZDR is not required. `ASAF_TWELVE_OPENAI_LICENSE_CONFIRMED=true` is valid only alongside the existing owner identity and unexpired private-trial controls. Current chart context must come from the verified server snapshot, never client-supplied bars. Other users and expired trials cannot send trial charts, and all inherited history is excluded when it contains restricted data, including derived follow-ups.

The supplier separately says customer-facing interactive numerical charts, scanner raw bars and price exports require Enterprise. This activation does not authorize a customer rollout or purchase a new plan. Intrinio and CoinLore remain separately gated by `ASAF_INTRINIO_OPENAI_LICENSE_CONFIRMED` and `ASAF_CRYPTO_OPENAI_LICENSE_CONFIRMED`. Licensed news requires `ASAF_NEWS_OPENAI_LICENSE_CONFIRMED`; public RSS remains separate. OpenRouter web search is disabled on the OpenAI route because the benefit does not fund it.

Validation: 674 automated tests pass with external requests mocked. One live OpenAI request through the authenticated route using a 500-bar synthetic fixture returned a complete Hebrew analysis, entry/stop scenario and valid chart actions, without retry or fallback. Production acceptance still requires the deployed health/provider state and signed-in chart workflow. Retain owner/expiry and supplier gates; verify grant expiry and billing settings before later changes.

Rollback: restore `ASAF_AI_PROVIDER=openrouter` and leave the independently controlled free-route configuration unchanged.

Official references:
- https://developers.openai.com/api/docs/guides/chatgpt-api-credits
- https://developers.openai.com/api/docs/models/gpt-6.1-terra
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/reference/resources/responses/methods/create
