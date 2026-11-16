# Market Q&A scope

ASAF chat provides focused market, company/earnings/filing, chart, risk and product questions and answers. It is not a general assistant. Existing chart actions and user-confirmed journal drafts remain supported.

Explicit requests for agents, recurring work and common unrelated creation tasks are rejected server-side before model/search calls and before credit reservations. The multilingual system instruction handles semantic scope and returns a refusal marker; this becomes HTTP 422 so the existing credit wrapper refunds its reservation. Semantic refusal can still consume provider tokens. Pattern detection and model instructions cannot guarantee detection of every adversarial paraphrase. No agent runner, scheduling or arbitrary execution tools are exposed by these endpoints.

No plan quotas or prices changed: the current free-model route requires consent for one credit, reserves atomically, blocks exhausted balances and refunds unsuccessful responses. Paid inference/search remain disabled pending verified cost ceilings. This change does not activate them.
