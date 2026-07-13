# Version 3.0 Deployment Gate Report

## Executive decision

**HOLD VERSION 3.0**

Version 3.0 passes the price-pair gate on this 30-row benchmark, but it fails the required mean option-description F1 threshold. It also regresses description extraction compared with the deployed pipeline.

## Code paths

- Current deployed: `https://tree-service-web-app.vercel.app/api/openai` followed by `https://tree-service-web-app.vercel.app/api/validate`.
- Staged Version 3.0: local branch API at `http://127.0.0.1:3000/api/openai` followed by `http://127.0.0.1:3000/api/validate`.
- Assumption: this repository does not expose two separate local implementations named deployed and v3. The closest staged implementation is the current local branch state; the deployed implementation is the hosted production route.

## Overall comparison

| Metric | Current deployed | Staged V3 |
| --- | --- | --- |
| Customer name exact | 100.0% | 100.0% |
| Phone exact | 100.0% | 100.0% |
| Email exact | 100.0% | 100.0% |
| Option A price exact | 100.0% | 100.0% |
| Option B price exact | 100.0% | 100.0% |
| A/B price-pair exact | 100.0% | 100.0% |
| Critical-row exact | 100.0% | 100.0% |
| Option A description F1 | 0.868 | 0.655 |
| Option B description F1 | 0.781 | 0.601 |
| Option B services F1 | 0.460 | 0.454 |
| Mean option-description F1 | 0.824 | 0.628 |

## Bucket comparison

| Bucket | Rows | Deployed pair | Staged pair | Deployed critical | Staged critical | Deployed desc F1 | Staged desc F1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| easy | 10 | 100.0% | 100.0% | 100.0% | 100.0% | 0.935 | 0.606 |
| medium | 10 | 100.0% | 100.0% | 100.0% | 100.0% | 0.807 | 0.586 |
| hard | 10 | 100.0% | 100.0% | 100.0% | 100.0% | 0.732 | 0.692 |

Hard-bucket price-pair exact is 100.0% for both pipelines. The staged hard-bucket description score is below the 0.90 deployment condition.

## Failure comparison

| Group | Cases |
| --- | --- |
| Failures fixed by V3 | none |
| Regressions introduced by V3 | test_000027, test_000123, test_000032 |
| Failures present in both | test_000006, test_000013, test_000008, test_000014, test_000073, test_000078, test_000083, test_000141, test_000007, test_000002, test_000033, test_000004, test_000005, test_000022, test_000055, test_000069, test_000074, test_000019, test_000045, test_000018, test_000058, test_000001, test_000064, test_000067, test_000079, test_000108, test_000158 |
| Different failure shape | test_000013, test_000008, test_000073, test_000078, test_000083, test_000141, test_000007, test_000002, test_000033, test_000005, test_000022, test_000069, test_000019, test_000045, test_000001, test_000064, test_000108 |

No price-pair failures, swapped-price failures, or wrong-price-attached failures were found by the scorer. The material failures are description and additional-service quality failures.

## Boundary-style comparison

| Boundary style | Rows | Deployed failures | Staged failures | Deployed desc F1 | Staged desc F1 |
| --- | --- | --- | --- | --- | --- |
| comma_inside_description | 7 | 6 | 7 | 0.931 | 0.522 |
| comma_labeled | 2 | 2 | 2 | 0.782 | 0.865 |
| compact_A_B | 2 | 2 | 2 | 0.260 | 0.619 |
| non_price_number_near_option | 1 | 1 | 1 | 1.000 | 1.000 |
| period_labeled | 1 | 1 | 1 | 0.856 | 0.517 |
| price_first | 6 | 6 | 6 | 0.727 | 0.689 |
| run_on_labeled | 2 | 2 | 2 | 0.704 | 0.753 |
| semicolon_labeled | 9 | 7 | 9 | 0.945 | 0.562 |

## Five most important failure cases

| Case | Bucket | Boundary | Categories | Expected | Deployed | Staged |
| --- | --- | --- | --- | --- | --- | --- |
| test_000022 | medium | comma_inside_description | Option B description truncated; additional service missed | A: remove tree, leave debris / 6200<br>B: drop tree and brush cleanup, log haul / 7150 | A: remove tree, leave debris / 6200<br>B: drop tree and brush cleanup, log haul / 7150<br>F1 A/B: 1.000 / 1.000 | A: Remove the two spruce trees over the roof and leave the debris on site. / 6200<br>B: Remove the two spruce trees over the roof and clean up the brush. / 7150<br>F1 A/B: 0.333 / 0.200 |
| test_000123 | easy | semicolon_labeled | Option B description truncated; semicolon boundary failure | A: drop tree and leave debris / 1900<br>B: remove tree with stump grinding / 3450 | A: drop tree and leave debris / 1900<br>B: remove tree with stump grinding / 3450<br>F1 A/B: 1.000 / 1.000 | A: Remove the spruce tree next to the barn and leave the debris on site. / 1900<br>B: Remove the spruce tree next to the barn and grind the stump. / 3450<br>F1 A/B: 0.421 / 0.353 |
| test_000007 | medium | comma_inside_description | Option B description truncated; additional service missed | A: drop tree, leave brush onsite / 3000<br>B: remove tree brush cleanup, log haul / 4650 | A: drop tree, leave brush onsite / 3000<br>B: remove tree brush cleanup, log haul / 4650<br>F1 A/B: 1.000 / 1.000 | A: Remove the birch tree and leave the brush on site. / 3000<br>B: Remove the birch tree and clean up the brush. / 4650<br>F1 A/B: 0.400 / 0.400 |
| test_000027 | easy | semicolon_labeled | Option B description truncated; semicolon boundary failure | A: remove tree and leave debris / 5000<br>B: remove tree with stump grinding / 6150 | A: remove tree and leave debris / 5000<br>B: remove tree with stump grinding / 6150<br>F1 A/B: 1.000 / 1.000 | A: Remove the spruce tree near the pool split trunk and leave the debris on site. / 5000<br>B: Remove the spruce tree near the pool split trunk and grind the stump. / 6150<br>F1 A/B: 0.500 / 0.333 |
| test_000083 | easy | semicolon_labeled | Option B description truncated; additional service missed; semicolon boundary failure | A: cut down tree leave debris / 3100<br>B: remove tree with grind stump and remove chips / 3600 | A: cut down tree leave debris / 3100<br>B: remove tree with grind stump and remove chips / 3600<br>F1 A/B: 1.000 / 1.000 | A: Remove the hickory tree behind the shed should come down and leave the debris on site. / 3100<br>B: Remove the hickory tree behind the shed should come down and grind the stump. / 3600<br>F1 A/B: 0.381 / 0.455 |

## Deployment-gate result

| Condition | Result |
| --- | --- |
| No regression in phone accuracy | PASS |
| No regression in email accuracy | PASS |
| No regression in Option A price accuracy | PASS |
| No regression in Option B price accuracy | PASS |
| Staged overall A/B price-pair accuracy >= 97% | PASS |
| Staged hard-bucket A/B price-pair accuracy >= 90% | PASS |
| Staged mean option-description F1 >= 0.90 | FAIL |

## Scorer output

```text
=== CURRENT DEPLOYED ===
Rows scored: 30 | Missing predictions: 0
customer_name                 100.0%
phone                         100.0%
email                         100.0%
option_a_price                100.0%
option_b_price                100.0%
option price pair exact       100.0%
critical row exact            100.0%
option A description F1       0.868
option B description F1       0.781
Option B services F1          0.460

EASY:
  price-pair exact: 100.0%
  critical exact:   100.0%
  desc mean F1:     0.935

MEDIUM:
  price-pair exact: 100.0%
  critical exact:   100.0%
  desc mean F1:     0.807

HARD:
  price-pair exact: 100.0%
  critical exact:   100.0%
  desc mean F1:     0.732

Material option failures:
{"case_id": "test_000014", "bucket": "easy", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.727, "option_b_desc_f1": 1.0}
{"case_id": "test_000002", "bucket": "medium", "boundary": "comma_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.571, "option_b_desc_f1": 0.667}
{"case_id": "test_000033", "bucket": "medium", "boundary": "compact_A_B", "price_pair_exact": true, "option_a_desc_f1": 0.0, "option_b_desc_f1": 0.0}
{"case_id": "test_000074", "bucket": "medium", "boundary": "comma_inside_description", "price_pair_exact": true, "option_a_desc_f1": 1.0, "option_b_desc_f1": 0.429}
{"case_id": "test_000019", "bucket": "hard", "boundary": "comma_inside_description", "price_pair_exact": true, "option_a_desc_f1": 0.75, "option_b_desc_f1": 1.0}
{"case_id": "test_000045", "bucket": "hard", "boundary": "compact_A_B", "price_pair_exact": true, "option_a_desc_f1": 0.667, "option_b_desc_f1": 0.375}
{"case_id": "test_000058", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 1.0, "option_b_desc_f1": 0.2}
{"case_id": "test_000001", "bucket": "hard", "boundary": "run_on_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.75, "option_b_desc_f1": 0.375}
{"case_id": "test_000067", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 0.8, "option_b_desc_f1": 0.75}
{"case_id": "test_000079", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 0.75, "option_b_desc_f1": 0.364}
{"case_id": "test_000108", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 0.6, "option_b_desc_f1": 0.714}
{"case_id": "test_000158", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 1.0, "option_b_desc_f1": 0.667}

=== STAGED / VERSION 3.0 ===
Rows scored: 30 | Missing predictions: 0
customer_name                 100.0%
phone                         100.0%
email                         100.0%
option_a_price                100.0%
option_b_price                100.0%
option price pair exact       100.0%
critical row exact            100.0%
option A description F1       0.655
option B description F1       0.601
Option B services F1          0.454

EASY:
  price-pair exact: 100.0%
  critical exact:   100.0%
  desc mean F1:     0.606

MEDIUM:
  price-pair exact: 100.0%
  critical exact:   100.0%
  desc mean F1:     0.586

HARD:
  price-pair exact: 100.0%
  critical exact:   100.0%
  desc mean F1:     0.692

Material option failures:
{"case_id": "test_000013", "bucket": "easy", "boundary": "period_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.5, "option_b_desc_f1": 0.533}
{"case_id": "test_000008", "bucket": "easy", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.471, "option_b_desc_f1": 0.483}
{"case_id": "test_000014", "bucket": "easy", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.727, "option_b_desc_f1": 1.0}
{"case_id": "test_000027", "bucket": "easy", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.5, "option_b_desc_f1": 0.333}
{"case_id": "test_000073", "bucket": "easy", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.4, "option_b_desc_f1": 0.571}
{"case_id": "test_000083", "bucket": "easy", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.381, "option_b_desc_f1": 0.455}
{"case_id": "test_000123", "bucket": "easy", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.421, "option_b_desc_f1": 0.353}
{"case_id": "test_000141", "bucket": "easy", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.4, "option_b_desc_f1": 0.696}
{"case_id": "test_000007", "bucket": "medium", "boundary": "comma_inside_description", "price_pair_exact": true, "option_a_desc_f1": 0.4, "option_b_desc_f1": 0.4}
{"case_id": "test_000002", "bucket": "medium", "boundary": "comma_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.571, "option_b_desc_f1": 1.0}
{"case_id": "test_000033", "bucket": "medium", "boundary": "compact_A_B", "price_pair_exact": true, "option_a_desc_f1": 0.429, "option_b_desc_f1": 0.522}
{"case_id": "test_000005", "bucket": "medium", "boundary": "semicolon_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.429, "option_b_desc_f1": 0.5}
{"case_id": "test_000022", "bucket": "medium", "boundary": "comma_inside_description", "price_pair_exact": true, "option_a_desc_f1": 0.333, "option_b_desc_f1": 0.2}
{"case_id": "test_000032", "bucket": "medium", "boundary": "comma_inside_description", "price_pair_exact": true, "option_a_desc_f1": 0.471, "option_b_desc_f1": 0.5}
{"case_id": "test_000069", "bucket": "medium", "boundary": "comma_inside_description", "price_pair_exact": true, "option_a_desc_f1": 0.4, "option_b_desc_f1": 0.375}
{"case_id": "test_000074", "bucket": "medium", "boundary": "comma_inside_description", "price_pair_exact": true, "option_a_desc_f1": 1.0, "option_b_desc_f1": 0.429}
{"case_id": "test_000019", "bucket": "hard", "boundary": "comma_inside_description", "price_pair_exact": true, "option_a_desc_f1": 0.353, "option_b_desc_f1": 0.455}
{"case_id": "test_000045", "bucket": "hard", "boundary": "compact_A_B", "price_pair_exact": true, "option_a_desc_f1": 0.667, "option_b_desc_f1": 0.857}
{"case_id": "test_000058", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 1.0, "option_b_desc_f1": 0.2}
{"case_id": "test_000001", "bucket": "hard", "boundary": "run_on_labeled", "price_pair_exact": true, "option_a_desc_f1": 0.8, "option_b_desc_f1": 0.444}
{"case_id": "test_000064", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 0.727, "option_b_desc_f1": 0.875}
{"case_id": "test_000067", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 0.8, "option_b_desc_f1": 0.75}
{"case_id": "test_000079", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 0.75, "option_b_desc_f1": 0.364}
{"case_id": "test_000108", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 0.889, "option_b_desc_f1": 0.25}
{"case_id": "test_000158", "bucket": "hard", "boundary": "price_first", "price_pair_exact": true, "option_a_desc_f1": 1.0, "option_b_desc_f1": 0.667}

=== VERSION 3.0 DEPLOYMENT DECISION ===
HOLD ? do not deploy Version 3.0 yet
{
  "deployed": {
    "pair": 1.0,
    "hard_pair": 1.0,
    "desc": 0.8244738621944504,
    "field": {
      "phone": 1.0,
      "email": 1.0,
      "option_a_price": 1.0,
      "option_b_price": 1.0
    }
  },
  "staged": {
    "pair": 1.0,
    "hard_pair": 1.0,
    "desc": 0.6280737166051242,
    "field": {
      "phone": 1.0,
      "email": 1.0,
      "option_a_price": 1.0,
      "option_b_price": 1.0
    }
  },
  "no_critical_regression": true
}
```
