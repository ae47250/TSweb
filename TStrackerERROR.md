# TStrackerERROR

This file tracks Alpha Tree Service offline parser/validator simulation error rates over time.

## Error Rate Formula

Error rate = failing cases / total cases in the fixture.

For the master 80 fixture, a case counts as failing when one of these happens:

- A parse-ready case no longer preserves its expected parser fields on the first pass.
- A blocked case is still blocked after three simulated follow-up rounds.
- A warning-policy case breaks the expected non-blocking warning behavior.

For the hard 80 fixture, the same formula is used, but the fixture is intentionally selected from current failures. That means the hard fixture is an improvement benchmark, not a reason by itself to fail the whole test suite.

## Current Fixtures

- `tests/fixtures/alpha-master-80-cases.json`: stable guardrail; should stay at 0% failure.
- `tests/fixtures/alpha-HARD-80-cases.json`: hard improvement benchmark selected from the 2,000-case dataset on 2026-06-30.

## Run Log

| Date | Fixture | Commit / state | Command | Total | Failing | Error rate | Initially ready | Recovered after follow-up | Still blocked | Failure categories |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-06-30 | master 80 | `bcc54f3` | `node --test tests/alpha-followup-simulation.test.js` | 80 | 0 | 0.00% | 65 | 15 | 0 | none |
| 2026-06-30 | master 80 | `c05cc50` | `node --test tests/alpha-followup-simulation.test.js` | 80 | 0 | 0.00% | 65 | 15 | 0 | none |
| 2026-06-30 | master 80 | `c05cc50` + local rules-test rename | `node --test tests/alpha-80-RULES-simulation.test.js` | 80 | 0 | 0.00% | 65 | 15 | 0 | none |
| 2026-06-30 | hard 80 | `c05cc50` + local hard fixture | `node --test tests/alpha-80-RULES-simulation.test.js` | 80 | 80 | 100.00% | 51 | 29 | 0 | parser_price_options 45; parser_tree_count 35; validator_readiness 23; parser_name 10 |

## Error Rate Bar Chart

Scale: each `#` is 5 percentage points.

```text
master bcc54f3        |   0.00% |
master c05cc50        |   0.00% |
master local rules    |   0.00% |
hard local baseline   | 100.00% | ####################
```

## Category Tracking

Categories currently tracked by the rules simulation:

- `parser_name`
- `parser_contact`
- `parser_address`
- `parser_tree_count`
- `parser_price_options`
- `validator_readiness`
- `warning_policy`
- `follow_up_unrecovered`

When product rules change, update `tests/alpha-80-RULES-simulation.test.js` first, rerun the fixture, then append a new row here. A higher master 80 error rate usually means regression. A lower hard 80 error rate usually means parser/validator improvement.
