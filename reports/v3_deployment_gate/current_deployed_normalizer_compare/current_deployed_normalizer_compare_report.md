# Current Deployed Normalizer Compare

Fresh deployed OpenAI calls were run once for each of the 30 gate notes.
Those AlphaJSON outputs were then scored four ways against the same answer key:

| Setup | Price Pair | Phone | Email | A Desc F1 | B Desc F1 | Mean Desc F1 | Services F1 | Exceptions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Current deployed | 97% | 100% | 100% | 0.871 | 0.766 | 0.819 | 0.417 | 0 |
| Current deployed + HEAD normalize | 97% | 100% | 100% | 0.871 | 0.766 | 0.819 | 0.417 | 0 |
| Current deployed + HEAD validate | 97% | 100% | 100% | 0.871 | 0.770 | 0.821 | 0.417 | 0 |
| Current deployed + HEAD normalize + HEAD validate | 97% | 100% | 100% | 0.871 | 0.766 | 0.819 | 0.417 | 0 |

## Setup Definitions

- `Current deployed`: live deployed `/api/openai` output, then live deployed `/api/validate`.
- `Current deployed + HEAD normalize`: live deployed `/api/openai` output, then staged `lib/normalizeAlphaJson.js`, then live deployed `/api/validate`.
- `Current deployed + HEAD validate`: live deployed `/api/openai` output, then staged `lib/validateJson.js`.
- `Current deployed + HEAD normalize + HEAD validate`: live deployed `/api/openai` output, then staged normalize and staged validate.

## Notes

- The scorer is unchanged and the answer key was not exposed to the model calls.
- Exceptions count any local pipeline failures in the evaluation harness.
- `Mean Desc F1` is computed as the average of option A and option B description F1.

## Key Row Deltas

- `test_000033` is the single price-pair miss in every setup. Predicted prices were `a=3450, b=null`; the answer key expects `a=2200, b=3450`.
- `test_000158` is the only row changed by `HEAD validate`. Baseline kept option B as `drop tree leave brsh and stump grinding`; `HEAD validate` narrowed option B to `stump grinding`.
- `HEAD normalize` produced the exact same 30 prediction rows as current deployed.
- `HEAD normalize + HEAD validate` also matched current deployed exactly on this run.

## Generated Files

- Predictions: `reports\v3_deployment_gate\current_deployed_normalizer_compare\current_deployed_predictions.jsonl`, `reports\v3_deployment_gate\current_deployed_normalizer_compare\current_deployed_head_normalize_predictions.jsonl`, `reports\v3_deployment_gate\current_deployed_normalizer_compare\current_deployed_head_validate_predictions.jsonl`, `reports\v3_deployment_gate\current_deployed_normalizer_compare\current_deployed_head_normalize_validate_predictions.jsonl`
- Report JSON: `reports\v3_deployment_gate\current_deployed_normalizer_compare\current_deployed_normalizer_compare_summary.json`
