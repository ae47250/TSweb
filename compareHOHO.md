# compareHOHO: Deployed vs Shadow vs Preview

Dataset: 40 Tree Dude notes (20 explicit totals, 20 incremental add-ons).

## Metrics

| Lane | Score | Macro F1 | Prices exact | Price P/R/F1 | Composition exact | Composition P/R/F1 | Title F1 | Description F1 | Ready | IN added |
|---|---:|---:|---:|---|---:|---|---:|---:|---:|---:|
| deployed | 46.5 | 0.885 | 20/40 | 0.75/0.75/0.75 | 11/40 | 1/0.688/0.815 | 0.815 | 0.815 | 40/40 | 40/40 |
| shadow | 68.25 | 0.819 | 35/40 | 0.987/0.938/0.962 | 23/40 | 0.977/0.789/0.873 | 0.813 | 0.872 | 19/40 | 7/40 |
| preview | 68.25 | 0.827 | 35/40 | 0.987/0.938/0.962 | 23/40 | 0.977/0.789/0.873 | 0.813 | 0.872 | 18/40 | 9/40 |

Precision measures how much extracted content was correct; recall measures how much stated content survived; F1 balances both.

| Lane | Metric | Precision | Recall | F0.5 | F1 | F2 | TP | FP | FN |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| deployed | price | 0.75 | 0.75 | 0.75 | 0.75 | 0.75 | 60 | 20 | 20 |
| deployed | composition | 1 | 0.688 | 0.917 | 0.815 | 0.734 | 75 | 0 | 34 |
| deployed | title | 1 | 0.688 | 0.917 | 0.815 | 0.734 | 75 | 0 | 34 |
| deployed | description | 1 | 0.688 | 0.917 | 0.815 | 0.734 | 75 | 0 | 34 |
| deployed | contact | 1 | 1 | 1 | 1 | 1 | 120 | 0 | 0 |
| deployed | address town/state | 1 | 1 | 1 | 1 | 1 | 80 | 0 | 0 |
| deployed | tree count/species | 0.957 | 0.825 | 0.927 | 0.886 | 0.848 | 66 | 3 | 14 |
| deployed | option A/B structure | 1 | 1 | 1 | 1 | 1 | 80 | 0 | 0 |
| shadow | price | 0.987 | 0.938 | 0.977 | 0.962 | 0.947 | 75 | 1 | 5 |
| shadow | composition | 0.977 | 0.789 | 0.933 | 0.873 | 0.821 | 86 | 2 | 23 |
| shadow | title | 0.974 | 0.697 | 0.903 | 0.813 | 0.739 | 76 | 2 | 33 |
| shadow | description | 0.988 | 0.78 | 0.938 | 0.872 | 0.814 | 85 | 1 | 24 |
| shadow | contact | 1 | 1 | 1 | 1 | 1 | 120 | 0 | 0 |
| shadow | address town/state | 1 | 0.175 | 0.515 | 0.298 | 0.21 | 14 | 0 | 66 |
| shadow | tree count/species | 0.912 | 0.65 | 0.844 | 0.759 | 0.69 | 52 | 5 | 28 |
| shadow | option A/B structure | 1 | 0.95 | 0.99 | 0.974 | 0.96 | 76 | 0 | 4 |
| preview | price | 0.987 | 0.938 | 0.977 | 0.962 | 0.947 | 75 | 1 | 5 |
| preview | composition | 0.977 | 0.789 | 0.933 | 0.873 | 0.821 | 86 | 2 | 23 |
| preview | title | 0.974 | 0.697 | 0.903 | 0.813 | 0.739 | 76 | 2 | 33 |
| preview | description | 0.988 | 0.78 | 0.938 | 0.872 | 0.814 | 85 | 1 | 24 |
| preview | contact | 1 | 1 | 1 | 1 | 1 | 120 | 0 | 0 |
| preview | address town/state | 1 | 0.225 | 0.592 | 0.367 | 0.266 | 18 | 0 | 62 |
| preview | tree count/species | 0.897 | 0.65 | 0.833 | 0.754 | 0.688 | 52 | 6 | 28 |
| preview | option A/B structure | 1 | 0.95 | 0.99 | 0.974 | 0.96 | 76 | 0 | 4 |

## total-01

**Raw input**

Sarah Miller, sarah.miller@gmail.com, 812-555-0101, 117 Main Street Madison, remove 2 maple trees, option a remove trees only 1000, option b remove trees grind both stumps and haul debris 1500

**Expected:** Option A $1,000; Option B $1,500; Option B services: remove, grind, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Sarah Miller; 812-555-0101; sarah.miller@gmail.com |
| Service address | 117 Main Street, Madison, Indiana |
| Tree count/species | 2 trees; maple |
| Job description | Remove two maple trees. Options include haul away. |
| Option A | **$1,000**; remove two maple trees only; remove two maple trees only |
| Option B | **$1,500**; remove trees grind both stumps and haul debris; remove trees grind both stumps and haul debris |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Sarah Miller; 812-555-0101; sarah.miller@gmail.com |
| Service address | 117 Main Street |
| Tree count/species | 2 trees; maple |
| Job description | Remove two maple trees. Options include haul away. |
| Option A | **$1,000**; Maple tree removal; Remove the two maple trees. |
| Option B | **$1,500**; Maple tree removal with stump grinding; Remove the two maple trees and grind the stumps and haul away the debris. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Sarah Miller; 812-555-0101; sarah.miller@gmail.com |
| Service address | 117 Main Street |
| Tree count/species | 2 trees; maple |
| Job description | Remove two maple trees. Options include haul away. |
| Option A | **$1,000**; Maple tree removal; Remove the two maple trees. |
| Option B | **$1,500**; Maple tree removal with stump grinding; Remove the two maple trees and grind the stumps and haul away the debris. |
| Ready | No |
| Blocking/needs more info | SOURCE_STUMP_QUANTITY_CHANGED: Option B source says stump quantity is "two stumps", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-02

**Raw input**

812-555-0102, daniel.ross@yahoo.com, Daniel Ross, 44 River Road Hanover, one oak by garage, A take oak down leave wood 900, B take oak down grind stump clean up total 1400

**Expected:** Option A $900; Option B $1,400; Option B services: remove, grind, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Daniel Ross; 812-555-0102; daniel.ross@yahoo.com |
| Service address | 44 River Road, Hanover, Indiana |
| Tree count/species | 1 tree; oak |
| Job description | Remove one oak tree near the garage. Options include leaving wood on site, cleanup or stump grinding. |
| Option A | **$900**; leave wood; leave wood |
| Option B | **$1,400**; remove one oak tree and cleanup and stump grinding; remove one oak tree and cleanup and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Daniel Ross; 812-555-0102; daniel.ross@yahoo.com |
| Service address | 44 River Road, Hanover, Indiana |
| Tree count/species | 1 tree; oak |
| Job description | Remove one oak tree near the garage. Options include leaving wood on site, cleanup or stump grinding. |
| Option A | **$900**; leave wood; leave wood |
| Option B | **$1,400**; remove one oak tree and cleanup and stump grinding; remove one oak tree and cleanup and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Daniel Ross; 812-555-0102; daniel.ross@yahoo.com |
| Service address | 44 River Road, Hanover, Indiana |
| Tree count/species | 1 tree; oak |
| Job description | Remove one oak tree near the garage. Options include leaving wood on site, cleanup or stump grinding. |
| Option A | **$900**; leave wood; leave wood |
| Option B | **$1,400**; remove one oak tree and cleanup and stump grinding; remove one oak tree and cleanup and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

## total-03

**Raw input**

Kelly Ward, 88 Walnut St Seymour, 812-555-0103, kelly.ward@outlook.com, 3 ash trees back yard, option a drop and leave brush $1800, option b remove all haul brush and rake up all in $2500

**Expected:** Option A $1,800; Option B $2,500; Option B services: remove, haul, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Kelly Ward; 812-555-0103; kelly.ward@outlook.com |
| Service address | 88 Walnut St, Seymour, Indiana |
| Tree count/species | 3 trees; ash |
| Job description | Remove three ash trees. Options include haul away. |
| Option A | **$1,800**; drop and leave brush; drop and leave brush |
| Option B | **$2,500**; remove three ash trees and haul away; remove three ash trees and haul away |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Kelly Ward; 812-555-0103; kelly.ward@outlook.com |
| Service address | 88 Walnut St |
| Tree count/species | 3 trees; ash |
| Job description | Remove three ash trees. Options include haul away or cleanup. |
| Option A | **$1,800**; drop and leave brush; drop and leave brush |
| Option B | **$2,500**; remove three ash trees and haul away the brush and cleanup; remove three ash trees and haul away the brush and cleanup |
| Ready | No |
| Blocking/needs more info | SOURCE_TARGET_QUALIFIER_OMITTED: Option A source says target/location qualifier is "back yard", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TARGET_QUALIFIER_OMITTED: Option B source says target/location qualifier is "back yard", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Kelly Ward; 812-555-0103; kelly.ward@outlook.com |
| Service address | 88 Walnut St |
| Tree count/species | 3 trees; ash |
| Job description | Remove three ash trees. Options include haul away or cleanup. |
| Option A | **$1,800**; drop and leave brush; drop and leave brush |
| Option B | **$2,500**; remove three ash trees and haul away the brush and cleanup; remove three ash trees and haul away the brush and cleanup |
| Ready | No |
| Blocking/needs more info | SOURCE_TARGET_QUALIFIER_OMITTED: Option A source says target/location qualifier is "back yard", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TARGET_QUALIFIER_OMITTED: Option B source says target/location qualifier is "back yard", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-04

**Raw input**

maria.lopez@gmail.com, Maria Lopez, 812-555-0104, 19 Oak Lane Sellersburg, remove pine near fence, opt a removal leave logs 1100, opt b removal chip brush haul chips complete option 1650

**Expected:** Option A $1,100; Option B $1,650; Option B services: remove, chip, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Maria Lopez; 812-555-0104; maria.lopez@gmail.com |
| Service address | 19 Oak Lane, Sellersburg, Indiana |
| Tree count/species | 1 tree; pine |
| Job description | Remove one pine tree near the fence. Options include leaving wood on site or haul away. |
| Option A | **$1,100**; removal leave logs; removal leave logs |
| Option B | **$1,650**; remove one pine tree and haul away; remove one pine tree and haul away |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Maria Lopez; 812-555-0104; maria.lopez@gmail.com |
| Service address | 19 Oak Lane |
| Tree count/species | 1 tree; pine |
| Job description | Remove one pine tree near the fence. Options include leaving wood on site or haul away. |
| Option A | **$1,100**; Pine tree removal; Remove the pine tree near the fence and leave the logs on site. |
| Option B | **$1,650**; Pine tree removal with brush haul-away; Remove the pine tree near the fence and leave the logs on site and chip the brush and haul away the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Maria Lopez; 812-555-0104; maria.lopez@gmail.com |
| Service address | 19 Oak Lane |
| Tree count/species | 1 tree; pine |
| Job description | Remove one pine tree near the fence. Options include leaving wood on site or haul away. |
| Option A | **$1,100**; Pine tree removal; Remove the pine tree near the fence and leave the logs on site. |
| Option B | **$1,650**; Pine tree removal with brush haul-away; Remove the pine tree near the fence and leave the logs on site and chip the brush and haul away the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

## total-05

**Raw input**

Tom Reed, 812-555-0105, 71 Market Street Charlestown, tom.reed@icloud.com, two elm trees, A remove only 1500, B remove both and grind stumps package $2300

**Expected:** Option A $1,500; Option B $2,300; Option B services: remove, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Tom Reed; 812-555-0105; tom.reed@icloud.com |
| Service address | 71 Market Street, Charlestown, Indiana |
| Tree count/species | 2 trees; elm |
| Job description | Remove two elm trees. Options include stump grinding. |
| Option A | **$1,500**; remove two elm trees only; remove two elm trees only |
| Option B | **$2,300**; remove two elm trees and stump grinding; remove two elm trees and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Tom Reed; 812-555-0105; tom.reed@icloud.com |
| Service address | 71 Market Street |
| Tree count/species | 2 trees; elm |
| Job description | Remove two elm trees. Options include stump grinding. |
| Option A | **$1,500**; remove two elm trees only; remove two elm trees only |
| Option B | **$2,300**; remove two elm trees and stump grinding; remove two elm trees and stump grinding |
| Ready | No |
| Blocking/needs more info | SOURCE_STUMP_QUANTITY_CHANGED: Option B source says stump quantity is "two stumps", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Tom Reed; 812-555-0105; tom.reed@icloud.com |
| Service address | 71 Market Street |
| Tree count/species | 2 trees; elm |
| Job description | Remove two elm trees. Options include stump grinding. |
| Option A | **$1,500**; remove two elm trees only; remove two elm trees only |
| Option B | **$2,300**; remove two elm trees and stump grinding; remove two elm trees and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

## total-06

**Raw input**

amy.hall@gmail.com, 812-555-0106, Amy Hall, 33 Lake Road Scottsburg, 1 sycamore over shed, option 1 take down leave debris 2100, option 2 take down haul debris and stump grinding for 2950

**Expected:** Option A $2,100; Option B $2,950; Option B services: remove, haul, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Amy Hall; 812-555-0106; amy.hall@gmail.com |
| Service address | 33 Lake Road, Scottsburg, Indiana |
| Tree count/species | 1 tree; sycamore |
| Job description | Remove one sycamore tree over the shed. Options include haul away or stump grinding. |
| Option A | **$2,100**; take down leave debris; take down leave debris |
| Option B | **$2,950**; remove one sycamore tree and haul away and stump grinding; remove one sycamore tree and haul away and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Amy Hall; 812-555-0106; amy.hall@gmail.com |
| Service address | 33 Lake Road |
| Tree count/species | 1 tree; sycamore |
| Job description | Remove one sycamore tree over the shed. Options include haul away or stump grinding. |
| Option A | **$2,100**; Sycamore tree removal; Remove the sycamore tree over the shed and leave the debris on site. |
| Option B | **$2,950**; Sycamore tree removal with stump grinding; Remove the sycamore tree over the shed and grind the stump and haul away the debris. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Amy Hall; 812-555-0106; amy.hall@gmail.com |
| Service address | 33 Lake Road |
| Tree count/species | 1 tree; sycamore |
| Job description | Remove one sycamore tree over the shed. Options include haul away or stump grinding. |
| Option A | **$2,100**; Sycamore tree removal; Remove the sycamore tree over the shed and leave the debris on site. |
| Option B | **$2,950**; Sycamore tree removal with stump grinding; Remove the sycamore tree over the shed and grind the stump and haul away the debris. |
| Ready | Yes |
| Blocking/needs more info | None |

## total-07

**Raw input**

Brian Cole, brian.cole@yahoo.com, 812-555-0107, 206 Pike Street Vernon, remove 4 small cedars, a cut down stack wood 1600, b cut down chip brush cleanup quoted 2150

**Expected:** Option A $1,600; Option B $2,150; Option B services: remove, chip, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Brian Cole; 812-555-0107; brian.cole@yahoo.com |
| Service address | 206 Pike Street, Vernon, Indiana |
| Tree count/species | 4 trees; cedar |
| Job description | Remove four small cedars. Options include leaving wood on site or cleanup. |
| Option A | **$1,600**; cut down stack wood; cut down stack wood |
| Option B | **$2,150**; remove four cedar trees and cleanup; remove four cedar trees and cleanup |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Brian Cole; 812-555-0107; brian.cole@yahoo.com |
| Service address | 206 Pike Street |
| Tree count/species | 4 trees; cedar |
| Job description | Remove four small cedars. Options include leaving wood on site or cleanup. |
| Option A | **$1,600**; Cedar tree removal; Remove the four cedar trees and leave the wood on site. |
| Option B | **$2,150**; Cedar tree removal with brush cleanup; Remove the four cedar trees and leave the wood on site and clean up the brush. |
| Ready | No |
| Blocking/needs more info | SOURCE_DEBRIS_DISPOSITION_CHANGED: Option A source says debris disposition is "stack wood", but final TD2 says "leave wood". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "chip brush", but final TD2 says "remove tree, cleanup". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "chip brush", but final TD2 says "leave wood, cleanup". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Brian Cole; 812-555-0107; brian.cole@yahoo.com |
| Service address | 206 Pike Street |
| Tree count/species | 4 trees; cedar |
| Job description | Remove four small cedars. Options include leaving wood on site or cleanup. |
| Option A | **$1,600**; Cedar tree removal; Remove the four cedar trees and leave the wood on site. |
| Option B | **$2,150**; Cedar tree removal with brush cleanup; Remove the four cedar trees and leave the wood on site and clean up the brush. |
| Ready | No |
| Blocking/needs more info | SOURCE_DEBRIS_DISPOSITION_CHANGED: Option A source says debris disposition is "stack wood", but final TD2 says "leave wood". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "chip brush", but final TD2 says "remove tree, cleanup". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "chip brush", but final TD2 says "leave wood, cleanup". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-08

**Raw input**

812-555-0108, Lisa Grant, lisa.grant@outlook.com, 51 Main Street North Vernon, walnut near drive, option a remove leave trunk 1250, option b remove haul wood grind stump price 1900

**Expected:** Option A $1,250; Option B $1,900; Option B services: remove, haul, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Lisa Grant; 812-555-0108; lisa.grant@outlook.com |
| Service address | 51 Main Street, North Vernon, Indiana |
| Tree count/species | walnut |
| Job description | Remove walnut trees near the drive. Options include haul away or stump grinding. |
| Option A | **$1,250**; remove trunk, leave stump; remove trunk, leave stump |
| Option B | **$1,900**; remove walnut trees and haul away and stump grinding; remove walnut trees and haul away and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Lisa Grant; 812-555-0108; lisa.grant@outlook.com |
| Service address | 51 Main Street |
| Tree count/species |  |
| Job description | Remove leave trunk. |
| Option A | **$1,250**; Walnut tree removal; Remove the walnut tree. |
| Option B | **$1,900**; Walnut tree removal with stump grinding; Remove the walnut tree and grind the stump. |
| Ready | No |
| Blocking/needs more info | SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "haul debris", but final TD2 says "remove tree, grind stump". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Lisa Grant; 812-555-0108; lisa.grant@outlook.com |
| Service address | 51 Main Street, North Vernon, Indiana |
| Tree count/species |  |
| Job description | Remove leave trunk. |
| Option A | **$1,250**; Walnut tree removal; Remove the walnut tree. |
| Option B | **$1,900**; Walnut tree removal with stump grinding; Remove the walnut tree and grind the stump. |
| Ready | No |
| Blocking/needs more info | SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "haul debris", but final TD2 says "remove tree, grind stump". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-09

**Raw input**

Paul King, 94 High Street Salem, paul.king@gmail.com, 812-555-0109, 2 birch trees, A removal only $1300, B removal plus haul brush plus cleanup total $1850

**Expected:** Option A $1,300; Option B $1,850; Option B services: remove, haul, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Paul King; 812-555-0109; paul.king@gmail.com |
| Service address | 94 High Street, Salem, Indiana |
| Tree count/species | 2 trees; birch |
| Job description | Remove two birch trees. Options include haul away or cleanup. |
| Option A | **$1,300**; remove two birch trees only; remove two birch trees only |
| Option B | **$1,850**; remove two birch trees and haul away and cleanup; remove two birch trees and haul away and cleanup |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Paul King; 812-555-0109; paul.king@gmail.com |
| Service address | 94 High Street |
| Tree count/species | 2 trees; birch |
| Job description | Remove two birch trees. Options include haul away or cleanup. |
| Option A | **$1,300**; Birch tree removal; Remove the birch tree. |
| Option B | **$1,850**; Birch tree removal with brush haul-away; Remove the birch tree and clean up the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Paul King; 812-555-0109; paul.king@gmail.com |
| Service address | 94 High Street |
| Tree count/species | 2 trees; birch |
| Job description | Remove two birch trees. Options include haul away or cleanup. |
| Option A | **$1,300**; Birch tree removal; Remove the birch tree. |
| Option B | **$1,850**; Birch tree removal with brush haul-away; Remove the birch tree and clean up the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

## total-10

**Raw input**

nina.bell@yahoo.com, Nina Bell, 812-555-0110, 62 Mill Road Austin, cherry tree beside house, first option remove leave wood 1400, second option remove split logs and clean area $2050 all in

**Expected:** Option A $1,400; Option B $2,050; Option B services: remove, split, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Nina Bell; 812-555-0110; nina.bell@yahoo.com |
| Service address | 62 Mill Road, Austin, Indiana |
| Tree count/species | 1 tree; cherry |
| Job description | Remove one cherry tree beside the house. Options include leaving wood on site. |
| Option A | **$1,400**; remove leave wood; remove leave wood |
| Option B | **$2,050**; remove split logs and clean area; remove split logs and clean area |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Nina Bell; 812-555-0110; nina.bell@yahoo.com |
| Service address | 62 Mill Road, Austin, Indiana |
| Tree count/species | 1 tree; cherry |
| Job description | Remove one cherry tree beside the house. Options include leaving wood on site. |
| Option A | **$1,400**; remove leave wood; remove leave wood |
| Option B | **$2,050**; remove split logs and clean area; remove split logs and clean area |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Nina Bell; 812-555-0110; nina.bell@yahoo.com |
| Service address | 62 Mill Road |
| Tree count/species | 1 tree; cherry |
| Job description | Remove one cherry tree beside the house. Options include leaving wood on site. |
| Option A | **$1,400**; remove leave wood; remove leave wood |
| Option B | **$2,050**; remove split logs and clean area; remove split logs and clean area |
| Ready | Yes |
| Blocking/needs more info | None |

## total-11

**Raw input**

Eric Stone, 812-555-0111, eric.stone@gmail.com, 13 College Avenue Hanover, three locusts by barn, option a fell leave everything 2700, option b fell chip brush haul chips complete 3400

**Expected:** Option A $2,700; Option B $3,400; Option B services: remove, chip, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Eric Stone; 812-555-0111; eric.stone@gmail.com |
| Service address | 13 College Avenue, Hanover, Indiana |
| Tree count/species | 3 trees; locusts |
| Job description | Remove three locusts near the barn. Options include haul away. |
| Option A | **$2,700**; leave everything; leave everything |
| Option B | **$3,400**; remove three locusts trees and haul away; remove three locusts trees and haul away |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Eric Stone; 812-555-0111; eric.stone@gmail.com |
| Service address | 13 College Avenue |
| Tree count/species | 3 trees; locust |
| Job description | Remove three locusts near the barn. Options include haul away. |
| Option A | **$2,700**; leave everything; leave everything |
| Option B | **$3,400**; remove three locust trees and haul away the brush; remove three locust trees and haul away the brush |
| Ready | No |
| Blocking/needs more info | SOURCE_TARGET_QUALIFIER_OMITTED: Option A source says target/location qualifier is "next to barn", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "chip brush", but final TD2 says "remove tree, haul brush". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "chip brush", but final TD2 says "haul brush". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TARGET_QUALIFIER_OMITTED: Option B source says target/location qualifier is "next to barn", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Eric Stone; 812-555-0111; eric.stone@gmail.com |
| Service address | 13 College Avenue |
| Tree count/species | 3 trees; locust |
| Job description | Remove three locusts near the barn. Options include haul away. |
| Option A | **$2,700**; leave everything; leave everything |
| Option B | **$3,400**; remove three locust trees and haul away the brush; remove three locust trees and haul away the brush |
| Ready | No |
| Blocking/needs more info | SOURCE_TARGET_QUALIFIER_OMITTED: Option A source says target/location qualifier is "next to barn", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "chip brush", but final TD2 says "remove tree, haul brush". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "chip brush", but final TD2 says "haul brush". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TARGET_QUALIFIER_OMITTED: Option B source says target/location qualifier is "next to barn", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-12

**Raw input**

Jill Price, jill.price@outlook.com, 812-555-0112, 78 Cross Street Crothersville, 2 poplars, A drop and leave 1900, B drop haul debris backfill stump holes $2800 total

**Expected:** Option A $1,900; Option B $2,800; Option B services: remove, haul, backfill.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Jill Price; 812-555-0112; jill.price@outlook.com |
| Service address | 78 Cross Street, Crothersville, Indiana |
| Tree count/species | 2 trees; poplars |
| Job description | Remove two poplars trees. Options include haul away. |
| Option A | **$1,900**; drop and leave; drop and leave |
| Option B | **$2,800**; remove two poplars trees and haul away; remove two poplars trees and haul away |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Jill Price; 812-555-0112; jill.price@outlook.com |
| Service address | 78 Cross Street |
| Tree count/species | 2 trees; poplars |
| Job description | Remove two poplars trees. Options include haul away. |
| Option A | **$1,900**; Poplar tree removal; Remove the poplar tree. |
| Option B | **$2,800**; Poplar tree removal with stump grinding; Remove the poplar tree and grind the stump and haul away the debris. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Jill Price; 812-555-0112; jill.price@outlook.com |
| Service address | 78 Cross Street |
| Tree count/species | 2 trees; poplars |
| Job description | Remove two poplars trees. Options include haul away. |
| Option A | **$1,900**; Poplar tree removal; Remove the poplar tree. |
| Option B | **$2,800**; Poplar tree removal with stump grinding; Remove the poplar tree and grind the stump and haul away the debris. |
| Ready | Yes |
| Blocking/needs more info | None |

## total-13

**Raw input**

812-555-0113, Mark Young, 25 Hill Road Little York, mark.young@yahoo.com, maple at back fence, opt a remove tree 1150, opt b remove tree grind stump topsoil and seed package 1850

**Expected:** Option A $1,150; Option B $1,850; Option B services: remove, grind, topsoil, seed.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Mark Young; 812-555-0113; mark.young@yahoo.com |
| Service address | 25 Hill Road, Little York, Indiana |
| Tree count/species | 1 tree; maple |
| Job description | Remove one maple tree. Options include stump grinding. |
| Option A | **$1,150**; remove tree; remove tree |
| Option B | **$1,850**; remove tree, grind stump, topsoil, seed package; remove tree, grind stump, topsoil, seed package |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Mark Young; 812-555-0113; mark.young@yahoo.com |
| Service address | 25 Hill Road |
| Tree count/species | 1 tree |
| Job description | Remove one tree. Options include stump grinding. |
| Option A | **$1,150**; remove tree; remove tree |
| Option B | **$1,850**; remove tree grind stump topsoil and seed package; remove tree grind stump topsoil and seed package |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "maple", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "maple", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Mark Young; 812-555-0113; mark.young@yahoo.com |
| Service address | 25 Hill Road |
| Tree count/species | 1 tree |
| Job description | Remove one tree. Options include stump grinding. |
| Option A | **$1,150**; remove tree; remove tree |
| Option B | **$1,850**; remove tree grind stump topsoil and seed package; remove tree grind stump topsoil and seed package |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "maple", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "maple", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-14

**Raw input**

anna.gray@gmail.com, Anna Gray, 812-555-0114, 109 Park Lane Paoli, two dead oaks, option a remove leave wood 2200, option b remove haul wood and grind two stumps quote $3200

**Expected:** Option A $2,200; Option B $3,200; Option B services: remove, haul, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Anna Gray; 812-555-0114; anna.gray@gmail.com |
| Service address | 109 Park Lane, Paoli, Indiana |
| Tree count/species | 2 trees; oak |
| Job description | Remove two dead oaks. Options include leaving wood on site or haul away. |
| Option A | **$2,200**; remove leave wood; remove leave wood |
| Option B | **$3,200**; remove two oak trees and haul away; remove two oak trees and haul away |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Anna Gray; 812-555-0114; anna.gray@gmail.com |
| Service address | 109 Park Lane |
| Tree count/species | 2 trees; oak |
| Job description | Remove two dead oaks. Options include leaving wood on site or haul away. |
| Option A | **$2,200**; remove leave wood; remove leave wood |
| Option B | **$3,200**; remove two oak trees and haul away; remove two oak trees and haul away |
| Ready | No |
| Blocking/needs more info | SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "grind stump", but final TD2 says "remove tree, haul debris". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_STUMP_QUANTITY_CHANGED: Option B source says stump quantity is "two stumps", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_STUMP_TREATMENT_CHANGED: Option B source says stump treatment is "grind stump", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Anna Gray; 812-555-0114; anna.gray@gmail.com |
| Service address | 109 Park Lane, Paoli, Indiana |
| Tree count/species | 2 trees; oak |
| Job description | Remove two dead oaks. Options include leaving wood on site or haul away. |
| Option A | **$2,200**; remove leave wood; remove leave wood |
| Option B | **$3,200**; remove two oak trees and haul away; remove two oak trees and haul away |
| Ready | No |
| Blocking/needs more info | SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "grind stump", but final TD2 says "remove tree, haul debris". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_STUMP_QUANTITY_CHANGED: Option B source says stump quantity is "two stumps", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_STUMP_TREATMENT_CHANGED: Option B source says stump treatment is "grind stump", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-15

**Raw input**

Chris Lane, 812-555-0115, 40 Main Street Bedford, chris.lane@icloud.com, ash tree close to garage, A take down leave brush 1700, B take down chip and haul brush full service 2350

**Expected:** Option A $1,700; Option B $2,350; Option B services: remove, chip, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Chris Lane; 812-555-0115; chris.lane@icloud.com |
| Service address | 40 Main Street, Bedford, Indiana |
| Tree count/species | 1 tree; ash |
| Job description | Remove one ash tree near the garage. Options include haul away. |
| Option A | **$1,700**; take down leave brush; take down leave brush |
| Option B | **$2,350**; remove one ash tree and haul away; remove one ash tree and haul away |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Chris Lane; 812-555-0115; chris.lane@icloud.com |
| Service address | 40 Main Street |
| Tree count/species | 1 tree; ash |
| Job description | Remove one ash tree near the garage. Options include haul away. |
| Option A | **$1,700**; Ash tree removal; Remove the ash tree near the garage and leave the brush on site. |
| Option B | **$2,350**; Ash tree removal with brush haul-away; Remove the ash tree near the garage and chip the brush and haul away the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Chris Lane; 812-555-0115; chris.lane@icloud.com |
| Service address | 40 Main Street |
| Tree count/species | 1 tree; ash |
| Job description | Remove one ash tree near the garage. Options include haul away. |
| Option A | **$1,700**; Ash tree removal; Remove the ash tree near the garage and leave the brush on site. |
| Option B | **$2,350**; Ash tree removal with brush haul-away; Remove the ash tree near the garage and chip the brush and haul away the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

## total-16

**Raw input**

melissa.ford@gmail.com, 812-555-0116, Melissa Ford, 305 Walnut Street Madison, 3 pines along drive, option a cut down only 2400, option b cut down chip limbs cleanup complete option $3100

**Expected:** Option A $2,400; Option B $3,100; Option B services: remove, chip, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Melissa Ford; 812-555-0116; melissa.ford@gmail.com |
| Service address | 305 Walnut Street, Madison, Indiana |
| Tree count/species | 3 trees; pine |
| Job description | Remove three pine trees. Options include cleanup. |
| Option A | **$2,400**; remove three pine trees only; remove three pine trees only |
| Option B | **$3,100**; cut down, chip limbs, cleanup; cut down, chip limbs, cleanup |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Melissa Ford; 812-555-0116; melissa.ford@gmail.com |
| Service address | 3 pines along drive |
| Tree count/species |  |
| Job description | Cut down only. |
| Option A | **$2,400**; cut down only; cut down only |
| Option B | **$3,100**; cut down chip limbs cleanup complete; cut down chip limbs cleanup complete |
| Ready | No |
| Blocking/needs more info | SOURCE_TREE_QUANTITY_CHANGED: Option A source says tree quantity is "three trees", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TREE_QUANTITY_CHANGED: Option B source says tree quantity is "three trees", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Melissa Ford; 812-555-0116; melissa.ford@gmail.com |
| Service address | 3 pines along drive |
| Tree count/species |  |
| Job description | Cut down only. |
| Option A | **$2,400**; cut down only; cut down only |
| Option B | **$3,100**; cut down chip limbs cleanup complete; cut down chip limbs cleanup complete |
| Ready | No |
| Blocking/needs more info | SOURCE_TREE_QUANTITY_CHANGED: Option A source says tree quantity is "three trees", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TREE_QUANTITY_CHANGED: Option B source says tree quantity is "three trees", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-17

**Raw input**

Henry West, henry.west@yahoo.com, 812-555-0117, 18 Cedar Road Seymour, one willow by creek, a remove leave logs 1350, b remove buck logs and haul brush priced 1950

**Expected:** Option A $1,350; Option B $1,950; Option B services: remove, buck, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Henry West; 812-555-0117; henry.west@yahoo.com |
| Service address | 18 Cedar Road, Seymour, Indiana |
| Tree count/species | 1 tree; willow |
| Job description | Remove one willow tree near the creek. Options include leaving wood on site or haul away. |
| Option A | **$1,350**; leave logs; leave logs |
| Option B | **$1,950**; remove one willow tree and haul away; remove one willow tree and haul away |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Henry West; 812-555-0117; henry.west@yahoo.com |
| Service address | 18 Cedar Road |
| Tree count/species |  |
| Job description | Remove leave logs. |
| Option A | **$1,350**; Cedar tree removal; Remove the cedar tree by creek and leave the logs on site. |
| Option B | **$1,950**; Cedar tree removal with brush haul-away; Remove the cedar tree by creek and haul away the brush. |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "willow", but final TD2 says "cedar". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TREE_QUANTITY_CHANGED: Option A source says tree quantity is "one tree", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "willow", but final TD2 says "cedar". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TREE_QUANTITY_CHANGED: Option B source says tree quantity is "one tree", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Henry West; 812-555-0117; henry.west@yahoo.com |
| Service address | 18 Cedar Road |
| Tree count/species |  |
| Job description | Remove leave logs. |
| Option A | **$1,350**; Cedar tree removal; Remove the cedar tree by creek and leave the logs on site. |
| Option B | **$1,950**; Cedar tree removal with brush haul-away; Remove the cedar tree by creek and haul away the brush. |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "willow", but final TD2 says "cedar". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TREE_QUANTITY_CHANGED: Option A source says tree quantity is "one tree", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "willow", but final TD2 says "cedar". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TREE_QUANTITY_CHANGED: Option B source says tree quantity is "one tree", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## total-18

**Raw input**

812-555-0118, Olivia Snow, olivia.snow@outlook.com, 99 Ridge Lane Salem, 2 hickories, option A removal leave debris 2600, option B removal grind stumps haul debris cost 3700

**Expected:** Option A $2,600; Option B $3,700; Option B services: remove, grind, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Olivia Snow; 812-555-0118; olivia.snow@outlook.com |
| Service address | 99 Ridge Lane, Salem, Indiana |
| Tree count/species | 2 trees; hickories |
| Job description | Remove two hickories. Options include haul away, cleanup or stump grinding. |
| Option A | **$2,600**; removal and debris cleanup; removal and debris cleanup |
| Option B | **$3,700**; remove two hickories trees and haul away and stump grinding; remove two hickories trees and haul away and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Olivia Snow; 812-555-0118; olivia.snow@outlook.com |
| Service address | 99 Ridge Lane |
| Tree count/species | 2 trees; hickories |
| Job description | Remove two hickories. Options include haul away or stump grinding. |
| Option A | **$2,600**; Tree removal; Remove the tree and leave the debris on site. |
| Option B | **$3,700**; Tree removal with stump grinding; Remove the tree and grind the stump and haul away the debris. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Olivia Snow; 812-555-0118; olivia.snow@outlook.com |
| Service address | 99 Ridge Lane |
| Tree count/species | 2 trees; hickories |
| Job description | Remove two hickories. Options include haul away or stump grinding. |
| Option A | **$2,600**; Tree removal; Remove the tree and leave the debris on site. |
| Option B | **$3,700**; Tree removal with stump grinding; Remove the tree and grind the stump and haul away the debris. |
| Ready | Yes |
| Blocking/needs more info | None |

## total-19

**Raw input**

George Hill, 812-555-0119, george.hill@gmail.com, 7 Spring Street Austin, cedar near porch, first option remove only 950, second option remove chip brush rake yard $1450 whole job

**Expected:** Option A $950; Option B $1,450; Option B services: remove, chip, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | George Hill; 812-555-0119; george.hill@gmail.com |
| Service address | 7 Spring Street, Austin, Indiana |
| Tree count/species |  |
| Job description | Remove chip brush rake yard whole job. |
| Option A | **$950**; remove only; remove only |
| Option B | **$1,450**; remove chip brush rake yard whole job; remove chip brush rake yard whole job |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | George Hill; 812-555-0119; george.hill@gmail.com |
| Service address | 7 Spring Street |
| Tree count/species |  |
| Job description | Remove only, second option remove chip brush rake yard whole job. |
| Option A | **$950**; Cedar tree removal; Remove the cedar tree near porch. |
| Option B | **$1,450**; Cedar tree removal with brush cleanup; Remove the cedar tree near porch and clean up the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | George Hill; 812-555-0119; george.hill@gmail.com |
| Service address | 7 Spring Street |
| Tree count/species |  |
| Job description | Remove only, second option remove chip brush rake yard whole job. |
| Option A | **$950**; Cedar tree removal; Remove the cedar tree near porch. |
| Option B | **$1,450**; Cedar tree removal with brush cleanup; Remove the cedar tree near porch and clean up the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

## total-20

**Raw input**

rachel.moon@yahoo.com, Rachel Moon, 812-555-0120, 61 Forest Road North Vernon, four maples, opt a drop leave wood 3000, opt b remove haul wood grind stumps all-in 4300

**Expected:** Option A $3,000; Option B $4,300; Option B services: remove, haul, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Rachel Moon; 812-555-0120; rachel.moon@yahoo.com |
| Service address | 61 Forest Road, North Vernon, Indiana |
| Tree count/species | 4 trees; maple |
| Job description | Remove four maples. Options include leaving wood on site, haul away or stump grinding. |
| Option A | **$3,000**; drop leave wood; drop leave wood |
| Option B | **$4,300**; remove four maple trees and haul away and stump grinding; remove four maple trees and haul away and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Rachel Moon; 812-555-0120; rachel.moon@yahoo.com |
| Service address | 61 Forest Road |
| Tree count/species | 4 trees; maple |
| Job description | Remove four maples. Options include leaving wood on site, haul away or stump grinding. |
| Option A | **$3,000**; drop leave wood; drop leave wood |
| Option B | **$4,300**; remove four maple trees and haul away and stump grinding; remove four maple trees and haul away and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Rachel Moon; 812-555-0120; rachel.moon@yahoo.com |
| Service address | 61 Forest Road |
| Tree count/species | 4 trees; maple |
| Job description | Remove four maples. Options include leaving wood on site, haul away or stump grinding. |
| Option A | **$3,000**; drop leave wood; drop leave wood |
| Option B | **$4,300**; remove four maple trees and haul away and stump grinding; remove four maple trees and haul away and stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

## addon-01

**Raw input**

Mark Davis, 812-555-0201, mark.davis@yahoo.com, 44 River Road Hanover, 1 oak by garage, option a remove oak 900, option b grind stump and clean up extra 500

**Expected:** Option A $900; Option B $1,400; Option B services: remove, grind, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Mark Davis; 812-555-0201; mark.davis@yahoo.com |
| Service address | 44 River Road, Hanover, Indiana |
| Tree count/species | 1 tree; oak |
| Job description | Remove one oak tree near the garage. Options include cleanup or stump grinding. |
| Option A | **$900**; remove oak; remove oak |
| Option B | **$500**; grind stump and clean up extra; grind stump and clean up extra |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Mark Davis; 812-555-0201; mark.davis@yahoo.com |
| Service address | 44 River Road |
| Tree count/species | 1 tree; oak |
| Job description | Remove one oak tree near the garage. Options include cleanup or stump grinding. |
| Option A | **$900**; Oak tree removal; Remove the oak tree near the garage. |
| Option B | **$1,400**; Oak tree removal with stump grinding and cleanup; Remove the oak tree near the garage and grind the stump and clean up the work area. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Mark Davis; 812-555-0201; mark.davis@yahoo.com |
| Service address | 44 River Road |
| Tree count/species | 1 tree; oak |
| Job description | Remove one oak tree near the garage. Options include cleanup or stump grinding. |
| Option A | **$900**; Oak tree removal; Remove the oak tree near the garage. |
| Option B | **$1,400**; Oak tree removal with stump grinding and cleanup; Remove the oak tree near the garage and grind the stump and clean up the work area. |
| Ready | Yes |
| Blocking/needs more info | None |

## addon-02

**Raw input**

susan.moore@gmail.com, Susan Moore, 812-555-0202, 120 Main Street Madison, remove two maples, A remove only 1000, B grind stumps and haul away +500

**Expected:** Option A $1,000; Option B $1,500; Option B services: remove, grind, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Susan Moore; 812-555-0202; susan.moore@gmail.com |
| Service address | 120 Main Street, Madison, Indiana |
| Tree count/species | 2 trees; maple |
| Job description | Remove two maples. Options include haul away or stump grinding. |
| Option A | **$1,000**; remove two maple trees only; remove two maple trees only |
| Option B | **$500**; stump grinding and haul away; stump grinding and haul away |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Susan Moore; 812-555-0202; susan.moore@gmail.com |
| Service address | 120 Main Street |
| Tree count/species | 2 trees; maples |
| Job description | Remove two maples. Options include stump grinding. |
| Option A | **$1,000**; Maple tree removal; Remove the two maple trees. |
| Option B | **$1,500**; Maple tree removal with stump grinding; Remove the two maple trees and grind the stumps. |
| Ready | No |
| Blocking/needs more info | SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "haul debris", but final TD2 says "remove tree, grind stump". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Susan Moore; 812-555-0202; susan.moore@gmail.com |
| Service address | 120 Main Street, Madison, Indiana |
| Tree count/species | 2 trees; maple |
| Job description | Remove two maples. Options include stump grinding. |
| Option A | **$1,000**; Maple tree removal; Remove the two maple trees. |
| Option B | **$1,500**; Maple tree removal with stump grinding; Remove the two maple trees and grind the stumps. |
| Ready | No |
| Blocking/needs more info | SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "haul debris", but final TD2 says "remove tree, grind stump". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-03

**Raw input**

812-555-0203, Kevin Scott, kevin.scott@outlook.com, 52 Pine Road Seymour, pine by shed, option a take tree down leave wood 1200, option b chip brush plus 350

**Expected:** Option A $1,200; Option B $1,550; Option B services: remove, chip.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Kevin Scott; 812-555-0203; kevin.scott@outlook.com |
| Service address | 52 Pine Road, Seymour, Indiana |
| Tree count/species | 1 tree; pine |
| Job description | Remove one pine tree near the shed. |
| Option A | **$1,200**; take tree down; take tree down |
| Option B | **$350**; brush; brush |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Kevin Scott; 812-555-0203; kevin.scott@outlook.com |
| Service address | 52 Pine Road |
| Tree count/species |  |
| Job description | Brush. |
| Option A | **$1,200**; leave wood , b chip brush; leave wood , b chip brush |
| Option B | **$1,550**; leave wood , b chip brush; leave wood , b chip brush |
| Ready | No |
| Blocking/needs more info | SOURCE_OPTION_ACTION_OMITTED: Option A source says work actions is "remove tree", but final TD2 says "chip brush". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "pine", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TARGET_QUALIFIER_OMITTED: Option A source says target/location qualifier is "by shed", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "pine", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TARGET_QUALIFIER_OMITTED: Option B source says target/location qualifier is "by shed", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Kevin Scott; 812-555-0203; kevin.scott@outlook.com |
| Service address | 52 Pine Road, Seymour, Indiana |
| Tree count/species |  |
| Job description | Brush. |
| Option A | **$1,200**; leave wood , b chip brush; leave wood , b chip brush |
| Option B | **$1,550**; leave wood , b chip brush; leave wood , b chip brush |
| Ready | No |
| Blocking/needs more info | SOURCE_OPTION_ACTION_OMITTED: Option A source says work actions is "remove tree", but final TD2 says "chip brush". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "pine", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TARGET_QUALIFIER_OMITTED: Option A source says target/location qualifier is "by shed", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "pine", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TARGET_QUALIFIER_OMITTED: Option B source says target/location qualifier is "by shed", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-04

**Raw input**

Laura Green, 15 Oak Lane Sellersburg, laura.green@yahoo.com, 812-555-0204, 3 ash trees, opt a fell and leave 1800, opt b haul debris additional $600

**Expected:** Option A $1,800; Option B $2,400; Option B services: remove, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Laura Green; 812-555-0204; laura.green@yahoo.com |
| Service address | 15 Oak Lane, Sellersburg, Indiana |
| Tree count/species | 3 trees; ash |
| Job description | Remove three ash trees. Options include haul away. |
| Option A | **$1,800**; leave; leave |
| Option B | **$600**; haul debris additional; haul debris additional |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Laura Green; 812-555-0204; laura.green@yahoo.com |
| Service address | 15 Oak Lane |
| Tree count/species | 3 trees; ash |
| Job description | Remove three ash trees. Options include haul away. |
| Option A | **$1,800**; remove three ash trees; remove three ash trees |
| Option B | **$2,400**; remove three ash trees and haul debris; remove three ash trees and haul debris |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Laura Green; 812-555-0204; laura.green@yahoo.com |
| Service address | 15 Oak Lane |
| Tree count/species | 3 trees; ash |
| Job description | Remove three ash trees. Options include haul away. |
| Option A | **$1,800**; remove three ash trees; remove three ash trees |
| Option B | **$2,400**; remove three ash trees and haul debris; remove three ash trees and haul debris |
| Ready | Yes |
| Blocking/needs more info | None |

## addon-05

**Raw input**

david.brown@gmail.com, 812-555-0205, David Brown, 87 Market Street Charlestown, elm close to house, A remove leave debris 1450, B stump grinding add-on 450

**Expected:** Option A $1,450; Option B $1,900; Option B services: remove, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | David Brown; 812-555-0205; david.brown@gmail.com |
| Service address | 87 Market Street, Charlestown, Indiana |
| Tree count/species | 1 tree; elm |
| Job description | Remove one elm tree near the house. Options include stump grinding. |
| Option A | **$1,450**; leave debris; leave debris |
| Option B | **$450**; stump grinding -on; stump grinding -on |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | David Brown; 812-555-0205; david.brown@gmail.com |
| Service address | 87 Market Street, Charlestown, Indiana |
| Tree count/species |  |
| Job description | Remove leave debris. |
| Option A | **$1,450**; remove leave debris; remove leave debris |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "elm", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_PRICE_CHANGED: Option B source says price is "$450", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "grind stump", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "elm", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_STUMP_TREATMENT_CHANGED: Option B source says stump treatment is "grind stump", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | David Brown; 812-555-0205; david.brown@gmail.com |
| Service address | 87 Market Street, Charlestown, Indiana |
| Tree count/species |  |
| Job description | Remove leave debris. |
| Option A | **$1,450**; remove leave debris; remove leave debris |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "elm", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_PRICE_CHANGED: Option B source says price is "$450", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "grind stump", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "elm", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_STUMP_TREATMENT_CHANGED: Option B source says stump treatment is "grind stump", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-06

**Raw input**

Emma White, emma.white@outlook.com, 812-555-0206, 29 Lake Road Scottsburg, two sycamores, option a remove leave logs 2100, option b haul logs add on 700

**Expected:** Option A $2,100; Option B $2,800; Option B services: remove, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Emma White; 812-555-0206; emma.white@outlook.com |
| Service address | 29 Lake Road, Scottsburg, Indiana |
| Tree count/species | 2 trees; sycamore |
| Job description | Remove two sycamores. Options include leaving wood on site or haul away. |
| Option A | **$2,100**; remove leave logs; remove leave logs |
| Option B | **$700**; haul logs on; haul logs on |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Emma White; 812-555-0206; emma.white@outlook.com |
| Service address | 29 Lake Road |
| Tree count/species | 2 trees; sycamore |
| Job description | Remove two sycamores. Options include leaving wood on site. |
| Option A | **$2,100**; remove leave logs; remove leave logs |
| Ready | No |
| Blocking/needs more info | Explicit source options are incomplete in TD2; missing or mismatched Option B $700. / SOURCE_OPTION_PRICE_CHANGED: Option B source says price is "$700", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Emma White; 812-555-0206; emma.white@outlook.com |
| Service address | 29 Lake Road |
| Tree count/species | 2 trees; sycamore |
| Job description | Remove two sycamores. Options include leaving wood on site. |
| Option A | **$2,100**; remove leave logs; remove leave logs |
| Ready | No |
| Blocking/needs more info | Explicit source options are incomplete in TD2; missing or mismatched Option B $700. / SOURCE_OPTION_PRICE_CHANGED: Option B source says price is "$700", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-07

**Raw input**

812-555-0207, Jason Wood, 11 Pike Street Vernon, jason.wood@gmail.com, walnut back yard, A removal only $1300, B grind stump add to that $400

**Expected:** Option A $1,300; Option B $1,700; Option B services: remove, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Jason Wood; 812-555-0207; jason.wood@gmail.com |
| Service address | 11 Pike Street, Vernon, Indiana |
| Tree count/species |  |
| Job description | Removal only. |
| Option A | **$1,300**; removal only; removal only |
| Option B | **$400**; stump grinding; stump grinding |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Jason Wood; 812-555-0207; jason.wood@gmail.com |
| Service address | 11 Pike Street, Vernon, Indiana |
| Tree count/species |  |
| Job description | Tree service. |
| Option A | **$1,300**; Walnut tree removal; Remove the walnut tree in the back yard. |
| Option B | **$1,700**; Walnut tree removal with stump grinding; Remove the walnut tree in the back yard and grind the stump. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Jason Wood; 812-555-0207; jason.wood@gmail.com |
| Service address | 11 Pike Street |
| Tree count/species | 1 tree; walnut |
| Job description | Remove one walnut tree. Options include stump grinding. |
| Option A | **$1,300**; Walnut tree removal; Remove the walnut tree in the back yard. |
| Option B | **$1,700**; Walnut tree removal with stump grinding; Remove the walnut tree in the back yard and grind the stump. |
| Ready | Yes |
| Blocking/needs more info | None |

## addon-08

**Raw input**

Megan Clark, 812-555-0208, megan.clark@yahoo.com, 63 Main Street North Vernon, 4 cedars, option 1 cut down leave brush 2000, option 2 chip and haul brush on top 650

**Expected:** Option A $2,000; Option B $2,650; Option B services: remove, chip, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Megan Clark; 812-555-0208; megan.clark@yahoo.com |
| Service address | 63 Main Street, North Vernon, Indiana |
| Tree count/species | 4 trees; cedar |
| Job description | Remove four cedars. Options include haul away. |
| Option A | **$2,000**; cut down, leave brush; cut down, leave brush |
| Option B | **$650**; haul brush on top; haul brush on top |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Megan Clark; 812-555-0208; megan.clark@yahoo.com |
| Service address | 63 Main Street |
| Tree count/species | 4 trees; cedar |
| Job description | Remove four cedars. Options include haul away. |
| Option A | **$2,000**; Cedar tree removal; Remove the four cedar trees and leave the brush on site. |
| Option B | **$2,650**; Cedar tree removal with brush haul-away; Remove the four cedar trees and chip the brush and haul away the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Megan Clark; 812-555-0208; megan.clark@yahoo.com |
| Service address | 63 Main Street |
| Tree count/species | 4 trees; cedar |
| Job description | Remove four cedars. Options include haul away. |
| Option A | **$2,000**; Cedar tree removal; Remove the four cedar trees and leave the brush on site. |
| Option B | **$2,650**; Cedar tree removal with brush haul-away; Remove the four cedar trees and chip the brush and haul away the brush. |
| Ready | Yes |
| Blocking/needs more info | None |

## addon-09

**Raw input**

nathan.lee@outlook.com, Nathan Lee, 812-555-0209, 73 High Street Salem, birch tree, option a remove leave wood 1050, option b split logs also 300

**Expected:** Option A $1,050; Option B $1,350; Option B services: remove, split.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Nathan Lee; 812-555-0209; nathan.lee@outlook.com |
| Service address | 73 High Street, Salem, Indiana |
| Tree count/species | 1 tree; birch |
| Job description | Remove one birch tree. Options include leaving wood on site. |
| Option A | **$1,050**; remove leave wood; remove leave wood |
| Option B | **$300**; split logs; split logs |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Nathan Lee; 812-555-0209; nathan.lee@outlook.com |
| Service address | 73 High Street, Salem, Indiana |
| Tree count/species | 1 tree; birch |
| Job description | Remove one birch tree. Options include leaving wood on site. |
| Option A | **$1,050**; remove leave wood; remove leave wood |
| Option B | **$300**; split logs; split logs |
| Ready | No |
| Blocking/needs more info | Possible add-on price $300 needs TD2 review before PDF. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Nathan Lee; 812-555-0209; nathan.lee@outlook.com |
| Service address | 73 High Street, Salem, Indiana |
| Tree count/species | 1 tree; birch |
| Job description | Remove one birch tree. Options include leaving wood on site. |
| Option A | **$1,050**; remove leave wood; remove leave wood |
| Option B | **$300**; split logs; split logs |
| Ready | No |
| Blocking/needs more info | Possible add-on price $300 needs TD2 review before PDF. |

## addon-10

**Raw input**

Grace Adams, 36 Mill Road Austin, 812-555-0210, grace.adams@gmail.com, 2 cherry trees, A removal leave debris 1750, B haul debris in addition 500

**Expected:** Option A $1,750; Option B $2,250; Option B services: remove, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Grace Adams; 812-555-0210; grace.adams@gmail.com |
| Service address | 36 Mill Road, Austin, Indiana |
| Tree count/species | 2 trees; cherry |
| Job description | Remove two cherry trees. Options include haul away. |
| Option A | **$1,750**; removal leave debris; removal leave debris |
| Option B | **$500**; haul debris; haul debris |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Grace Adams; 812-555-0210; grace.adams@gmail.com |
| Service address | 36 Mill Road |
| Tree count/species | 2 trees; cherry |
| Job description | Remove two cherry trees. Options include haul away. |
| Option A | **$1,750**; Cherry tree removal; Remove the two cherry trees and leave the debris on site. |
| Option B | **$2,250**; Cherry tree removal with debris haul-away; Remove the two cherry trees and haul away the resulting debris. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Grace Adams; 812-555-0210; grace.adams@gmail.com |
| Service address | 36 Mill Road |
| Tree count/species | 2 trees; cherry |
| Job description | Remove two cherry trees. Options include haul away. |
| Option A | **$1,750**; Cherry tree removal; Remove the two cherry trees and leave the debris on site. |
| Option B | **$2,250**; Cherry tree removal with debris haul-away; Remove the two cherry trees and haul away the resulting debris. |
| Ready | Yes |
| Blocking/needs more info | None |

## addon-11

**Raw input**

812-555-0211, Ryan Baker, ryan.baker@yahoo.com, 17 College Avenue Hanover, locust near barn, opt a drop leave wood 1600, opt b stump grind and backfill added 550

**Expected:** Option A $1,600; Option B $2,150; Option B services: remove, grind, backfill.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Ryan Baker; 812-555-0211; ryan.baker@yahoo.com |
| Service address | 17 College Avenue, Hanover, Indiana |
| Tree count/species |  |
| Job description | Stump grind and backfill added. |
| Option A | **$1,600**; drop leave wood; drop leave wood |
| Option B | **$550**; stump grind and backfill added; stump grind and backfill added |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Ryan Baker; 812-555-0211; ryan.baker@yahoo.com |
| Service address | 17 College Avenue |
| Tree count/species |  |
| Job description | Stump grind and backfill. |
| Option A | **$1,600**; drop leave wood , b; drop leave wood , b |
| Option B | **$2,150**; drop leave wood , b and stump grind and backfill; drop leave wood , b and stump grind and backfill |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Ryan Baker; 812-555-0211; ryan.baker@yahoo.com |
| Service address | 17 College Avenue |
| Tree count/species |  |
| Job description | Stump grind and backfill added. |
| Option A | **$1,600**; drop leave wood , b; drop leave wood , b |
| Option B | **$2,150**; drop leave wood , b and stump grind and backfill; drop leave wood , b and stump grind and backfill |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "locust", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "locust", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-12

**Raw input**

Heather Cox, heather.cox@outlook.com, 812-555-0212, 82 Cross Street Crothersville, three poplars, option a take down leave brush 2300, option b chip brush for another $600

**Expected:** Option A $2,300; Option B $2,900; Option B services: remove, chip.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Heather Cox; 812-555-0212; heather.cox@outlook.com |
| Service address | 82 Cross Street, Crothersville, Indiana |
| Tree count/species | 3 trees; poplar |
| Job description | Remove three poplar trees. |
| Option A | **$2,300**; take down leave brush; take down leave brush |
| Option B | **$600**; brush for another; brush for another |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Heather Cox; 812-555-0212; heather.cox@outlook.com |
| Service address | 82 Cross Street |
| Tree count/species | poplars |
| Job description | Remove poplars trees. |
| Option A | **$2,300**; Poplar tree removal; Remove the poplar tree and leave the brush on site. |
| Option B | **$2,900**; Poplar tree removal with brush cleanup; Remove the poplar tree and chip the brush. |
| Ready | No |
| Blocking/needs more info | SOURCE_TREE_QUANTITY_CHANGED: Option A source says tree quantity is "three trees", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TREE_QUANTITY_CHANGED: Option B source says tree quantity is "three trees", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Heather Cox; 812-555-0212; heather.cox@outlook.com |
| Service address | 82 Cross Street |
| Tree count/species | poplars |
| Job description | Remove poplars trees. |
| Option A | **$2,300**; Poplar tree removal; Remove the poplar tree and leave the brush on site. |
| Option B | **$2,900**; Poplar tree removal with brush cleanup; Remove the poplar tree and chip the brush. |
| Ready | No |
| Blocking/needs more info | SOURCE_TREE_QUANTITY_CHANGED: Option A source says tree quantity is "three trees", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_TREE_QUANTITY_CHANGED: Option B source says tree quantity is "three trees", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-13

**Raw input**

carl.evans@gmail.com, Carl Evans, 812-555-0213, 28 Hill Road Little York, maple by fence, A remove only 1150, B grind stump more for 425

**Expected:** Option A $1,150; Option B $1,575; Option B services: remove, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Carl Evans; 812-555-0213; carl.evans@gmail.com |
| Service address | 28 Hill Road, Little York, Indiana |
| Tree count/species | 1 tree; maple |
| Job description | Remove one maple tree near the fence. Options include stump grinding. |
| Option A | **$1,150**; remove one maple tree only; remove one maple tree only |
| Option B | **$425**; grind stump more; grind stump more |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Carl Evans; 812-555-0213; carl.evans@gmail.com |
| Service address | 28 Hill Road |
| Tree count/species | 1 tree; maple |
| Job description | Remove one maple tree near the fence. Options include stump grinding. |
| Option A | **$1,150**; Maple tree removal; Remove the maple tree by the fence. |
| Option B | **$1,575**; Maple tree removal with stump grinding; Remove the maple tree by the fence and grind the stump. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Carl Evans; 812-555-0213; carl.evans@gmail.com |
| Service address | 28 Hill Road |
| Tree count/species |  |
| Job description | Grind stump more. |
| Option A | **$1,150**; Maple tree removal; Remove the maple tree by the fence. |
| Option B | **$1,575**; Maple tree removal with stump grinding; Remove the maple tree by the fence and grind the stump. |
| Ready | Yes |
| Blocking/needs more info | None |

## addon-14

**Raw input**

Diane Fox, 812-555-0214, 105 Park Lane Paoli, diane.fox@yahoo.com, 2 oaks, option a fell leave debris 1900, option b haul away tack on 525

**Expected:** Option A $1,900; Option B $2,425; Option B services: remove, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Diane Fox; 812-555-0214; diane.fox@yahoo.com |
| Service address | 105 Park Lane, Paoli, Indiana |
| Tree count/species | 2 trees; oak |
| Job description | Remove two oaks. Options include haul away. |
| Option A | **$1,900**; leave debris; leave debris |
| Option B | **$525**; haul away tack on; haul away tack on |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Diane Fox; 812-555-0214; diane.fox@yahoo.com |
| Service address | 105 Park Lane |
| Tree count/species | 2 trees; oak |
| Job description | Remove two oaks. |
| Option A | **$1,900**; leave debris; leave debris |
| Ready | No |
| Blocking/needs more info | Explicit source options are incomplete in TD2; missing or mismatched Option B $525. / SOURCE_OPTION_PRICE_CHANGED: Option B source says price is "$525", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Diane Fox; 812-555-0214; diane.fox@yahoo.com |
| Service address | 105 Park Lane |
| Tree count/species | 2 trees; oak |
| Job description | Remove two oaks. |
| Option A | **$1,900**; leave debris; leave debris |
| Ready | No |
| Blocking/needs more info | Explicit source options are incomplete in TD2; missing or mismatched Option B $525. / SOURCE_OPTION_PRICE_CHANGED: Option B source says price is "$525", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-15

**Raw input**

812-555-0215, Peter Long, peter.long@icloud.com, 42 Main Street Bedford, ash by garage, option a removal leave wood 1500, option b grind stump upgrade 475

**Expected:** Option A $1,500; Option B $1,975; Option B services: remove, grind.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Peter Long; 812-555-0215; peter.long@icloud.com |
| Service address | 42 Main Street, Bedford, Indiana |
| Tree count/species |  |
| Job description | Removal leave wood. |
| Option A | **$1,500**; removal leave wood; removal leave wood |
| Option B | **$475**; grind stump upgrade; grind stump upgrade |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Peter Long; 812-555-0215; peter.long@icloud.com |
| Service address | 42 Main Street |
| Tree count/species |  |
| Job description | Removal leave wood. |
| Option A | **$1,500**; removal leave wood , b; removal leave wood , b |
| Option B | **$1,975**; removal leave wood and stump grinding; removal leave wood and stump grinding |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "ash", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "ash", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Peter Long; 812-555-0215; peter.long@icloud.com |
| Service address | 42 Main Street, Bedford, Indiana |
| Tree count/species |  |
| Job description | Removal leave wood. |
| Option A | **$1,500**; removal leave wood , b; removal leave wood , b |
| Option B | **$1,975**; removal leave wood and stump grinding; removal leave wood and stump grinding |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "ash", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "ash", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-16

**Raw input**

Monica Ray, monica.ray@gmail.com, 812-555-0216, 309 Walnut Street Madison, 3 pines, A cut down stack logs 2500, B haul logs and cleanup extra $750

**Expected:** Option A $2,500; Option B $3,250; Option B services: remove, haul, cleanup.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Monica Ray; 812-555-0216; monica.ray@gmail.com |
| Service address | 309 Walnut Street, Madison, Indiana |
| Tree count/species | 3 trees; pine |
| Job description | Remove three pines. Options include haul away or cleanup. |
| Option A | **$2,500**; cut down logs; cut down logs |
| Option B | **$750**; haul logs and cleanup; haul logs and cleanup |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Monica Ray; 812-555-0216; monica.ray@gmail.com |
| Service address | 309 Walnut Street |
| Tree count/species | 3 trees; pine |
| Job description | Remove three pines. Options include haul away or cleanup. |
| Option A | **$2,500**; Pine tree removal; Remove the three pine trees and leave the logs on site. |
| Option B | **$3,250**; Pine tree removal with debris haul-away; Remove the three pine trees and haul away the resulting debris and clean up the work area. |
| Ready | No |
| Blocking/needs more info | SOURCE_DEBRIS_DISPOSITION_CHANGED: Option A source says debris disposition is "stack logs", but final TD2 says "leave logs". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Monica Ray; 812-555-0216; monica.ray@gmail.com |
| Service address | 309 Walnut Street |
| Tree count/species | 3 trees; pine |
| Job description | Remove three pines. Options include haul away or cleanup. |
| Option A | **$2,500**; Pine tree removal; Remove the three pine trees and leave the logs on site. |
| Option B | **$3,250**; Pine tree removal with debris haul-away; Remove the three pine trees and haul away the resulting debris and clean up the work area. |
| Ready | No |
| Blocking/needs more info | SOURCE_DEBRIS_DISPOSITION_CHANGED: Option A source says debris disposition is "stack logs", but final TD2 says "leave logs". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-17

**Raw input**

812-555-0217, Scott Dean, 20 Cedar Road Seymour, scott.dean@yahoo.com, willow tree, opt a remove leave brush 1250, opt b chip brush + $325

**Expected:** Option A $1,250; Option B $1,575; Option B services: remove, chip.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Scott Dean; 812-555-0217; scott.dean@yahoo.com |
| Service address | 20 Cedar Road, Seymour, Indiana |
| Tree count/species | 1 tree; willow |
| Job description | Remove one willow tree. |
| Option A | **$1,250**; remove leave brush; remove leave brush |
| Option B | **$325**; brush; brush |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Scott Dean; 812-555-0217; scott.dean@yahoo.com |
| Service address | 20 Cedar Road, Seymour, Indiana |
| Tree count/species | 1 tree |
| Job description | Remove one tree. |
| Option A | **$1,250**; remove leave brush , b chip brush +; remove leave brush , b chip brush + |
| Option B | **$1,575**; remove leave brush , b chip brush +; remove leave brush , b chip brush + |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "willow", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "willow", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Scott Dean; 812-555-0217; scott.dean@yahoo.com |
| Service address | 20 Cedar Road |
| Tree count/species | 1 tree; unknown |
| Job description | Remove one unknown tree. |
| Option A | **$1,250**; remove leave brush , b chip brush +; remove leave brush , b chip brush + |
| Option B | **$1,575**; remove leave brush , b chip brush +; remove leave brush , b chip brush + |
| Ready | No |
| Blocking/needs more info | SOURCE_SPECIES_CHANGED: Option A source says tree species/object is "willow", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_SPECIES_CHANGED: Option B source says tree species/object is "willow", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-18

**Raw input**

Beth Hart, beth.hart@outlook.com, 812-555-0218, 102 Ridge Lane Salem, two hickories, option a take down leave wood 2400, option b split logs and haul brush plus 800

**Expected:** Option A $2,400; Option B $3,200; Option B services: remove, split, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Beth Hart; 812-555-0218; beth.hart@outlook.com |
| Service address | 102 Ridge Lane, Salem, Indiana |
| Tree count/species | 2 trees; hickory |
| Job description | Remove two hickories. Options include leaving wood on site or haul away. |
| Option A | **$2,400**; take down leave wood; take down leave wood |
| Option B | **$800**; haul brush; haul brush |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Beth Hart; 812-555-0218; beth.hart@outlook.com |
| Service address | 102 Ridge Lane |
| Tree count/species | 2 trees; hickories |
| Job description | Remove two hickories. Options include haul away. |
| Option A | **$2,400**; remove two hickories; remove two hickories |
| Option B | **$3,200**; remove two hickories trees and haul away the brush; remove two hickories trees and haul away the brush |
| Ready | No |
| Blocking/needs more info | SOURCE_DEBRIS_DISPOSITION_CHANGED: Option A source says debris disposition is "leave wood", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Beth Hart; 812-555-0218; beth.hart@outlook.com |
| Service address | 102 Ridge Lane |
| Tree count/species | 2 trees; hickories |
| Job description | Remove two hickories. Options include haul away. |
| Option A | **$2,400**; remove two hickories; remove two hickories |
| Option B | **$3,200**; remove two hickories trees and haul away the brush; remove two hickories trees and haul away the brush |
| Ready | No |
| Blocking/needs more info | SOURCE_DEBRIS_DISPOSITION_CHANGED: Option A source says debris disposition is "leave wood", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

## addon-19

**Raw input**

william.page@gmail.com, William Page, 812-555-0219, 9 Spring Street Austin, cedar near porch, A remove only 950, B stump grinding topsoil seed additional 625

**Expected:** Option A $950; Option B $1,575; Option B services: remove, grind, topsoil, seed.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | William Page; 812-555-0219; william.page@gmail.com |
| Service address | 9 Spring Street, Austin, Indiana |
| Tree count/species |  |
| Job description | Stump grinding topsoil seed additional. |
| Option A | **$950**; remove only; remove only |
| Option B | **$625**; stump grinding topsoil seed additional; stump grinding topsoil seed additional |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | William Page; 812-555-0219; william.page@gmail.com |
| Service address | 9 Spring Street, Austin, Indiana |
| Tree count/species |  |
| Job description | Stump grinding topsoil seed additional. |
| Option A | **$950**; Cedar tree removal; Remove the cedar tree. |
| Option B | **$1,575**; Cedar tree removal with stump grinding; Remove the cedar tree and grind the stump. |
| Ready | Yes |
| Blocking/needs more info | None |

### Preview

| TD2 field | Value |
|---|---|
| Customer | William Page; 812-555-0219; william.page@gmail.com |
| Service address | 9 Spring Street, Austin, Indiana |
| Tree count/species |  |
| Job description | Stump grinding topsoil seed additional. |
| Option A | **$950**; Cedar tree removal; Remove the cedar tree. |
| Option B | **$1,575**; Cedar tree removal with stump grinding; Remove the cedar tree and grind the stump. |
| Ready | Yes |
| Blocking/needs more info | None |

## addon-20

**Raw input**

Claire Hunt, 812-555-0220, claire.hunt@yahoo.com, 64 Forest Road North Vernon, four maples, option a drop and leave 3000, option b grind stumps haul debris add-on 1100

**Expected:** Option A $3,000; Option B $4,100; Option B services: remove, grind, haul.

### Deployed

| TD2 field | Value |
|---|---|
| Customer | Claire Hunt; 812-555-0220; claire.hunt@yahoo.com |
| Service address | 64 Forest Road, North Vernon, Indiana |
| Tree count/species | 4 trees; maple |
| Job description | Remove four maples. Options include haul away or stump grinding. |
| Option A | **$3,000**; drop and leave; drop and leave |
| Option B | **$1,100**; grind stumps haul debris -on; grind stumps haul debris -on |
| Ready | Yes |
| Blocking/needs more info | None |

### Shadow

| TD2 field | Value |
|---|---|
| Customer | Claire Hunt; 812-555-0220; claire.hunt@yahoo.com |
| Service address | 64 Forest Road |
| Tree count/species | 4 trees; maple |
| Job description | Remove four maples. |
| Option A | **$3,000**; drop and leave; drop and leave |
| Ready | No |
| Blocking/needs more info | Explicit source options are incomplete in TD2; missing or mismatched Option B $1,100. / SOURCE_OPTION_PRICE_CHANGED: Option B source says price is "$1,100", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "grind stump, haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_STUMP_TREATMENT_CHANGED: Option B source says stump treatment is "grind stump", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |

### Preview

| TD2 field | Value |
|---|---|
| Customer | Claire Hunt; 812-555-0220; claire.hunt@yahoo.com |
| Service address | 64 Forest Road |
| Tree count/species | 4 trees; maples |
| Job description | Remove four maples. |
| Option A | **$3,000**; drop and leave; drop and leave |
| Ready | No |
| Blocking/needs more info | Explicit source options are incomplete in TD2; missing or mismatched Option B $1,100. / SOURCE_OPTION_PRICE_CHANGED: Option B source says price is "$1,100", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_OPTION_ACTION_OMITTED: Option B source says work actions is "grind stump, haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_STUMP_TREATMENT_CHANGED: Option B source says stump treatment is "grind stump", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. / SOURCE_DEBRIS_DISPOSITION_CHANGED: Option B source says debris disposition is "haul debris", but final TD2 says "not found". Confirm or edit the final estimate so it preserves the source fact, or record an intentional verified override. |
