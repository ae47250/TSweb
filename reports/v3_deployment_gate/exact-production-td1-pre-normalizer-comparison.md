# Exact Production TD1 Pre-Normalizer Comparison

Generated: 2026-07-13T03:39:09.071Z
Production commit: cdca3398c5b4db3abedd24c8d46f310da420a233
Input rows: 30
OpenAI model: gpt-4.1-nano
Expected OpenAI calls: 90
Run errors: 0

Production was not called or modified. Vercel environment variables were not changed.

## Setups

| Setup | TD1 pre-normalizers | Option/price normalizer | Meaning |
| --- | --- | --- | --- |
| Production commit cdca339, TD1 pre-normalizers off | false | false | Same code commit as current production, with parser input left as the raw TD1 note. |
| Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | true | false | Same production commit with text cleanup and contact sidecars enabled, but option/price sidecar disabled. |
| Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on | true | true | Same production commit with the full TD1 sidecar stack, including option/price clues and additive add-on interpretation for clear wording such as stump grinding extra $500. |

## Option/Price Add-On Sidecar Summary

This is computed from the same production snapshot and raw TD1 inputs. It does not change the TD2 outputs above; it documents what the option/price sidecar saw before the model call.

| Case | Interpretation | Base price | Add-on/second price | Combined price | Confidence | Explicit additive cue | Review reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| test_000006 | bundled_total | $4,750 | $6,400 | $6,400 | high | false |  |
| test_000013 | bundled_total | $3,400 | $4,450 | $4,450 | high | false |  |
| test_000008 | bundled_total | $3,750 | $4,650 | $4,650 | high | false |  |
| test_000014 | bundled_total | $2,250 | $3,000 | $3,000 | high | false |  |
| test_000027 | bundled_total | $5,000 | $6,150 | $6,150 | high | false |  |
| test_000073 | bundled_total | $1,850 | $2,650 | $2,650 | high | false |  |
| test_000078 | bundled_total | $2,650 | $4,000 | $4,000 | high | false |  |
| test_000083 | bundled_total | $3,100 | $3,600 | $3,600 | high | false |  |
| test_000123 | bundled_total | $1,900 | $3,450 | $3,450 | high | false |  |
| test_000141 | bundled_total | $1,650 | $3,000 | $3,000 | high | false |  |
| test_000007 | bundled_total | $3,000 | $4,650 | $4,650 | high | false |  |
| test_000002 | bundled_total | $3,250 | $4,850 | $4,850 | high | false |  |
| test_000033 | bundled_total | $2,200 | $3,450 | $3,450 | high | false |  |
| test_000004 | additive_amount | $6,900 | $8,500 | $15,400 | high | true |  |
| test_000005 | additive_amount | $6,300 | $8,450 | $14,750 | high | true |  |
| test_000022 | bundled_total | $6,200 | $7,150 | $7,150 | high | false |  |
| test_000032 | bundled_total | $4,000 | $5,000 | $5,000 | high | false |  |
| test_000055 | bundled_total | $2,350 | $4,450 | $4,450 | high | false |  |
| test_000069 | bundled_total | $2,500 | $4,350 | $4,350 | high | false |  |
| test_000019 | bundled_total | $5,950 | $8,600 | $8,600 | high | false |  |
| test_000045 | bundled_total | $2,750 | $5,300 | $5,300 | high | false |  |
| test_000018 | bundled_total | $5,800 | $6,700 | $6,700 | high | false |  |
| test_000058 | bundled_total | $5,500 | $6,350 | $6,350 | medium | false | Base/add-on scope or pairing confidence is not strong enough for automatic arithmetic. |
| test_000001 | bundled_total | $3,050 | $5,700 | $5,700 | high | false |  |
| test_000064 | bundled_total | $3,850 | $4,750 | $4,750 | medium | false | Base/add-on scope or pairing confidence is not strong enough for automatic arithmetic. |
| test_000067 | bundled_total | $2,700 | $4,000 | $4,000 | medium | false | Base/add-on scope or pairing confidence is not strong enough for automatic arithmetic. |
| test_000079 | bundled_total | $3,600 | $4,750 | $4,750 | medium | false | Base/add-on scope or pairing confidence is not strong enough for automatic arithmetic. |

## Results

## test_000006

Raw input:

```text
Nicole P., 260-874-6845, nicole.perezntv@icloud.com, spruce over roof corner leaning and needs removed, option a: remove tree and leave brush onsite 4,750, option b: remove tree and stump grinding, haul brush, and final cleanup $6400
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Nicole P | Nicole P | Nicole P |
| Phone | 260-874-6845 | 260-874-6845 | 260-874-6845 |
| Email | nicole.perezntv@icloud.com | nicole.perezntv@icloud.com | nicole.perezntv@icloud.com |
| Service address | spruce over roof corner |  |  |
| Job description | Remove one spruce tree. Options include haul away, cleanup or stump grinding. | Remove one tree. Options include haul away, cleanup or stump grinding. | Remove one tree. Options include haul away, cleanup or stump grinding. |
| Condition details | over roof corner. over roof corner. over roof corner. over roof corner |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | spruce |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree, leave brush onsite: $4,750<br>Option B: remove tree, stump grinding, haul brush, final cleanup: $6,400 | Option A: remove tree and leave brush onsite 4: $750<br>Option B: remove tree and stump grinding, haul brush, and final cleanup: $6,400 | Option A: remove tree and leave brush onsite: $4,750<br>Option B: remove tree and leave brush onsite and remove tree and stump grinding, haul brush, and final cleanup: $6,400 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  | Large price spread: Option B $6,400 is 3x+ Option A $750. Confirm price quote if this is correct. If not, edit info. |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000013

Raw input:

```text
Ruth Price, 812-245-2091, 33price@aol.com, cedar near garage split trunk needs removed, Option A remove tree and leave debris 3,400. Option B remove tree haul away and haul debris and rake yard $4,450
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Ruth Price | Ruth Price | Ruth Price |
| Phone | 812-245-2091 | 812-245-2091 | 812-245-2091 |
| Email | 33price@aol.com | 33price@aol.com | 33price@aol.com |
| Service address |  |  |  |
| Job description | Remove one cedar tree near the garage split trunk. Options include haul away. | Remove one tree near the garage split trunk. Options include haul away. | Remove one cedar tree near the garage split trunk. Options include haul away. |
| Condition details | near garage. near garage. near garage. near garage |  | near garage. near garage. near garage. near garage |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | cedar |  | cedar |
| Work action | remove | unclear | remove |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree, leave debris: $3,400<br>Option B: remove tree, haul away debris, rake yard: $4,450 | Option A: remove tree and leave debris 3: $400<br>Option B: remove tree haul away and haul debris and rake yard: $4,450 | Option A: remove tree and leave debris: $3,400<br>Option B: remove tree and leave debris and remove tree haul away and haul debris and rake yard: $4,450 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  | Large price spread: Option B $4,450 is 3x+ Option A $400. Confirm price quote if this is correct. If not, edit info. |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000008

Raw input:

```text
Jeffrey, 463-655-8867, jeffrey.sidentx@gmail.com, cedar along alley needs removed, opt a remove tree leave debris $3750; opt b remove tree and chip brush, stump grinding, and cleanup 4,650
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Jeffrey | Jeffrey Sidentx | Jeffrey Sidentx |
| Phone | 463-655-8867 | 463-655-8867 | 463-655-8867 |
| Email | jeffrey.sidentx@gmail.com | jeffrey.sidentx@gmail.com | jeffrey.sidentx@gmail.com |
| Service address | cedar along alley |  |  |
| Job description | Remove one tree along the alley. Options include cleanup or stump grinding. | Remove one tree along the alley. Options include cleanup or stump grinding. | Remove one tree along the alley. Options include cleanup or stump grinding. |
| Condition details |  | along alley. along alley. along alley. along alley |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type |  |  |  |
| Work action | remove | remove | remove |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree leave debris: $3,750<br>Option B: remove tree and chip brush, stump grinding, and cleanup: $4,650 | Option A: remove tree, leave debris: $3,750<br>Option B: remove tree, chip brush, stump grinding, cleanup: $4,650 | Option A: remove tree leave debris: $3,750<br>Option B: remove tree leave debris and remove tree and chip brush, stump grinding, and cleanup: $4,650 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000014

Raw input:

```text
Lauren Price, 765-847-6365, lauren.pricenud@gmail.com, hickory near garage split trunk needs removed, opt a take tree down leave wood and brush $2,250; opt b remove tree with brush cleanup and log haul $3,000
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Lauren Price | Lauren Price | Lauren Price |
| Phone | 765-847-6365 | 765-847-6365 | 765-847-6365 |
| Email | lauren.pricenud@gmail.com | lauren.pricenud@gmail.com | lauren.pricenud@gmail.com |
| Service address | hickory near garage |  |  |
| Job description | Remove one hickory tree near the garage split trunk. Options include leaving wood on site, haul away or cleanup. | Remove one tree near the garage split trunk. Options include leaving wood on site, haul away or cleanup. | Remove one tree near the garage split trunk. Options include leaving wood on site, haul away or cleanup. |
| Condition details | near garage. near garage. near garage. near garage |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | hickory |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: leave wood and brush: $2,250<br>Option B: remove tree, brush cleanup, log haul: $3,000 | Option A: leave wood and brush: $2,250<br>Option B: remove tree with brush cleanup and log haul: $3,000 | Option A: leave wood and brush: $2,250<br>Option B: leave wood and brush and remove tree with brush cleanup and log haul: $3,000 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000027

Raw input:

```text
Tara, 574-956-2893, 47martin@yahoo.com, spruce near pool split trunk needs removed, option a remove tree and leave debris $5000; option b remove tree with stump grinding 6150
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Tara |  |  |
| Phone | 574-956-2893 | 574-956-2893 | 574-956-2893 |
| Email | 47martin@yahoo.com | 47martin@yahoo.com | 47martin@yahoo.com |
| Service address |  |  |  |
| Job description | Remove one spruce tree near the pool split trunk. Options include stump grinding. | Remove one tree near the pool split trunk. Options include stump grinding. | Remove one tree near the pool split trunk. Options include stump grinding. |
| Condition details |  |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | spruce |  |  |
| Work action | remove | remove | remove |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree and leave debris: $5,000<br>Option B: remove tree with stump grinding: $6,150 | Option A: remove tree and leave debris: $5,000<br>Option B: remove tree with stump grinding: $6,150 | Option A: remove tree and leave debris: $5,000<br>Option B: remove tree and leave debris and remove tree with stump grinding: $6,150 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000073

Raw input:

```text
Joe M., 317-746-9775, joe.moorenwk@aol.com, cedar near pool wants removed, option a cut down tree leave debris $1850; option b remove tree with chip brush and haul chips 2,650
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Joe M | Joe M | Joe M |
| Phone | 317-746-9775 | 317-746-9775 | 317-746-9775 |
| Email | joe.moorenwk@aol.com | joe.moorenwk@aol.com | joe.moorenwk@aol.com |
| Service address | cedar near pool |  |  |
| Job description | Remove one cedar tree. Options include haul away. | Remove one cedar tree. Options include haul away. | Remove one tree. Options include haul away. |
| Condition details | near pool. near pool. near pool. near pool | near pool. near pool. near pool. near pool |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | cedar | cedar |  |
| Work action | remove | remove | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: cut down tree, leave debris: $1,850<br>Option B: remove tree, chip brush, haul chips: $2,650 | Option A: cut down tree leave debris: $1,850<br>Option B: remove tree with chip brush and haul chips: $2,650 | Option A: cut down tree leave debris: $1,850<br>Option B: cut down tree leave debris and remove tree with chip brush and haul chips: $2,650 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000078

Raw input:

```text
Barbara, 219-738-9212, barbara.northnwp@icloud.com, ash near pool split trunk needs removed, opt a cut down tree leave debris $2650; opt b remove tree haul away and grind 2 stumps, haul brush, and cleanup 4000
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Barbara | Barbara Northnwp | Barbara Northnwp |
| Phone | 219-738-9212 | 219-738-9212 | 219-738-9212 |
| Email | barbara.northnwp@icloud.com | barbara.northnwp@icloud.com | barbara.northnwp@icloud.com |
| Service address | ash near pool |  |  |
| Job description | Remove one ash tree near the pool split trunk. Options include haul away or cleanup. | Remove one tree near the pool split trunk. Options include haul away, cleanup or stump grinding. | Remove one tree near the pool split trunk. Options include haul away or cleanup. |
| Condition details | near pool. near pool. near pool. near pool |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | ash |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: cut down tree, leave debris: $2,650<br>Option B: remove tree, grind 2 stumps, haul brush, cleanup: $4,000 | Option A: cut down tree, leave debris: $2,650<br>Option B: remove tree, grind stumps, haul brush, cleanup: $4,000 | Option A: cut down tree leave debris: $2,650<br>Option B: cut down tree leave debris and remove tree haul away and grind 2 stumps, haul brush, and cleanup: $4,000 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000083

Raw input:

```text
Patrick, 219-436-2144, patrick.porchnwu@hotmail.com, hickory behind shed should come down, option a cut down tree leave debris $3100; option b remove tree with grind stump and remove chips 3600
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Patrick | Patrick Porchnwu | Patrick Porchnwu |
| Phone | 219-436-2144 | 219-436-2144 | 219-436-2144 |
| Email | patrick.porchnwu@hotmail.com | patrick.porchnwu@hotmail.com | patrick.porchnwu@hotmail.com |
| Service address |  |  |  |
| Job description | Remove one hickory tree behind the shed should come down. Options include stump grinding. | Remove one hickory tree behind the shed should come down. Options include stump grinding. | Remove one tree behind the shed should come down. Options include stump grinding. |
| Condition details | behind shed. behind shed. behind shed. behind shed | behind shed. behind shed. behind shed. behind shed |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | hickory | hickory |  |
| Work action | remove | remove | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: cut down tree, leave debris: $3,100<br>Option B: remove tree, grind stump, remove chips: $3,600 | Option A: cut down tree leave debris: $3,100<br>Option B: remove tree with grind stump and remove chips: $3,600 | Option A: cut down tree leave debris: $3,100<br>Option B: cut down tree leave debris and remove tree with grind stump and remove chips: $3,600 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000123

Raw input:

```text
Alan, 317-790-5254, alan.cedarnyi@yahoo.com, spruce next to barn needs removed, opt a drop tree and leave debris $1900; opt b remove tree with stump grinding 3450
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Alan | Alan Cedarnyi | Alan Cedarnyi |
| Phone | 317-790-5254 | 317-790-5254 | 317-790-5254 |
| Email | alan.cedarnyi@yahoo.com | alan.cedarnyi@yahoo.com | alan.cedarnyi@yahoo.com |
| Service address |  |  |  |
| Job description | Remove one spruce tree. Options include stump grinding. | Remove one tree. Options include stump grinding. | Remove one tree. Options include stump grinding. |
| Condition details | next to barn. next to barn. next to barn. next to barn |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | spruce |  |  |
| Work action | remove | remove | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: drop tree and leave debris: $1,900<br>Option B: remove tree with stump grinding: $3,450 | Option A: drop tree and leave debris: $1,900<br>Option B: remove tree with stump grinding: $3,450 | Option A: drop tree and leave debris: $1,900<br>Option B: drop tree and leave debris and remove tree with stump grinding: $3,450 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000141

Raw input:

```text
Marcus White, 765-628-5384, marcus.whitenza@yahoo.com, maple by front walk wants removed, option a drop it and leave debris 1,650; option b remove tree haul away and stump removal and haul brush $3000
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Marcus White | Marcus White | Marcus White |
| Phone | 765-628-5384 | 765-628-5384 | 765-628-5384 |
| Email | marcus.whitenza@yahoo.com | marcus.whitenza@yahoo.com | marcus.whitenza@yahoo.com |
| Service address | maple by front walk |  |  |
| Job description | Remove one maple tree. Options include haul away. | Remove one tree. Options include haul away. | Remove one tree. Options include haul away. |
| Condition details | by front walk. by front walk. by front walk. by front walk |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | maple |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: drop tree and leave debris: $1,650<br>Option B: remove tree haul away and stump removal and haul brush: $3,000 | Option A: drop tree and leave debris 1: $650<br>Option B: remove tree haul away and stump removal and haul brush: $3,000 | Option A: drop tree and leave debris: $1,650<br>Option B: drop tree and leave debris and remove tree haul away and stump removal and haul brush: $3,000 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  | Large price spread: Option B $3,000 is 3x+ Option A $650. Confirm price quote if this is correct. If not, edit info. |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000007

Raw input:

```text
Paul B., 260-593-1887, paul.bennettntw@aol.com, birch by driveway leaning bad needs out, Option A: drop tree, leave brush onsite, 3000, Option B: remove tree brush cleanup, log haul, 4650
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Paul B | Paul B | Paul B |
| Phone | 260-593-1887 | 260-593-1887 | 260-593-1887 |
| Email | paul.bennettntw@aol.com | paul.bennettntw@aol.com | paul.bennettntw@aol.com |
| Service address | birch by driveway |  |  |
| Job description | Remove one birch tree. Options include haul away or cleanup. | Remove one tree. Options include haul away or cleanup. | Remove one tree. Options include haul away or cleanup. |
| Condition details | by driveway. by driveway. by driveway. by driveway |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | birch |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: drop tree, leave brush onsite: $3,000<br>Option B: remove tree, brush, cleanup, log haul: $4,650 | Option A: drop tree, leave brush onsite: $3,000<br>Option B: remove tree brush cleanup, log haul: $4,650 | Option A: drop tree, leave brush onsite: $3,000<br>Option B: drop tree, leave brush onsite and remove tree brush cleanup, log haul: $4,650 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000002

Raw input:

```text
Vanessa L, 574-506-6238, vanessa.lewisntr@gmail.com, oak at 410 Walnut by fence wants it dropped, option a: take tree down leave wood $3250, option b: remove tree w haul logs, grind stump and clean up 4850
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Vanessa L | Vanessa Lewisntr | Vanessa L |
| Phone | 574-506-6238 | 574-506-6238 | 574-506-6238 |
| Email | vanessa.lewisntr@gmail.com | vanessa.lewisntr@gmail.com | vanessa.lewisntr@gmail.com |
| Service address | 410 Walnut | 410 Walnut | 410 Walnut |
| Job description | Remove one oak tree. Options include leaving wood on site, haul away, cleanup or stump grinding. | Remove one oak tree. Options include leaving wood on site, haul away, cleanup or stump grinding. | Remove one oak tree. Options include leaving wood on site, haul away, cleanup or stump grinding. |
| Condition details | at 410 Walnut by fence. at 410 Walnut by fence. at 410 Walnut by fence. at 410 Walnut by fence | at 410 Walnut by fence. at 410 Walnut by fence. at 410 Walnut by fence. at 410 Walnut by fence | at 410 Walnut by fence. at 410 Walnut by fence. at 410 Walnut by fence. at 410 Walnut by fence |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | oak | oak | oak |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: drop tree, leave wood: $3,250<br>Option B: remove tree, haul logs, grind stump, clean up: $4,850 | Option A: leave wood: $3,250<br>Option B: remove tree w haul logs, grind stump and clean up: $4,850 | Option A: leave wood: $3,250<br>Option B: leave wood and remove tree w haul logs, grind stump and clean up: $4,850 |
| Can generate PDF | true | true | true |
| Blocking errors |  |  |  |
| Warnings | Service address may be missing town/city or state. | Service address may be missing town/city or state. | Service address may be missing town/city or state. |
| Follow-ups |  |  |  |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000033

Raw input:

```text
Roy, 574-302-9215, roy53@yahoo.com, locust over back fence wants it dropped, A remve tree leave debris 2200 B take tree down flush cut stump and haul brush 3,450
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Roy |  |  |
| Phone | 574-302-9215 | 574-302-9215 | 574-302-9215 |
| Email | roy53@yahoo.com | roy53@yahoo.com | roy53@yahoo.com |
| Service address | locust over back fence |  |  |
| Job description | Priced service options need work-scope descriptions. | Tree service work as described in the selected quote option. | Cut stump and haul brush. |
| Condition details |  |  |  |
| Tree count |  |  |  |
| Tree type |  |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: work scope unclear: $2,200<br>Option B: work scope unclear: $3,450 | Option A: unclear: $3,450 | Option A: leave debris: $2,200<br>Option B: leave debris and stump and haul brush: $3,450 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address.; Tree count is unclear. | Missing service address.; Tree count is unclear. | Missing service address.; Tree count is unclear. |
| Warnings | Work scope unclear; confirm what this price covers. |  |  |
| Follow-ups | What is the exact service address for this job?; How many trees should be included in this estimate? | What is the exact service address for this job?; How many trees should be included in this estimate? | What is the exact service address for this job?; How many trees should be included in this estimate? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000004

Raw input:

```text
Thomas G, 219-610-6313, thomas24@outlook.com, pine over roof corner brush tight but workable, opt a remove tree leave wood n brush $6900 opt b drop tree and stump removal plus haul brush $8500
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Thomas G |  |  |
| Phone | 219-610-6313 | 219-610-6313 | 219-610-6313 |
| Email | thomas24@outlook.com | thomas24@outlook.com | thomas24@outlook.com |
| Service address | pine over roof corner |  |  |
| Job description | Remove one pine tree over the roof corner brush tight but workable. Options include leaving wood on site or haul away. | Remove one tree over the roof corner brush tight but workable. Options include leaving wood on site or haul away. | Remove one tree over the roof corner brush tight but workable. Options include leaving wood on site or haul away. |
| Condition details | over roof corner. over roof corner. over roof corner. over roof corner |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | pine |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree, leave wood and brush: $6,900<br>Option B: drop tree, stump removal, haul brush: $8,500 | Option A: remove tree leave wood n brush: $6,900<br>Option B: drop tree and stump removal haul brush: $8,500 | Option A: remove tree leave wood n brush: $6,900<br>Option B: remove tree leave wood n brush and drop tree and stump removal haul brush: $15,400 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000005

Raw input:

```text
Derek, 317-465-5697, derek.hughesntu@hotmail.com, maple by power line can get truck close, option a drop tree leave debris 6300; option b remove tree chip brush plus haul chips 8450
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Derek | Derek Hughesntu | Derek Hughesntu |
| Phone | 317-465-5697 | 317-465-5697 | 317-465-5697 |
| Email | derek.hughesntu@hotmail.com | derek.hughesntu@hotmail.com | derek.hughesntu@hotmail.com |
| Service address |  |  |  |
| Job description | Remove one maple tree. Options include haul away. | Remove one tree. Options include haul away. | Remove one tree. Options include haul away. |
| Condition details | by power line. by power line. by power line. by power line |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | maple |  |  |
| Work action | other | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: drop tree leave debris: $6,300<br>Option B: remove tree chip brush haul chips: $8,450 | Option A: drop tree leave debris: $6,300<br>Option B: remove tree chip brush haul chips: $8,450 | Option A: drop tree leave debris: $6,300<br>Option B: drop tree leave debris and remove tree chip brush haul chips: $14,750 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings | Safety/access note: Derek, , , maple by power line can get truck close, option a drop tree leave debris 6300; | Safety/access note: Derek, , , maple by power line can get truck close, option a drop tree leave debris 6300; | Safety/access note: Derek, , , maple by power line can get truck close, option a drop tree leave debris 6300; |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000022

Raw input:

```text
Madison P., 260-288-9040, 42peterson2@outlook.com, spruce 2 trees near 1200 block limbs over roof and tree out, Option A: remove tree, leave debris, 6200, Option B: drop tree and brush cleanup, log haul, 7150
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Madison P | Madison P | Madison P |
| Phone | 260-288-9040 | 260-288-9040 | 260-288-9040 |
| Email | 42peterson2@outlook.com | 42peterson2@outlook.com | 42peterson2@outlook.com |
| Service address |  |  |  |
| Job description | Remove two spruce trees. Options include cleanup. | Remove two spruce trees. Options include haul away or cleanup. | Remove two trees. Options include haul away or cleanup. |
| Condition details | near 1200 block limbs over roof and tree out. near 1200 block limbs over roof and tree out. near 1200 block limbs over roof and tree out. near 1200 block limbs over roof and tree out |  |  |
| Tree count | 2 trees | 2 trees | 2 trees |
| Tree type | spruce | spruce |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree, leave debris: $6,200<br>Option B: drop tree and brush cleanup: $7,150 | Option A: remove tree, leave debris: $6,200<br>Option B: drop tree and brush cleanup, log haul: $7,150 | Option A: remove tree, leave debris: $6,200<br>Option B: remove tree, leave debris and drop tree and brush cleanup, log haul: $7,150 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000032

Raw input:

```text
Kelsey S, 765-743-6018, kelsey.yardnuv@gmail.com, spruce by front walk limbs over roof and tree out, option a: remove tree, leave debris, $4000, option b: remove tree haul brush, 5,000
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Kelsey S | Kelsey Yardnuv | Kelsey Yardnuv |
| Phone | 765-743-6018 | 765-743-6018 | 765-743-6018 |
| Email | kelsey.yardnuv@gmail.com | kelsey.yardnuv@gmail.com | kelsey.yardnuv@gmail.com |
| Service address | spruce by front walk |  |  |
| Job description | Remove one spruce tree near the front walk limbs over roof. Options include haul away. | Remove one tree near the front walk limbs over roof. Options include haul away. | Remove one tree near the front walk limbs over roof. Options include haul away. |
| Condition details | by front walk. by front walk. by front walk. by front walk |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | spruce |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree, leave debris: $4,000<br>Option B: remove tree haul brush: $5,000 | Option A: remove tree, leave debris: $4,000<br>Option B: remove tree haul brush: $5,000 | Option A: remove tree, leave debris: $4,000<br>Option B: remove tree, leave debris and remove tree haul brush: $5,000 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000055

Raw input:

```text
Ralph D, 219-976-9742, ralph75@aol.com, walnut by front walk leaning bad needs out, option a: remove tree, leave debris, $2350, option b: remove tree w haul wood, chip limbs, cleanup, 4450
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Ralph D |  | Missing |
| Phone | 219-976-9742 | 219-976-9742 | 219-976-9742 |
| Email | ralph75@aol.com | ralph75@aol.com | ralph75@aol.com |
| Service address | walnut by front walk |  |  |
| Job description | Remove one tree. Options include haul away or cleanup. | Remove one tree. Options include haul away or cleanup. | Remove missing trees. Options include haul away or cleanup. |
| Condition details | by front walk. by front walk. by front walk. by front walk |  | missing. missing. missing. missing |
| Tree count | 1 tree | 1 tree | missing |
| Tree type |  |  | missing |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree, leave debris: $2,350<br>Option B: remove tree, haul wood, chip limbs, cleanup: $4,450 | Option A: remove tree, leave debris: $2,350<br>Option B: remove tree w haul wood, chip limbs, cleanup: $4,450 | Option A: remove tree, leave debris: $2,350<br>Option B: remove tree, leave debris and remove tree w haul wood, chip limbs, cleanup: $4,450 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000069

Raw input:

```text
Linda Price, 574-506-2911, linda.pricenwg@yahoo.com, locust by 26 ft drive dead top needs removed, option a: drop tree, leave brush onsite, $2,500, option b: remove tree w brush cleanup, log haul, 4350
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Linda Price | Linda Price | Linda Price |
| Phone | 574-506-2911 | 574-506-2911 | 574-506-2911 |
| Email | linda.pricenwg@yahoo.com | linda.pricenwg@yahoo.com | linda.pricenwg@yahoo.com |
| Service address | locust by 26 ft drive dead top | 26 ft drive | 26 ft drive |
| Job description | Remove one tree. Options include haul away or cleanup. | Remove one tree near the dead top. Options include haul away or cleanup. | Remove one tree near the dead top. Options include haul away or cleanup. |
| Condition details |  |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type |  |  |  |
| Work action | unclear | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: drop tree, leave brush onsite: $2,500<br>Option B: remove tree w brush cleanup, log haul: $4,350 | Option A: drop tree, leave brush onsite: $2,500<br>Option B: remove tree w brush cleanup, log haul: $4,350 | Option A: drop tree, leave brush onsite: $2,500<br>Option B: drop tree, leave brush onsite and remove tree w brush cleanup, log haul: $4,350 |
| Can generate PDF | true | true | true |
| Blocking errors |  |  |  |
| Warnings | Service address may be missing town/city or state. | Service address may be missing town/city or state. | Service address may be missing town/city or state. |
| Follow-ups |  |  |  |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000074

Raw input:

```text
Alan, 463-427-6706, alan.kingnwl@gmail.com, elm by front walk wants quote for removal, Option A: drop tree, leave brush onsite, $2000, Option B: take tree down haul away debris, clean yard, 3450
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Alan | Alan Kingnwl | Alan Kingnwl |
| Phone | 463-427-6706 | 463-427-6706 | 463-427-6706 |
| Email | alan.kingnwl@gmail.com | alan.kingnwl@gmail.com | alan.kingnwl@gmail.com |
| Service address | elm by front walk |  |  |
| Job description | Remove one tree. Options include haul away. | Remove one tree. Options include haul away. | Remove one tree. |
| Condition details |  |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type |  |  |  |
| Work action | other | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: drop tree, leave brush onsite: $2,000<br>Option B: remove one tree and haul away: $3,450 | Option A: drop tree, leave brush onsite: $2,000<br>Option B: remove one tree and haul away: $3,450 | Option A: drop tree, leave brush onsite: $2,000 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000019

Raw input:

```text
Helen D., 317-705-3657, 39diaz@aol.com, locust gate is 9 ft by shed limbs low and trunk split, option a: remove tree, leave debrs, 5950, option b: remove tree chip brush, haul chips, $8600
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Helen D | Helen D | Helen D |
| Phone | 317-705-3657 | 317-705-3657 | 317-705-3657 |
| Email | 39diaz@aol.com | 39diaz@aol.com | 39diaz@aol.com |
| Service address | locust gate |  |  |
| Job description | Remove one tree near the shed limbs low and trunk split. Options include haul away. | Remove one tree near the shed limbs low and trunk split. Options include haul away. | Remove one tree near the shed limbs low and trunk split. Options include haul away. |
| Condition details |  | locust gate is 9 ft by shed limbs low and trunk split. locust gate is 9 ft by shed limbs low and trunk split. locust gate is 9 ft by shed limbs low and trunk split. locust gate is 9 ft by shed limbs low and trunk split |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type |  |  |  |
| Work action | remove | remove | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree, leave debrs: $5,950<br>Option B: remove tree chip brush, haul chips: $8,600 | Option A: remove tree, leave debrs: $5,950<br>Option B: remove tree chip brush, haul chips: $8,600 | Option A: remove tree, leave debrs: $5,950<br>Option B: remove tree, leave debrs and remove tree chip brush, haul chips: $8,600 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000045

Raw input:

```text
Diana, 260-577-4587, diana65@yahoo.com, elm near 22 ft drive opening tight access but wants it gone, A tree down leave debris $2750 B tree down stump grinding brush cleanup rake up $5300
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Diana |  |  |
| Phone | 260-577-4587 | 260-577-4587 | 260-577-4587 |
| Email | diana65@yahoo.com | diana65@yahoo.com | diana65@yahoo.com |
| Service address | elm near 22 ft drive opening | 22 ft drive | 22 ft drive |
| Job description | Remove two trees. Options include cleanup or stump grinding. | Stump grinding brush cleanup rake up. | Stump grinding brush cleanup rake up. |
| Condition details |  |  |  |
| Tree count | 2 trees |  |  |
| Tree type |  |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: leave debris: $2,750<br>Option B: remove two trees and cleanup and stump grinding: $5,300 | Option A: leave debris: $2,750<br>Option B: stump grinding brush cleanup rake up: $5,300 | Option A: leave debris: $2,750<br>Option B: leave debris and stump grinding brush cleanup rake up: $5,300 |
| Can generate PDF | true | true | true |
| Blocking errors |  |  |  |
| Warnings | Service address may be missing town/city or state. | Service address may be missing town/city or state. | Service address may be missing town/city or state. |
| Follow-ups |  |  |  |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000018

Raw input:

```text
Lisa Price, 219-791-5245, lisa.maplenuh@icloud.com, oak near 22 ft drive opening lot messy wants tree out, option a: remove 3 tree leave debris 5,800, option b: remove tree grind 2 stumps haul brush $6,700
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Lisa Price | Lisa Price | Lisa Price |
| Phone | 219-791-5245 | 219-791-5245 | 219-791-5245 |
| Email | lisa.maplenuh@icloud.com | lisa.maplenuh@icloud.com | lisa.maplenuh@icloud.com |
| Service address | 22 ft drive | 22 ft drive | 22 ft drive |
| Job description | Remove three oak trees. Options include haul away. | Remove three trees. Options include haul away. | Remove three trees. Options include haul away. |
| Condition details | near 22 ft drive opening lot. near 22 ft drive opening lot. near 22 ft drive opening lot. near 22 ft drive opening lot |  |  |
| Tree count | 3 trees | 3 trees | 3 trees |
| Tree type | oak |  |  |
| Work action | remove | unclear | other |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove 3 tree leave debris: $5,800<br>Option B: remove tree grind 2 stumps haul brush: $6,700 | Option A: remove 3 tree leave debris 5: $800<br>Option B: remove tree grind 2 stumps haul brush: $6,700 | Option A: remove 3 tree leave debris: $5,800<br>Option B: remove 3 tree leave debris and remove tree grind 2 stumps haul brush: $6,700 |
| Can generate PDF | true | true | true |
| Blocking errors |  |  |  |
| Warnings | Service address may be missing town/city or state. | Service address may be missing town/city or state.; Large price spread: Option B $6,700 is 3x+ Option A $800. Confirm price quote if this is correct. If not, edit info. | Service address may be missing town/city or state. |
| Follow-ups |  |  |  |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000058

Raw input:

```text
Natalie C., 463-478-7696, natalie.chaveznvv@outlook.com, maple 4 limbs over roof dead top plus wire mess, option a: $5500 remove tree leave debrs, option b: $6350 drop n haul logs grind stump clean up
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Natalie C | Natalie C | Natalie C |
| Phone | 463-478-7696 | 463-478-7696 | 463-478-7696 |
| Email | natalie.chaveznvv@outlook.com | natalie.chaveznvv@outlook.com | natalie.chaveznvv@outlook.com |
| Service address |  |  |  |
| Job description | Remove one maple tree over the roof dead top plus. Options include haul away, cleanup or stump grinding. | Remove one tree over the roof dead top plus. Options include haul away, cleanup or stump grinding. | Remove one maple tree over the roof dead top plus. Options include haul away, cleanup or stump grinding. |
| Condition details |  |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | maple |  | maple |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove tree leave debrs: $5,500<br>Option B: remove one maple tree and haul away and cleanup and stump grinding: $6,350 | Option A: remove tree leave debrs: $5,500<br>Option B: remove one tree and haul away and cleanup and stump grinding: $6,350 | Option A: remove tree leave debrs: $5,500<br>Option B: remove one maple tree and haul away and cleanup and stump grinding: $6,350 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings | Safety/access note: maple 4 limbs over roof dead top plus wire mess, option a: $5500 remove tree leave debrs, option b: $6350 drop n haul logs grind stump cl... | Safety/access note: maple 4 limbs over roof dead top plus wire mess, option a: $5500 remove tree leave debrs, option b: $6350 drop n haul logs grind stump cl... | Safety/access note: maple 4 limbs over roof dead top plus wire mess, option a: $5500 remove tree leave debrs, option b: $6350 drop n haul logs grind stump cl... |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000001

Raw input:

```text
Donald R, 812-859-8965, 21ramos@aol.com, ash 3 limbs over line at back lot tight access but wants it gone, opt a remve tree leave wood onsite 3,050 opt b drop n haul logs and brush cleanup $5700
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Donald R |  |  |
| Phone | 812-859-8965 | 812-859-8965 | 812-859-8965 |
| Email | 21ramos@aol.com | 21ramos@aol.com | 21ramos@aol.com |
| Service address |  |  |  |
| Job description | Remove one ash tree over the line. Options include leaving wood on site, haul away or cleanup. | Remove one tree. Options include leaving wood on site, haul away or cleanup. | Remove one tree. Options include leaving wood on site, haul away or cleanup. |
| Condition details | back lot. back lot. back lot. back lot |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | ash |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: leave wood onsite: $3,050<br>Option B: remove one ash tree and haul away and cleanup: $5,700 | Option A: leave wood onsite: $3,050<br>Option B: remove one tree and haul away and cleanup: $5,700 | Option A: leave wood onsite: $3,050<br>Option B: remove one tree and haul away and cleanup: $5,700 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000064

Raw input:

```text
Diana C., 812-666-2343, cruz84@outlook.com, birch gate is 9 ft by shed limbs low and trunk split, option a 3850 remove 1 tree leave debris, option b 4750 remove it stump grinding haul brush final cleanup
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Diana C | Diana C | Diana C |
| Phone | 812-666-2343 | 812-666-2343 | 812-666-2343 |
| Email | cruz84@outlook.com | cruz84@outlook.com | cruz84@outlook.com |
| Service address | birch gate |  |  |
| Job description | Remove one birch tree near the shed limbs low and trunk split. Options include haul away, cleanup or stump grinding. | Remove one tree near the shed limbs low and trunk split. Options include haul away, cleanup or stump grinding. | Remove one tree near the shed limbs low and trunk split. Options include haul away or stump grinding. |
| Condition details | gate. gate. gate. gate |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | birch |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: remove 1 tree; leave debris: $3,850<br>Option B: remove 1 tree, stump grinding, haul brush, final cleanup: $4,750 | Option A: remove 1 tree leave debris: $3,850<br>Option B: remove tree stump grinding haul brush final cleanup: $4,750 | Option A: remove 1 tree leave debris: $3,850<br>Option B: remove tree stump grinding haul brush final clean: $4,750 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000067

Raw input:

```text
Scott Price, 812-217-1361, scott.branchnwe@aol.com, pine at 410 Walnut by fence tight access but wants it gone, option a 2700 cut it down leave brush, option b $4000 remove it haul brush
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Scott Price | Scott Price | Scott Price |
| Phone | 812-217-1361 | 812-217-1361 | 812-217-1361 |
| Email | scott.branchnwe@aol.com | scott.branchnwe@aol.com | scott.branchnwe@aol.com |
| Service address | 410 Walnut | 410 Walnut | 410 Walnut |
| Job description | Remove one pine tree. Options include haul away. | Remove one tree. Options include haul away. | Remove one tree. Options include haul away. |
| Condition details | by fence tight access. by fence tight access. by fence tight access. by fence tight access |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | pine |  |  |
| Work action | remove | other | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: cut tree down leave brush: $2,700<br>Option B: remove tree haul brush: $4,000 | Option A: cut tree down leave brush: $2,700<br>Option B: remove tree haul brush: $4,000 | Option A: cut tree down leave brush: $2,700<br>Option B: remove tree haul brush: $4,000 |
| Can generate PDF | true | true | true |
| Blocking errors |  |  |  |
| Warnings | Service address may be missing town/city or state. | Service address may be missing town/city or state. | Service address may be missing town/city or state. |
| Follow-ups |  |  |  |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000079

Raw input:

```text
Benjamin, 463-574-1304, benjamin.southnwq@aol.com, oak gate is 9 ft by shed tight access but wants it gone, option a: 3,600 down tree leave mess onsite, option b: $4750 drop n stump grinding
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Benjamin | Benjamin Southnwq | Benjamin Southnwq |
| Phone | 463-574-1304 | 463-574-1304 | 463-574-1304 |
| Email | benjamin.southnwq@aol.com | benjamin.southnwq@aol.com | benjamin.southnwq@aol.com |
| Service address | oak gate |  |  |
| Job description | Remove one oak tree. Options include stump grinding. | Remove one tree. Options include stump grinding. | Remove one tree. Options include stump grinding. |
| Condition details | gate and shed area. gate and shed area. gate and shed area. gate and shed area |  |  |
| Tree count | 1 tree | 1 tree | 1 tree |
| Tree type | oak |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: leave mess onsite: $3,600<br>Option B: remove one oak tree and stump grinding: $4,750 | Option A: leave mess onsite: $600<br>Option B: remove one tree and stump grinding: $4,750 | Option A: leave mess onsite: $3,600<br>Option B: remove one tree and stump grinding: $4,750 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  | Large price spread: Option B $4,750 is 3x+ Option A $600. Confirm price quote if this is correct. If not, edit info. |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000108

Raw input:

```text
Marcus W., 463-940-6059, marcus38@icloud.com, spruce at lot 6418 behind garage needs down before driveway work, option a: 6350 down tree leave mess onsite, option b: $8,400 tree out plus haul debris and rake yard
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Marcus W | Marcus W | Marcus W |
| Phone | 463-940-6059 | 463-940-6059 | 463-940-6059 |
| Email | marcus38@icloud.com | marcus38@icloud.com | marcus38@icloud.com |
| Service address | spruce at lot 6418 behind garage |  |  |
| Job description | Remove spruce trees. Options include haul away. | Haul debris and rake yard. | Haul debris and rake yard. |
| Condition details | behind garage. behind garage. behind garage. behind garage |  |  |
| Tree count |  |  |  |
| Tree type | spruce |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: leave mess onsite, option b: tree out haul debris and rake yard: $6,350 | Option A: leave mess onsite: $6,350<br>Option B: haul debris and rake yard: $8,400 | Option A: leave mess onsite: $6,350 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

## test_000158

Raw input:

```text
Sarah J, 317-279-4647, sarah.lotnzr@gmail.com, sycamore gate is 9 ft by shed leaning bad wants done soon, option a: 2650 drop tree leave brsh, option b: 5100 tree down stump grinding
```

| TD2 field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Customer name | Sarah J | Sarah Lotnzr | Sarah Lotnzr |
| Phone | 317-279-4647 | 317-279-4647 | 317-279-4647 |
| Email | sarah.lotnzr@gmail.com | sarah.lotnzr@gmail.com | sarah.lotnzr@gmail.com |
| Service address | sycamore gate |  |  |
| Job description | Drop tree leave brsh, tree down stump grinding. | Drop tree leave brsh. | Drop tree leave brsh. |
| Condition details | by shed. by shed. by shed. by shed |  |  |
| Tree count |  |  |  |
| Tree type |  |  |  |
| Work action | remove | unclear | unclear |
| Cleanup notes |  |  |  |
| Debris notes |  |  |  |
| Scheduling notes |  |  |  |
| Customer options | Option A: drop tree leave brsh: $2,650<br>Option B: stump grinding: $5,100 | Option A: drop tree leave brsh: $2,650<br>Option B: drop tree leave brsh and stump grinding: $5,100 | Option A: drop tree leave brsh: $2,650 |
| Can generate PDF | false | false | false |
| Blocking errors | Missing service address. | Missing service address. | Missing service address. |
| Warnings |  |  |  |
| Follow-ups | What is the exact service address for this job? | What is the exact service address for this job? | What is the exact service address for this job? |
| Structural error codes |  |  |  |
| Source-final blocker codes |  |  |  |

| Debug field | Production commit cdca339, TD1 pre-normalizers off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer off | Production commit cdca339, TD1 pre-normalizers on, option/price normalizer on |
| --- | --- | --- | --- |
| Additive option/price interpretation |  |  |  |
| Run error |  |  |  |

