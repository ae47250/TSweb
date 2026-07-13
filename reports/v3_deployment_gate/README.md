# Version 3.0 Deployment Gate

This package compares the current deployed extractor with the staged Version 3.0 extractor on the same 30 complete tree-service notes.

## Files

- `v3_gate_input.jsonl`: send these exact records through both pipelines.
- `prediction_template.jsonl`: required prediction schema.
- `v3_gate_answer_key.jsonl`: hidden ground truth.
- `score_v3_gate.py`: comparison scorer.

## Prediction schema

Each pipeline must produce one JSON object per line:

```json
{
  "case_id": "test_000001",
  "customer_name": "Donald R",
  "phone": "812-859-8965",
  "email": "21ramos@aol.com",
  "option_a_description": "remve tree leave wood onsite",
  "option_a_price": 3050,
  "option_b_description": "drop n haul logs and brush cleanup",
  "option_b_price": 5700,
  "option_b_additional_services": ["haul logs", "brush cleanup"]
}
```

## Run

```bash
python score_v3_gate.py   --answer-key v3_gate_answer_key.jsonl   --deployed deployed_predictions.jsonl   --staged staged_predictions.jsonl
```

## Recommended deployment gate

Deploy Version 3.0 only when:

1. No regression in phone, email, Option A price, or Option B price exact accuracy.
2. Overall Option A/B price-pair accuracy is at least 97%.
3. Hard-bucket price-pair accuracy is at least 90%.
4. Mean option-description token F1 is at least 0.90.
5. Review every material failure involving swapped prices or merged option descriptions.

The 30-row gate is useful for fast release checks. Confirm the decision on the full 300-row TEST dataset before production rollout.
