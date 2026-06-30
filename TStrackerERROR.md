# TStrackerERROR

This file tracks Alpha Tree Service offline parser/validator simulation error rates over time.

## Error Rate Formula

Error rate = failing cases / total cases in the fixture.

A case counts as failing when one of these happens:

- Expected parser fields are not preserved on the first pass.
- A case that should be estimate-ready is blocked.
- A case that should block is allowed through without the needed follow-up.
- A warning-policy case breaks the expected non-blocking warning behavior.
- A case is still blocked after three simulated follow-up rounds.

Cases that are blocked at first but recover through simulated follow-up are not failures.

## Current Cohorts

The six messiness cohorts are selected by intrinsic record properties first, then measured. Their failure rates are not selection targets, except that `uber-plus-messy` is intentionally more failure-dense as an extreme stress cohort.

| Fixture | Role | Initial failing | Initial error rate |
| --- | --- | ---: | ---: |
| `tests/fixtures/alpha-easy-150-initial-4pct-2026-06-30-cases.json` | Clean and simple customer notes. | 6 / 150 | 4.00% |
| `tests/fixtures/alpha-medium-150-initial-4pct-2026-06-30-cases.json` | Mild single-field or formatting issues. | 6 / 150 | 4.00% |
| `tests/fixtures/alpha-medium-messy-150-initial-7pct-2026-06-30-cases.json` | Moderate but inferable customer-note messiness. | 10 / 150 | 6.67% |
| `tests/fixtures/alpha-very-messy-150-initial-11pct-2026-06-30-cases.json` | Severe but mostly resolvable note complexity. | 17 / 150 | 11.33% |
| `tests/fixtures/alpha-uber-messy-150-initial-16pct-2026-06-30-cases.json` | Missing, ambiguous, or follow-up-heavy cases. | 24 / 150 | 16.00% |
| `tests/fixtures/alpha-uber-plus-messy-150-initial-39pct-2026-06-30-cases.json` | Extreme stress cohort selected from unused high-risk cases. | 59 / 150 | 39.33% |
| `tests/fixtures/alpha-hard-knownfail-150-initial-100pct-2026-06-30-cases.json` | Known-failure improvement backlog; not representative. | 150 / 150 | 100.00% |

## Initial Run Log

| Date | Fixture | Commit / state | Command | Total | Failing | Error rate | Initially ready | Recovered after follow-up | Still blocked | Failure categories |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-06-30 | easy 150 | `5ec5c9e` selection baseline | `node --test tests/alpha-cohort-RULES-simulation.test.js` | 150 | 6 | 4.00% | 150 | 0 | 0 | parser_name 5; parser_tree_count 1 |
| 2026-06-30 | medium 150 | `5ec5c9e` selection baseline | `node --test tests/alpha-cohort-RULES-simulation.test.js` | 150 | 6 | 4.00% | 150 | 0 | 0 | parser_name 4; parser_tree_count 2 |
| 2026-06-30 | medium-messy 150 | `5ec5c9e` selection baseline | `node --test tests/alpha-cohort-RULES-simulation.test.js` | 150 | 10 | 6.67% | 150 | 0 | 0 | parser_price_options 8; parser_tree_count 2 |
| 2026-06-30 | very-messy 150 | `5ec5c9e` selection baseline | `node --test tests/alpha-cohort-RULES-simulation.test.js` | 150 | 17 | 11.33% | 128 | 22 | 0 | parser_name 2; parser_price_options 5; parser_tree_count 1; validator_readiness 9 |
| 2026-06-30 | uber-messy 150 | `5ec5c9e` selection baseline | `node --test tests/alpha-cohort-RULES-simulation.test.js` | 150 | 24 | 16.00% | 0 | 150 | 0 | parser_name 2; parser_tree_count 22 |
| 2026-06-30 | uber-plus-messy 150 | `976098c` selection baseline | `node --test tests/alpha-cohort-RULES-simulation.test.js` | 150 | 59 | 39.33% | 62 | 88 | 0 | parser_name 10; parser_price_options 21; parser_tree_count 2; validator_readiness 26 |
| 2026-06-30 | hard-knownfail 150 | `5ec5c9e` selection baseline | `node --test tests/alpha-cohort-RULES-simulation.test.js` | 150 | 150 | 100.00% | 67 | 83 | 0 | parser_price_options 96; parser_tree_count 122; validator_readiness 68 |

## Error Rate Bar Chart

Scale: each `#` is 5 percentage points.

```text
easy 150           |   4.00% | #
medium 150         |   4.00% | #
medium-messy 150   |   6.67% | #
very-messy 150     |  11.33% | ##
uber-messy 150     |  16.00% | ###
uber-plus-messy 150|  39.33% | ########
hard-knownfail 150 | 100.00% | ####################
```

## How To Read Movement

- If easy or medium gets worse, treat it as a likely regression.
- If medium-messy, very-messy, uber-messy, or uber-plus-messy improves, parser/validator behavior is getting better on harder notes.
- If hard-knownfail improves, known weak spots are being fixed.
- If hard-knownfail improves but intrinsic cohorts get worse, the app may be overfitting to the known failures.

With 150 cases, small moves of a few percentage points can be noise. The signal is strongest when a tier moves by several cases and the failure categories point in the same direction.

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

When product rules change, update `tests/alpha-cohort-RULES-simulation.test.js` first, rerun the fixtures, then append a new row here. The fixture files should remain frozen unless the cohort strategy itself is intentionally reset.

## Archived Prior 80-Case Runs

These rows came before the 150-case cohort reset and are retained only as history.

| Date | Fixture | Commit | Failing | Error rate |
| --- | --- | --- | ---: | ---: |
| 2026-06-30 | master 80 | `bcc54f3` | 0 / 80 | 0.00% |
| 2026-06-30 | master 80 | `c05cc50` | 0 / 80 | 0.00% |
| 2026-06-30 | hard 80 | `5ec5c9e` | 80 / 80 | 100.00% |
