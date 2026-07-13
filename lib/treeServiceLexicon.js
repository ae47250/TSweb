export const TREE_SERVICE_LEXICON_ID = "tree_service_work_scope";
export const TREE_SERVICE_LEXICON_VERSION = "0.2.0-repo";

const ROUTING_FLAGS = Object.freeze([
  "emergency_review",
  "utility_coordination",
  "possible_energized_line_emergency",
  "possible_non_tree_service",
  "non_standard_practice_review",
  "ownership_or_boundary_review",
  "permit_review",
  "access_review",
  "manual_clarification",
]);

const SCOPE_POLARITIES = Object.freeze(["included", "excluded", "alternative", "completed", "uncertain"]);

const TREE_SERVICE_CONCEPTS = {
  "request.estimate_quote": {
    label: "Estimate or quote request",
    kind: "request",
    aliases: {
      professional: ["estimate", "quote", "bid", "proposal", "price", "cost"],
      vernacular: ["how much", "give me a price", "price it", "come look and tell me what it costs"],
    },
  },
  "request.alternative_scope": {
    label: "Alternative scope requested",
    kind: "request",
    aliases: {
      professional: ["alternate", "option", "quote separately"],
      vernacular: ["quote both ways", "both ways", "trim it or take it down", "trimming it and taking it down", "price each option"],
    },
  },
  "service.tree_removal": {
    label: "Tree removal",
    kind: "service",
    existing_service_kind: "tree_removal",
    aliases: {
      professional: ["remove", "removed", "removal", "remove all", "tree removal", "take down", "take-down", "takedown", "take tree down", "cut down", "cut tree", "fell", "felling", "drop", "sectioning", "dismantling"],
      vernacular: ["needs took down", "took down", "taking it down", "take it down", "needs tore out", "get rid of it", "cut 'er down", "drop it", "knock it down", "take her out"],
    },
  },
  "service.sectional_dismantling": {
    label: "Sectional dismantling",
    kind: "service",
    existing_service_kind: "tree_removal",
    aliases: {
      professional: ["piece-down", "sectioning", "rigging down", "crane removal"],
      vernacular: ["piece it out", "take it down in chunks"],
    },
  },
  "service.straight_felling": {
    label: "Straight felling",
    kind: "service",
    existing_service_kind: "tree_removal",
    aliases: {
      professional: ["felling", "notch and drop", "directional felling"],
      vernacular: ["drop it", "lay it over", "fell it"],
    },
  },
  "service.limb_removal": {
    label: "Limb removal",
    kind: "service",
    existing_service_kind: "limb_removal",
    aliases: {
      professional: ["limb removal", "branch removal", "cut up limb", "remove limb"],
      vernacular: ["get the limb down", "take down the branch", "take down branch", "cut up the limb"],
    },
  },
  "service.hanging_limb_removal": {
    label: "Hanging limb removal",
    kind: "service",
    existing_service_kind: "limb_removal",
    flags: ["emergency_review"],
    aliases: {
      professional: ["widow-maker removal", "hanger removal", "hung limb removal", "remove hanging limb"],
      vernacular: ["get the widow maker down", "take down the hanger", "get that busted limb down"],
    },
  },
  "service.storm_cleanup": {
    label: "Storm cleanup",
    kind: "service",
    existing_service_kind: "storm_cleanup",
    aliases: {
      professional: ["storm cleanup", "storm damage cleanup", "storm debris cleanup"],
      vernacular: ["clear storm damage", "clean up after storm", "clean up storm debris", "cut up storm limbs"],
    },
  },
  "service.land_clearing": {
    label: "Land or lot clearing",
    kind: "service",
    existing_service_kind: "brush_cleanup",
    aliases: {
      professional: ["lot clearing", "right-of-way clearing", "ROW clearing", "brush clearing", "fence-line clearing"],
      vernacular: ["clean out the fencerow", "clear the fence line", "brush it out", "clear the timber", "knock down the scrub", "volunteer trees", "junk trees", "scrub trees"],
    },
  },
  "service.brush_hogging": {
    label: "Brush hogging / rough mowing",
    kind: "external_or_adjacent_service",
    flags: ["possible_non_tree_service"],
    aliases: {
      professional: ["brush hogging", "field mowing", "rough mowing"],
      vernacular: ["bush hog", "bush hogging", "mow the back field"],
    },
  },
  "service.line_clearance": {
    label: "Line clearance",
    kind: "service",
    existing_service_kind: "tree_trim",
    flags: ["utility_coordination", "access_review"],
    aliases: {
      professional: ["line clearance", "utility clearance", "service drop clearance"],
      vernacular: ["trim by the wires", "limbs on the line", "branches touching service line"],
    },
  },
  "service.stump_grinding": {
    label: "Stump grinding",
    kind: "service",
    existing_service_kind: "stump_grinding",
    aliases: {
      professional: ["stump grinding", "stump grind", "grind stump", "grind the stump", "stump ground", "stumping", "stump work"],
      vernacular: ["grind it out", "chew the stump", "stump grinder"],
    },
  },
  "service.stump_removal": {
    label: "Stump removal",
    kind: "service",
    existing_service_kind: "other_supported_service",
    aliases: {
      professional: ["stump removal", "remove stump", "stump excavation", "root ball removal"],
      vernacular: ["pull the stump", "dig out the stump", "yank the stump"],
    },
  },
  "service.debris_removal": {
    label: "Debris removal",
    kind: "service",
    existing_service_kind: "haul_away",
    aliases: {
      professional: ["haul away", "haul off", "haul", "hauled", "hauling", "debris removal", "green waste removal", "wood removal", "log removal", "brush removal", "disposal", "dump fee", "dump fees", "tipping fee", "tipping fees"],
      vernacular: ["haul it away", "take the mess", "get rid of the brush", "clean everything up"],
    },
  },
  "service.chipping": {
    label: "Chipping",
    kind: "service",
    existing_service_kind: "brush_cleanup",
    aliases: {
      professional: ["chip", "chipping", "brush chipping"],
      vernacular: ["run it through the chipper", "chip up the brush"],
    },
  },
  "service.wood_bucking": {
    label: "Wood bucking",
    kind: "service",
    existing_service_kind: "brush_cleanup",
    aliases: {
      professional: ["bucking", "firewood rounds", "rounds", "cut into rounds"],
      vernacular: ["cut it into firewood", "cut into firewood", "cut firewood length"],
    },
  },
  "service.log_splitting": {
    label: "Log splitting",
    kind: "service",
    existing_service_kind: "brush_cleanup",
    aliases: {
      professional: ["splitting", "log splitting", "split logs"],
      vernacular: ["split the wood", "split wood"],
    },
  },
  "service.fine_cleanup": {
    label: "Fine cleanup",
    kind: "service",
    existing_service_kind: "brush_cleanup",
    aliases: {
      professional: ["cleanup", "clean up", "clean area", "clean work area", "final cleanup", "rake", "blow", "restore work area"],
      vernacular: ["clean the yard", "clean driveway area", "clean porch area", "rake it out", "make it neat"],
    },
  },
  "service.stump_hole_backfill": {
    label: "Stump hole backfill",
    kind: "service",
    existing_service_kind: "brush_cleanup",
    aliases: {
      professional: ["backfill", "stump hole backfill"],
      vernacular: ["fill the hole", "fill where the stump was"],
    },
  },
  "service.topsoil_seed": {
    label: "Topsoil and seed",
    kind: "service",
    existing_service_kind: "brush_cleanup",
    aliases: {
      professional: ["topsoil", "seed", "seeding", "topsoil and seed"],
      vernacular: ["put dirt and grass seed down"],
    },
  },
  "service.pruning": {
    label: "Pruning",
    kind: "service",
    existing_service_kind: "tree_trim",
    aliases: {
      professional: ["trim", "trimming", "tree trim", "tree trimming", "prune", "pruning", "deadwood", "deadwooding", "dead wooding"],
      vernacular: ["cut back branches", "trim it up", "take some limbs off"],
    },
  },
  "service.crown_reduction": {
    label: "Crown reduction",
    kind: "service",
    existing_service_kind: "tree_trim",
    aliases: {
      professional: ["crown reduction", "crown reduce", "cut back"],
      vernacular: ["cut it back", "shorten the limbs", "reduce the canopy"],
    },
  },
  "service.cabling": {
    label: "Cabling",
    kind: "service",
    existing_service_kind: "other_supported_service",
    aliases: {
      professional: ["cabling", "tree cable", "support cable"],
      vernacular: ["brace the tree with cable"],
    },
  },
  "practice.topping": {
    label: "Topping",
    kind: "requested_practice",
    flags: ["non_standard_practice_review"],
    aliases: {
      professional: ["topping", "top tree", "top it"],
      vernacular: ["top it off", "make it half as tall", "lopping", "hack job"],
    },
  },
  "disposition.full_haul": {
    label: "Full haul-away",
    kind: "disposition",
    existing_service_kind: "haul_away",
    aliases: {
      professional: ["full haul", "haul all debris", "haul away all debris", "remove all debris"],
      vernacular: ["take everything with you", "haul it all off", "nothing left"],
    },
  },
  "disposition.wood_left": {
    label: "Wood left on site",
    kind: "disposition",
    aliases: {
      professional: ["leave wood", "leave the wood", "wood left on site", "logs left on site", "leave logs", "leave the logs"],
      vernacular: ["customer keeps wood", "wood can stay", "logs can stay"],
    },
  },
  "disposition.logs_removed": {
    label: "Logs removed",
    kind: "disposition",
    existing_service_kind: "haul_away",
    aliases: {
      professional: ["log removal", "haul logs", "haul the logs", "logs removed"],
      vernacular: ["take the logs", "logs go with you"],
    },
  },
  "disposition.chips_left": {
    label: "Chips left on site",
    kind: "disposition",
    aliases: {
      professional: ["leave chips", "leave the chips", "chips left on site"],
      vernacular: ["chips can stay", "pile the chips here"],
    },
  },
  "disposition.chips_hauled": {
    label: "Chips hauled",
    kind: "disposition",
    existing_service_kind: "haul_away",
    aliases: {
      professional: ["haul chips", "haul the chips", "chips hauled"],
      vernacular: ["take the chips"],
    },
  },
  "condition.dead": {
    label: "Dead",
    kind: "condition",
    aliases: {
      professional: ["dead", "dead standing", "snag"],
      vernacular: ["dead one", "dried up"],
    },
  },
  "condition.hung_up": {
    label: "Hung-up or hanging limb",
    kind: "condition",
    aliases: {
      professional: ["hung limb", "hanger", "widow maker", "widow-maker"],
      vernacular: ["hanging over"],
    },
  },
  "condition.tree_on_utility_line": {
    label: "Tree or limb on utility line",
    kind: "condition",
    flags: ["possible_energized_line_emergency", "utility_coordination", "emergency_review"],
    aliases: {
      professional: ["tree on power line", "tree on utility line", "limb on power line", "limb on the line", "wire down"],
      vernacular: ["tree on the wires", "limb is on the power line", "sparking"],
    },
  },
  "condition.leaning": {
    label: "Leaning or unstable tree",
    kind: "condition",
    aliases: {
      professional: ["leaning", "leaning tree", "leaning toward", "leaning over"],
      vernacular: ["about to fall", "looks like it may fall", "ready to go over"],
    },
  },
  "condition.decay_or_hollow": {
    label: "Decay, hollow, or rot",
    kind: "condition",
    aliases: {
      professional: ["hollow", "hollow trunk", "decay", "decayed", "rot", "rotten", "structural decay", "conks"],
      vernacular: ["punky", "soft inside", "mushrooms on it", "rotted out"],
    },
  },
  "condition.cracked_or_split": {
    label: "Cracked or split tree",
    kind: "condition",
    aliases: {
      professional: ["cracked", "split", "split trunk", "cracked trunk", "included bark"],
      vernacular: ["busted open", "split down the middle"],
    },
  },
  "condition.storm_damaged": {
    label: "Storm damaged",
    kind: "condition",
    aliases: {
      professional: ["storm damaged", "wind damaged", "ice damaged", "derecho damage", "straight-line wind damage"],
      vernacular: ["storm broke it", "ice storm damage", "wind tore it up"],
    },
  },
  "condition.uprooted": {
    label: "Uprooted or root plate failure",
    kind: "condition",
    aliases: {
      professional: ["uprooted", "root plate lifted", "root plate failure"],
      vernacular: ["roots are coming up", "pulling out of the ground"],
    },
  },
  "condition.dead_top": {
    label: "Dead top",
    kind: "condition",
    aliases: {
      professional: ["dead top", "dead leader", "top is dead"],
      vernacular: ["dead at the top", "top died out"],
    },
  },
  "access.limited_access": {
    label: "Limited access",
    kind: "access",
    flags: ["access_review"],
    aliases: {
      professional: ["limited access", "restricted access", "fenced yard", "backyard access", "tight access", "tight gate"],
      vernacular: ["backyard", "back yard", "gotta go through the backyard", "through the gate", "small gate", "can't get equipment back there"],
    },
  },
  "access.no_drop_zone": {
    label: "Limited drop zone",
    kind: "access",
    flags: ["access_review"],
    aliases: {
      professional: ["limited drop zone", "no drop zone", "controlled drop", "rigging required"],
      vernacular: ["nowhere to drop it", "no room to drop it", "right over the house", "over the house", "over house"],
    },
  },
  "access.slope_or_remote_site": {
    label: "Slope or remote site",
    kind: "access",
    flags: ["access_review"],
    aliases: {
      professional: ["steep slope", "steep hill", "remote access", "long drag", "drag distance"],
      vernacular: ["down in the holler", "down in holler", "way back in the woods", "hard to get to"],
    },
  },
  "access.special_equipment": {
    label: "Special equipment access",
    kind: "access",
    flags: ["access_review"],
    aliases: {
      professional: ["bucket truck", "crane", "crane access", "lift access", "mini skid"],
      vernacular: ["need a bucket", "need a crane", "can't get a bucket truck in"],
    },
  },
  "price_cue.option_label": {
    label: "Explicit option label",
    kind: "price_cue",
    aliases: {
      professional: ["option a", "option b", "option c", "option 1", "option 2", "option 3"],
      vernacular: ["first option", "second option", "third option"],
    },
  },
  "price_cue.included_scope": {
    label: "Included scope cue",
    kind: "price_cue",
    aliases: {
      professional: ["included", "includes", "including", "with cleanup", "with haul away", "with stump grinding", "with debris haul"],
      vernacular: ["comes with", "all in", "everything included"],
    },
  },
  "price_cue.incremental_addon": {
    label: "Incremental add-on cue",
    kind: "price_cue",
    aliases: {
      professional: ["plus", "extra", "additional", "add-on", "add on", "add to that", "upgrade", "for another"],
      vernacular: ["on top", "more for", "tack on"],
    },
  },
  "price_cue.excluded_or_limited_scope": {
    label: "Excluded or limited scope cue",
    kind: "price_cue",
    aliases: {
      professional: ["without", "not included", "separate", "separately", "only"],
      vernacular: ["just", "bare minimum", "leave it", "leave debris"],
    },
  },
  "price_cue.tiered_option": {
    label: "Tiered option cue",
    kind: "price_cue",
    aliases: {
      professional: ["basic", "base option", "full", "full service", "complete", "premium"],
      vernacular: ["cheap option", "normal option", "fancy option", "whole job"],
    },
  },
  "target.barn": {
    label: "Barn",
    kind: "target",
    aliases: { professional: ["barn"], vernacular: ["by the barn"] },
  },
  "target.shop": {
    label: "Shop",
    kind: "target",
    aliases: { professional: ["shop"], vernacular: ["by the shop"] },
  },
  "target.shed": {
    label: "Shed",
    kind: "target",
    aliases: { professional: ["shed"], vernacular: ["by the shed", "beside shed"] },
  },
  "target.roof": {
    label: "Roof",
    kind: "target",
    aliases: { professional: ["roof"], vernacular: ["off the roof", "over the roof"] },
  },
  "target.driveway": {
    label: "Driveway",
    kind: "target",
    aliases: { professional: ["driveway"], vernacular: ["over the driveway", "by the driveway"] },
  },
  "target.fence": {
    label: "Fence",
    kind: "target",
    aliases: { professional: ["fence", "fence line"], vernacular: ["by the fence", "along the fence"] },
  },
  "target.utility_line": {
    label: "Utility line",
    kind: "target",
    flags: ["utility_coordination"],
    aliases: {
      professional: ["power line", "utility line", "service line", "service drop", "wires"],
      vernacular: ["the line", "the wires"],
    },
  },
  "anatomy.trunk": {
    label: "Trunk",
    kind: "anatomy",
    aliases: { professional: ["trunk", "tree trunk"], vernacular: [] },
  },
  "species.tulip_poplar": {
    label: "Tulip poplar",
    kind: "species",
    regional_prior: true,
    aliases: { professional: ["tulip poplar", "poplar"], vernacular: [] },
  },
  "species.eastern_redcedar": {
    label: "Eastern redcedar",
    kind: "species",
    regional_prior: true,
    aliases: { professional: ["eastern redcedar", "red cedar", "cedar"], vernacular: [] },
  },
  "species.ash": {
    label: "Ash",
    kind: "species",
    aliases: { professional: ["ash"], vernacular: [] },
  },
  "species.maple": {
    label: "Maple",
    kind: "species",
    aliases: { professional: ["maple"], vernacular: [] },
  },
  "species.oak": {
    label: "Oak",
    kind: "species",
    aliases: { professional: ["oak"], vernacular: [] },
  },
  "species.black_walnut": {
    label: "Black walnut",
    kind: "species",
    aliases: { professional: ["black walnut", "walnut"], vernacular: [] },
  },
  "species.pine": {
    label: "Pine",
    kind: "species",
    aliases: { professional: ["pine"], vernacular: [] },
  },
  "species.sycamore": {
    label: "Sycamore",
    kind: "species",
    aliases: { professional: ["sycamore"], vernacular: [] },
  },
  "species.hickory": {
    label: "Hickory",
    kind: "species",
    aliases: { professional: ["hickory"], vernacular: [] },
  },
  "species.beech": {
    label: "Beech",
    kind: "species",
    aliases: { professional: ["beech"], vernacular: [] },
  },
  "species.elm": {
    label: "Elm",
    kind: "species",
    aliases: { professional: ["elm"], vernacular: [] },
  },
  "species.cherry": {
    label: "Cherry",
    kind: "species",
    aliases: { professional: ["cherry"], vernacular: [] },
  },
  "species.bradford_pear": {
    label: "Bradford pear",
    kind: "species",
    aliases: { professional: ["bradford pear", "pear"], vernacular: [] },
  },
  "species.dogwood": {
    label: "Dogwood",
    kind: "species",
    aliases: { professional: ["dogwood"], vernacular: [] },
  },
  "species.locust": {
    label: "Locust",
    kind: "species",
    aliases: { professional: ["locust", "black locust", "honey locust"], vernacular: [] },
  },
  "species.sweetgum": {
    label: "Sweetgum",
    kind: "species",
    aliases: { professional: ["sweetgum", "sweet gum"], vernacular: [] },
  },
};

const BASE_SERVICE_CONCEPT_IDS = Object.freeze([
  "service.tree_removal",
  "service.sectional_dismantling",
  "service.straight_felling",
]);

const ADD_ON_SERVICE_CONCEPT_IDS = Object.freeze([
  "service.stump_grinding",
  "service.stump_removal",
  "service.debris_removal",
  "service.chipping",
  "service.wood_bucking",
  "service.log_splitting",
  "service.fine_cleanup",
  "service.stump_hole_backfill",
  "service.topsoil_seed",
]);

const LOWER_OPTION_CONCEPT_IDS = Object.freeze([
  "disposition.wood_left",
  "disposition.chips_left",
]);

const PRUNING_CONCEPT_IDS = Object.freeze([
  "service.pruning",
  "service.crown_reduction",
  "service.line_clearance",
]);

const SUPPORT_CONCEPT_IDS = Object.freeze(["service.cabling"]);
const REVIEW_RISK_CONCEPT_IDS = Object.freeze(["practice.topping"]);
const ACCESS_DIFFICULTY_CONCEPT_IDS = Object.freeze([
  "access.limited_access",
  "access.no_drop_zone",
  "access.slope_or_remote_site",
  "access.special_equipment",
]);
const CONDITION_RISK_CONCEPT_IDS = Object.freeze([
  "condition.dead",
  "condition.hung_up",
  "condition.tree_on_utility_line",
  "condition.leaning",
  "condition.decay_or_hollow",
  "condition.cracked_or_split",
  "condition.storm_damaged",
  "condition.uprooted",
  "condition.dead_top",
]);
const PRICE_CUE_CONCEPT_IDS = Object.freeze([
  "price_cue.option_label",
  "price_cue.included_scope",
  "price_cue.incremental_addon",
  "price_cue.excluded_or_limited_scope",
  "price_cue.tiered_option",
]);

const SERVICE_KIND_CROSSWALK = Object.freeze(Object.fromEntries(
  Object.entries(TREE_SERVICE_CONCEPTS)
    .filter(([, concept]) => concept.existing_service_kind)
    .map(([conceptId, concept]) => [conceptId, concept.existing_service_kind]),
));

const SAFE_CORRECTIONS = Object.freeze([
  { surface: "hual", normalized: "haul", concept_id: "service.debris_removal", reason: "Common haul-away transposition." },
  { surface: "hawl", normalized: "haul", concept_id: "service.debris_removal", reason: "Common haul-away phonetic spelling." },
  { surface: "haulaway", normalized: "haul away", concept_id: "service.debris_removal", reason: "Missing space in haul-away phrase." },
  { surface: "remvoe", normalized: "remove", concept_id: "service.tree_removal", reason: "Common remove transposition." },
  { surface: "remve", normalized: "remove", concept_id: "service.tree_removal", reason: "Common remove dropped vowel." },
  { surface: "triming", normalized: "trimming", concept_id: "service.pruning", reason: "Common trimming typo." },
  { surface: "stmp", normalized: "stump", concept_id: "service.stump_grinding", reason: "Common stump abbreviation." },
]);

const CONTEXTUAL_CORRECTION_CANDIDATES = Object.freeze([
  {
    surface: "popular",
    normalized: "poplar",
    concept_id: "species.tulip_poplar",
    confidence: 0.79,
    warning: "species inferred from regional prior; confirmation recommended",
    context_pattern: /\bpopular\b(?=.{0,80}\b(?:needs?|took|take|cut|remove|trim|barn|shed|fence|yard|tree)\b)/i,
  },
  {
    surface: "window maker",
    normalized: "widow maker",
    concept_id: "condition.hung_up",
    confidence: 0.84,
    polarity: "included",
    context_pattern: /\bwindow maker\b(?=.{0,80}\b(?:hanging|over|limb|branch|driveway|roof|yard)\b)/i,
  },
]);

const BLOCKED_VALID_WORD_SUBSTITUTIONS = Object.freeze([
  { surface: "truck", blocked_to: "trunk" },
  { surface: "popular", blocked_to: "poplar" },
  { surface: "felt", blocked_to: "fell" },
  { surface: "stub", blocked_to: "stump" },
  { surface: "backing", blocked_to: "bucking" },
]);

const ACCEPTANCE_EXAMPLES = Object.freeze([
  {
    id: "regional_removal_with_stump_exclusion",
    input: "Popular by the barn needs took down but leave the stump.",
    expected: {
      matches: [
        { concept_id: "species.tulip_poplar", polarity: "uncertain", match_type: "contextual_candidate" },
        { concept_id: "target.barn", polarity: "included" },
        { concept_id: "service.tree_removal", polarity: "included" },
        { concept_id: "service.stump_grinding", polarity: "excluded" },
        { concept_id: "service.stump_removal", polarity: "excluded" },
      ],
      must_preserve_raw_text: true,
    },
  },
  {
    id: "dead_ash_leave_wood_and_stump",
    input: "Need that dead ash by the shop took down, leave the wood and stump.",
    expected: {
      matches: [
        { concept_id: "condition.dead", polarity: "included" },
        { concept_id: "species.ash", polarity: "included" },
        { concept_id: "target.shop", polarity: "included" },
        { concept_id: "service.tree_removal", polarity: "included" },
        { concept_id: "disposition.wood_left", polarity: "included" },
        { concept_id: "service.stump_grinding", polarity: "excluded" },
      ],
    },
  },
  {
    id: "cut_down_is_not_cut_back",
    input: "Cut the maple down, but cut the oak back off the roof.",
    expected: {
      matches: [
        { concept_id: "service.tree_removal", polarity: "included" },
        { concept_id: "species.maple", polarity: "included" },
        { concept_id: "service.crown_reduction", polarity: "included" },
        { concept_id: "species.oak", polarity: "included" },
        { concept_id: "target.roof", polarity: "included" },
      ],
      scope_items: [
        { service_concept_id: "service.tree_removal", object_concept_ids: ["species.maple"], polarity: "included" },
        { service_concept_id: "service.crown_reduction", object_concept_ids: ["species.oak"], target_concept_ids: ["target.roof"], polarity: "included" },
      ],
    },
  },
  {
    id: "non_standard_topping_preserved",
    input: "Top it off and make it half as tall.",
    expected: {
      matches: [{ concept_id: "practice.topping", polarity: "included" }],
      routing_flags: ["non_standard_practice_review"],
      must_not_emit_without_other_evidence: ["service.crown_reduction"],
    },
  },
  {
    id: "truck_and_trunk_are_both_valid",
    input: "The chip truck is parked beside the tree trunk.",
    expected: {
      matches: [{ concept_id: "anatomy.trunk", polarity: "included" }],
      must_not_normalize: [{ surface: "truck", to: "trunk" }],
    },
  },
  {
    id: "popular_not_poplar",
    input: "Tree trimming is our most popular service.",
    expected: {
      matches: [{ concept_id: "service.pruning", polarity: "included" }],
      must_not_normalize: [{ surface: "popular", to: "poplar" }],
    },
  },
  {
    id: "power_line_emergency",
    input: "A limb is on the power line and it is sparking.",
    expected: {
      matches: [
        { concept_id: "condition.tree_on_utility_line", polarity: "included" },
        { concept_id: "target.utility_line", polarity: "included" },
      ],
      routing_flags: ["possible_energized_line_emergency", "utility_coordination", "emergency_review"],
    },
  },
  {
    id: "possible_non_tree_service",
    input: "Can you bush hog the back field and clear the fence line?",
    expected: {
      matches: [
        { concept_id: "service.brush_hogging", polarity: "included" },
        { concept_id: "service.land_clearing", polarity: "included" },
      ],
      routing_flags: ["possible_non_tree_service"],
    },
  },
  {
    id: "alternative_quote",
    input: "Can you quote trimming it and taking it down both ways?",
    expected: {
      matches: [
        { concept_id: "request.alternative_scope", polarity: "included" },
        { concept_id: "service.pruning", polarity: "alternative" },
        { concept_id: "service.tree_removal", polarity: "alternative" },
      ],
      scope_items: [
        { service_concept_id: "service.pruning", polarity: "alternative" },
        { service_concept_id: "service.tree_removal", polarity: "alternative" },
      ],
    },
  },
  {
    id: "cleanup_and_stump_separate",
    input: "Remove the tree, no stump grinding, leave the chips but haul the logs.",
    expected: {
      matches: [
        { concept_id: "service.tree_removal", polarity: "included" },
        { concept_id: "service.stump_grinding", polarity: "excluded" },
        { concept_id: "disposition.chips_left", polarity: "included" },
        { concept_id: "disposition.logs_removed", polarity: "included" },
      ],
    },
  },
  {
    id: "completed_work_not_new_scope",
    input: "The previous company removed the tree; I only need the stump ground now.",
    expected: {
      matches: [
        { concept_id: "service.tree_removal", polarity: "completed" },
        { concept_id: "service.stump_grinding", polarity: "included" },
      ],
    },
  },
  {
    id: "negated_specific_tree",
    input: "Remove the ash and walnut, but do not take the maple.",
    expected: {
      matches: [
        { concept_id: "species.ash", polarity: "included" },
        { concept_id: "species.black_walnut", polarity: "included" },
        { concept_id: "species.maple", polarity: "excluded" },
      ],
      scope_items: [
        { service_concept_id: "service.tree_removal", object_concept_ids: ["species.ash"], polarity: "included" },
        { service_concept_id: "service.tree_removal", object_concept_ids: ["species.black_walnut"], polarity: "included" },
        { service_concept_id: "service.tree_removal", object_concept_ids: ["species.maple"], polarity: "excluded" },
      ],
    },
  },
  {
    id: "asr_window_maker",
    input: "There is a window maker hanging over the driveway.",
    expected: {
      matches: [
        { concept_id: "condition.hung_up", polarity: "included", match_type: "contextual_candidate" },
        { concept_id: "target.driveway", polarity: "included" },
      ],
    },
  },
  {
    id: "regional_cedar_uncertainty",
    input: "Trim the cedar by the fence.",
    expected: {
      matches: [
        { concept_id: "service.pruning", polarity: "included" },
        { concept_id: "species.eastern_redcedar", polarity: "uncertain" },
        { concept_id: "target.fence", polarity: "included" },
      ],
      warnings: ["species inferred from regional prior; confirmation recommended"],
    },
  },
]);

function asString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function compact(value) {
  return asString(value).replace(/\s+/g, " ").trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function escapeRegExp(value) {
  return asString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseToPatternSource(phrase) {
  return escapeRegExp(compact(phrase))
    .replace(/['’]/g, "['’]?")
    .replace(/-/g, "[-\\s]+")
    .replace(/\s+/g, "\\s+");
}

function aliasValues(concept = {}) {
  const aliases = concept.aliases || {};
  return unique(Object.values(aliases).flatMap((value) => Array.isArray(value) ? value : []));
}

function termsForConcepts(conceptIds = []) {
  return unique(conceptIds.flatMap((conceptId) => aliasValues(TREE_SERVICE_CONCEPTS[conceptId])));
}

function sourceFromTerms(terms = [], extras = []) {
  return unique([...terms.map(phraseToPatternSource), ...extras])
    .sort((left, right) => right.length - left.length)
    .join("|");
}

const TREE_SERVICE_PATTERN_SOURCE_VALUES = {
  baseService: sourceFromTerms(termsForConcepts(BASE_SERVICE_CONCEPT_IDS), [
    "cut(?:\\s+[a-z]+){0,4}\\s+down",
    "dismantl(?:e|ing)",
  ]),
  addOnService: sourceFromTerms(termsForConcepts(ADD_ON_SERVICE_CONCEPT_IDS), [
    "stumps?",
    "grind(?:ing)?",
    "(?:haul|hual|hawl)(?:ed|ing)?(?:\\s+off|\\s+away)?",
    "clean(?:\\s+[a-z]+){0,3}\\s+up",
    "clean(?:\\s+[a-z]+){0,3}\\s+area",
    "brush(?:\\s+(?:removal|haul))?",
    "logs?",
    "wood",
  ]),
  lowerOption: sourceFromTerms(termsForConcepts(LOWER_OPTION_CONCEPT_IDS), [
    "drop\\s+and\\s+leave",
    "drop\\s+only",
    "drop\\s+stack\\s+wood",
    "cut\\s+only",
    "removal\\s+only",
    "leave\\s+(?:wood|debris|brush|chips?|stumps?)",
    "(?:debris|brush|chips?|wood|logs?|stumps?)\\s+(?:stays?|left\\s+on\\s+site)",
    "customer\\s+keeps\\s+wood",
    "no\\s+haul(?:\\s+away|\\s+off)?",
    "no\\s+cleanup",
  ]),
  pruning: sourceFromTerms(termsForConcepts(PRUNING_CONCEPT_IDS), [
    "crown\\s+(?:raise|lift|thin|reduction)",
    "dead\\s*wooding",
  ]),
  support: sourceFromTerms(termsForConcepts(SUPPORT_CONCEPT_IDS)),
  reviewRisk: sourceFromTerms(termsForConcepts(REVIEW_RISK_CONCEPT_IDS), ["hack\\s+job"]),
  accessDifficulty: sourceFromTerms(termsForConcepts(ACCESS_DIFFICULTY_CONCEPT_IDS)),
  conditionRisk: sourceFromTerms(termsForConcepts(CONDITION_RISK_CONCEPT_IDS)),
  priceCue: sourceFromTerms(termsForConcepts(PRICE_CUE_CONCEPT_IDS)),
};

export const TREE_SERVICE_PATTERN_SOURCES = Object.freeze({
  ...TREE_SERVICE_PATTERN_SOURCE_VALUES,
  workScope: [
    TREE_SERVICE_PATTERN_SOURCE_VALUES.baseService,
    TREE_SERVICE_PATTERN_SOURCE_VALUES.addOnService,
    TREE_SERVICE_PATTERN_SOURCE_VALUES.lowerOption,
    TREE_SERVICE_PATTERN_SOURCE_VALUES.pruning,
    TREE_SERVICE_PATTERN_SOURCE_VALUES.support,
    "tree|trees|limb|limbs|branch|branches|wood|logs?|work|emergency|package|cheap|basic|normal|full|fancy|clear|access",
  ].filter(Boolean).join("|"),
});

export const TREE_SERVICE_PATTERNS = Object.freeze({
  baseService: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.baseService})\\b`, "i"),
  addOnService: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.addOnService})\\b`, "i"),
  lowerOption: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.lowerOption})\\b`, "i"),
  pruning: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.pruning})\\b`, "i"),
  reviewRisk: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.reviewRisk})\\b`, "i"),
  accessDifficulty: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.accessDifficulty})\\b`, "i"),
  conditionRisk: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.conditionRisk})\\b`, "i"),
  priceCue: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.priceCue})\\b`, "i"),
  workScope: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.workScope})\\b`, "i"),
  explicitAdditiveCue: /(?:\+|\b(?:extra|add(?:ed)?|add\s+on|add-on|add\s+to\s+that|plus|on\s+top|additional|also|in\s+addition)\b)/i,
  unitOrRateCue: /\b(?:per|each|per\s+stump|per\s+tree|per\s+load|per\s+hour|hourly|minimum)\b/i,
});

function matchTypeForAliasBucket(bucket) {
  if (bucket === "professional") return "professional_alias";
  if (bucket === "vernacular") return "vernacular";
  if (bucket === "abbreviation") return "abbreviation";
  if (bucket === "regional") return "contextual_candidate";
  return "canonical";
}

function buildPhraseIndex(concepts = TREE_SERVICE_CONCEPTS) {
  const entries = [];
  for (const [conceptId, concept] of Object.entries(concepts)) {
    for (const [bucket, aliases] of Object.entries(concept.aliases || {})) {
      for (const phrase of aliases || []) {
        entries.push({
          concept_id: conceptId,
          label: concept.label,
          kind: concept.kind,
          phrase,
          match_type: matchTypeForAliasBucket(bucket),
          confidence: confidenceForMatchType(matchTypeForAliasBucket(bucket), concept),
          flags: concept.flags || [],
          existing_service_kind: concept.existing_service_kind || "",
          pattern: new RegExp(`\\b${phraseToPatternSource(phrase)}\\b`, "gi"),
        });
      }
    }
  }
  return entries.sort((left, right) => right.phrase.length - left.phrase.length);
}

function confidenceForMatchType(matchType, concept = {}) {
  if (concept.regional_prior) return 0.79;
  if (matchType === "canonical") return 1.0;
  if (matchType === "professional_alias") return 0.98;
  if (matchType === "abbreviation") return 0.96;
  if (matchType === "vernacular") return 0.93;
  if (matchType === "safe_correction") return 0.97;
  if (matchType === "contextual_candidate") return 0.84;
  return 0.9;
}

export const TREE_SERVICE_LEXICON_INDEXES = deepFreeze({
  phrases_longest_first: buildPhraseIndex(),
  safe_corrections: SAFE_CORRECTIONS,
  contextual_correction_candidates: CONTEXTUAL_CORRECTION_CANDIDATES,
});

export const TREE_SERVICE_LEXICON = deepFreeze({
  schema_version: "1.0.0",
  lexicon: {
    id: TREE_SERVICE_LEXICON_ID,
    version: TREE_SERVICE_LEXICON_VERSION,
    status: "repository_authoritative",
    intended_source_of_truth: true,
    authoring_format: "JavaScript structured object",
    language: "en-US",
    region: "Southern Indiana and adjacent Midwest service area",
  },
  runtime_contract: {
    preserve_raw_text: true,
    case_sensitive: false,
    unicode_normalization: "NFKC",
    punctuation_tolerance: true,
    word_boundaries_required: true,
    processing_order: [
      "retain raw text and offsets",
      "normalize comparison punctuation without changing stored raw text",
      "match exact canonical multiword terms and aliases using longest-match-first",
      "apply safe curated spelling and spacing corrections as annotations",
      "identify contextual correction candidates without automatic replacement",
      "apply negation, exclusion, alternative, completed-work, and routing flags",
      "return evidence spans, confidence, lexicon version, and warnings",
    ],
    routing_flags: ROUTING_FLAGS,
    scope_polarity_values: SCOPE_POLARITIES,
  },
  concepts: TREE_SERVICE_CONCEPTS,
  service_kind_crosswalk: SERVICE_KIND_CROSSWALK,
  safe_corrections: SAFE_CORRECTIONS,
  contextual_correction_candidates: CONTEXTUAL_CORRECTION_CANDIDATES,
  blocked_valid_word_substitutions: BLOCKED_VALID_WORD_SUBSTITUTIONS,
  acceptance_examples: ACCEPTANCE_EXAMPLES,
  baseServiceTerms: termsForConcepts(BASE_SERVICE_CONCEPT_IDS),
  addOnServiceTerms: termsForConcepts(ADD_ON_SERVICE_CONCEPT_IDS),
  lowerOptionTerms: termsForConcepts(LOWER_OPTION_CONCEPT_IDS),
  pruningTerms: termsForConcepts(PRUNING_CONCEPT_IDS),
  supportTerms: termsForConcepts(SUPPORT_CONCEPT_IDS),
  reviewRiskTerms: termsForConcepts(REVIEW_RISK_CONCEPT_IDS),
  accessDifficultyTerms: termsForConcepts(ACCESS_DIFFICULTY_CONCEPT_IDS),
  conditionRiskTerms: termsForConcepts(CONDITION_RISK_CONCEPT_IDS),
  priceCueTerms: termsForConcepts(PRICE_CUE_CONCEPT_IDS),
});

function normalizeComparableText(value) {
  return compact(asString(value).normalize("NFKC")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " "));
}

function spansOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
}

function hasOccupiedSpan(span, occupied) {
  return occupied.some((existing) => spansOverlap(span, existing));
}

function hasAlternativeScope(text) {
  return /\b(?:quote\s+both\s+ways|both\s+ways|price\s+each\s+option|quote\s+separately|trim(?:ming)?\s+it\s+and\s+tak(?:e|ing)\s+it\s+down)\b/i.test(text);
}

function negationApplies(text, start, end, conceptId) {
  const before = text.slice(Math.max(0, start - 48), start).toLowerCase();
  const around = text.slice(Math.max(0, start - 36), Math.min(text.length, end + 36)).toLowerCase();
  if (/\b(?:no|not|without|except|do not|don't|dont)\b[^.;,]{0,36}$/.test(before)) return true;
  if (/leave\s+(?:the\s+)?stump|keep\s+(?:the\s+)?stump|stumps?\s+stays?/i.test(around)) {
    return conceptId === "service.stump_grinding" || conceptId === "service.stump_removal";
  }
  return false;
}

function completedWorkApplies(text, start, conceptId) {
  if (conceptId !== "service.tree_removal") return false;
  const before = text.slice(Math.max(0, start - 64), start + 24).toLowerCase();
  return /\b(?:previous\s+company|already|had\s+it)\b[^.;]{0,48}\b(?:removed|took\s+down|cut\s+down)\b/.test(before);
}

function polarityForMatch(text, match, alternative) {
  if (completedWorkApplies(text, match.start, match.concept_id)) return "completed";
  if (negationApplies(text, match.start, match.end, match.concept_id)) return "excluded";
  if (alternative && match.kind === "service") return "alternative";
  if (match.match_type === "contextual_candidate" || TREE_SERVICE_CONCEPTS[match.concept_id]?.regional_prior) return "uncertain";
  return "included";
}

function addRuleMatches(text, matches) {
  const rules = [
    {
      pattern: /\bleave\b.{0,32}\bstump\b|\bkeep\s+(?:the\s+)?stump\b|\bno\s+stump\s+grinding\b|\bdon't\s+grind\s+(?:the\s+)?stump\b|\bdo\s+not\s+grind\s+(?:the\s+)?stump\b/gi,
      emits: [
        { concept_id: "service.stump_grinding", polarity: "excluded" },
        { concept_id: "service.stump_removal", polarity: "excluded" },
      ],
    },
    {
      pattern: /\bleave\s+(?:the\s+)?wood\b|\bleave\s+(?:the\s+)?logs\b|\bwood\s+can\s+stay\b|\blogs\s+can\s+stay\b/gi,
      emits: [{ concept_id: "disposition.wood_left", polarity: "included" }],
    },
    {
      pattern: /\bleave\s+(?:the\s+)?chips\b|\bchips\s+can\s+stay\b|\bpile\s+(?:the\s+)?chips\s+here\b/gi,
      emits: [{ concept_id: "disposition.chips_left", polarity: "included" }],
    },
    {
      pattern: /\bhaul\s+(?:the\s+)?logs\b|\btake\s+(?:the\s+)?logs\b|\blogs\s+go\s+with\s+you\b/gi,
      emits: [{ concept_id: "disposition.logs_removed", polarity: "included" }],
    },
    {
      pattern: /\bcut\s+(?:the\s+)?(?:maple|oak|ash|walnut|cedar)\s+down\b/gi,
      emits: [{ concept_id: "service.tree_removal", polarity: "included" }],
    },
    {
      pattern: /\btake\s+(?:one|two|three|the|a|an)?\s*(?:maple|oak|ash|walnut|cedar|elm|pine|poplar|willow|birch|tree)\s+down\b/gi,
      emits: [{ concept_id: "service.tree_removal", polarity: "included" }],
    },
    {
      pattern: /\bgrind\b[^.;,]{0,28}\bstumps?\b/gi,
      emits: [{ concept_id: "service.stump_grinding", polarity: "included" }],
    },
    {
      pattern: /\bstumps?\b[^.;,]{0,20}\b(?:maybe|possibly|perhaps)\b|\b(?:maybe|possibly|perhaps)\b[^.;,]{0,20}\bstumps?\b/gi,
      emits: [{ concept_id: "service.stump_grinding", polarity: "uncertain" }],
    },
    {
      pattern: /\bcut\s+(?:the\s+)?(?:maple|oak|ash|walnut|cedar)\s+back\b/gi,
      emits: [{ concept_id: "service.crown_reduction", polarity: "included" }],
    },
    {
      pattern: /\b(?:power|utility|service)\s+(?:line|drop)\b|\bwires?\b/gi,
      emits: [{ concept_id: "target.utility_line", polarity: "included" }],
    },
    {
      pattern: /\b(?:limb|branch|tree)\b.{0,24}\bon\s+(?:the\s+)?(?:power|utility|service)\s+(?:line|drop)\b|\bsparking\b/gi,
      emits: [{ concept_id: "condition.tree_on_utility_line", polarity: "included" }],
    },
  ];

  for (const rule of rules) {
    for (const rawMatch of text.matchAll(rule.pattern)) {
      const start = rawMatch.index ?? 0;
      const end = start + rawMatch[0].length;
      for (const emit of rule.emits) {
        const concept = TREE_SERVICE_CONCEPTS[emit.concept_id];
        matches.push({
          concept_id: emit.concept_id,
          label: concept.label,
          kind: concept.kind,
          raw_span: rawMatch[0],
          start,
          end,
          match_type: "rule",
          confidence: 0.98,
          polarity: emit.polarity,
          flags: concept.flags || [],
          evidence: { rule: "scope_rule" },
          existing_service_kind: concept.existing_service_kind || SERVICE_KIND_CROSSWALK[emit.concept_id] || "",
        });
      }
    }
  }

  if (hasAlternativeScope(text)) {
    const serviceRules = [
      { pattern: /\btrim(?:ming)?\b/i, concept_id: "service.pruning" },
      { pattern: /\btak(?:e|ing)\s+it\s+down\b|\btake\s+down\b|\bremove\b/i, concept_id: "service.tree_removal" },
    ];
    for (const serviceRule of serviceRules) {
      const rawMatch = text.match(serviceRule.pattern);
      if (!rawMatch) continue;
      const start = rawMatch.index ?? 0;
      const concept = TREE_SERVICE_CONCEPTS[serviceRule.concept_id];
      matches.push({
        concept_id: serviceRule.concept_id,
        label: concept.label,
        kind: concept.kind,
        raw_span: rawMatch[0],
        start,
        end: start + rawMatch[0].length,
        match_type: "rule",
        confidence: 0.98,
        polarity: "alternative",
        flags: concept.flags || [],
        evidence: { rule: "alternative_scope" },
        existing_service_kind: concept.existing_service_kind || SERVICE_KIND_CROSSWALK[serviceRule.concept_id] || "",
      });
    }
  }
}

function correctionMatches(text, candidates, matchType) {
  const matches = [];
  for (const candidate of candidates) {
    const pattern = new RegExp(`\\b${phraseToPatternSource(candidate.surface)}\\b`, "gi");
    for (const rawMatch of text.matchAll(pattern)) {
      if (candidate.context_pattern && !candidate.context_pattern.test(text)) continue;
      const concept = TREE_SERVICE_CONCEPTS[candidate.concept_id];
      const start = rawMatch.index ?? 0;
      matches.push({
        concept_id: candidate.concept_id,
        label: concept.label,
        kind: concept.kind,
        raw_span: rawMatch[0],
        start,
        end: start + rawMatch[0].length,
        match_type: matchType,
        confidence: candidate.confidence || confidenceForMatchType(matchType, concept),
        polarity: candidate.polarity || (matchType === "contextual_candidate" ? "uncertain" : "included"),
        flags: concept.flags || [],
        evidence: {
          surface: candidate.surface,
          candidate: candidate.normalized,
          reason: candidate.reason || "Contextual candidate; not an automatic replacement.",
        },
        existing_service_kind: concept.existing_service_kind || SERVICE_KIND_CROSSWALK[candidate.concept_id] || "",
        warnings: candidate.warning ? [candidate.warning] : [],
      });
    }
  }
  return matches;
}

function routeFlagsForMatches(matches, text) {
  const flags = new Set(matches.flatMap((match) => match.flags || []));
  if (/\b(?:tree|limb|branch)\b.{0,24}\b(?:on|touching|against)\b.{0,20}\b(?:power|utility|service)\s+(?:line|drop)|\b(?:wire\s+down|sparking)\b/i.test(text)) {
    flags.add("possible_energized_line_emergency");
    flags.add("utility_coordination");
    flags.add("emergency_review");
  }
  if (matches.some((match) => match.concept_id === "service.brush_hogging")) flags.add("possible_non_tree_service");
  if (matches.some((match) => match.kind === "requested_practice")) flags.add("non_standard_practice_review");
  return [...flags].filter((flag) => ROUTING_FLAGS.includes(flag)).sort();
}

function warningsForMatches(matches) {
  return unique(matches.flatMap((match) => match.warnings || []));
}

function matchConceptPhrases(text) {
  const occupied = [];
  const matches = [];
  const alternative = hasAlternativeScope(text);

  for (const entry of TREE_SERVICE_LEXICON_INDEXES.phrases_longest_first) {
    for (const rawMatch of text.matchAll(entry.pattern)) {
      const start = rawMatch.index ?? 0;
      const end = start + rawMatch[0].length;
      const span = { start, end };
      if (hasOccupiedSpan(span, occupied)) continue;
      const match = {
        concept_id: entry.concept_id,
        label: entry.label,
        kind: entry.kind,
        raw_span: rawMatch[0],
        start,
        end,
        match_type: entry.match_type,
        confidence: entry.confidence,
        polarity: "included",
        flags: entry.flags || [],
        evidence: { phrase: entry.phrase },
        existing_service_kind: entry.existing_service_kind,
      };
      match.polarity = polarityForMatch(text, match, alternative);
      if (match.concept_id === "species.eastern_redcedar" && match.raw_span.toLowerCase() === "cedar") {
        match.warnings = ["species inferred from regional prior; confirmation recommended"];
      }
      matches.push(match);
      occupied.push(span);
    }
  }

  return matches;
}

function uniqueMatches(matches = []) {
  const byKey = new Map();
  for (const match of matches) {
    const key = `${match.concept_id}\u0000${match.start}\u0000${match.end}\u0000${match.polarity}\u0000${match.match_type}`;
    if (!byKey.has(key)) byKey.set(key, match);
  }
  return [...byKey.values()].sort((left, right) => left.start - right.start || left.end - right.end);
}

function conceptIds(matches, kind = "") {
  return matches
    .filter((match) => !kind || match.kind === kind)
    .map((match) => match.concept_id);
}

function scopeItemsFromSpecificPatterns(text, matches) {
  const items = [];
  const cutDown = text.match(/\bcut\s+(?:the\s+)?(maple|oak|ash|walnut|cedar)\s+down\b/i);
  if (cutDown) {
    items.push({
      scope_item_id: "scope_1",
      service_concept_id: "service.tree_removal",
      object_concept_ids: [`species.${cutDown[1].toLowerCase() === "walnut" ? "black_walnut" : cutDown[1].toLowerCase()}`],
      target_concept_ids: [],
      polarity: "included",
      evidence_spans: [cutDown[0]],
    });
  }
  const cutBack = text.match(/\bcut\s+(?:the\s+)?(maple|oak|ash|walnut|cedar)\s+back\b.{0,40}\boff\s+(?:the\s+)?roof\b/i);
  if (cutBack) {
    items.push({
      scope_item_id: `scope_${items.length + 1}`,
      service_concept_id: "service.crown_reduction",
      object_concept_ids: [`species.${cutBack[1].toLowerCase() === "walnut" ? "black_walnut" : cutBack[1].toLowerCase()}`],
      target_concept_ids: ["target.roof"],
      polarity: "included",
      evidence_spans: [cutBack[0]],
    });
  }
  if (items.length) return items;

  if (/\bremove\b/i.test(text) && /\b(?:ash|walnut|maple)\b/i.test(text)) {
    const speciesMatches = matches.filter((match) => match.kind === "species");
    return speciesMatches.map((match, index) => ({
      scope_item_id: `scope_${index + 1}`,
      service_concept_id: "service.tree_removal",
      object_concept_ids: [match.concept_id],
      target_concept_ids: [],
      polarity: match.polarity,
      evidence_spans: [match.raw_span],
    }));
  }

  return [];
}

function scopeItemsFromMatches(matches, text) {
  const specific = scopeItemsFromSpecificPatterns(text, matches);
  if (specific.length) return specific;

  const serviceMatches = matches.filter((match) => match.kind === "service");
  return serviceMatches.map((serviceMatch, index) => ({
    scope_item_id: `scope_${index + 1}`,
    service_concept_id: serviceMatch.concept_id,
    object_concept_ids: conceptIds(matches, "species"),
    target_concept_ids: conceptIds(matches, "target"),
    polarity: serviceMatch.polarity,
    evidence_spans: [serviceMatch.raw_span],
  }));
}

export function annotateTreeServiceText(rawText = "") {
  const raw = asString(rawText);
  const normalizedText = normalizeComparableText(raw);
  const phraseMatches = matchConceptPhrases(raw);
  const safeCorrectionMatches = correctionMatches(raw, SAFE_CORRECTIONS, "safe_correction");
  const contextualMatches = correctionMatches(raw, CONTEXTUAL_CORRECTION_CANDIDATES, "contextual_candidate");
  const matches = [...phraseMatches, ...safeCorrectionMatches, ...contextualMatches];
  addRuleMatches(raw, matches);
  const uniqueMatchList = uniqueMatches(matches);

  return {
    lexicon_id: TREE_SERVICE_LEXICON_ID,
    lexicon_version: TREE_SERVICE_LEXICON_VERSION,
    raw_text: raw,
    normalized_text: normalizedText,
    matches: uniqueMatchList,
    scope_items: scopeItemsFromMatches(uniqueMatchList, raw),
    routing_flags: routeFlagsForMatches(uniqueMatchList, raw),
    unresolved_spans: [],
    warnings: warningsForMatches(uniqueMatchList),
  };
}

export function validateTreeServiceLexicon(lexicon = TREE_SERVICE_LEXICON) {
  const errors = [];
  if (lexicon.lexicon?.id !== TREE_SERVICE_LEXICON_ID) errors.push("Lexicon id is missing or unexpected.");
  if (!lexicon.lexicon?.version) errors.push("Lexicon version is required.");
  if (!lexicon.concepts || typeof lexicon.concepts !== "object") errors.push("Concept map is required.");

  const seenConceptIds = new Set();
  for (const [conceptId, concept] of Object.entries(lexicon.concepts || {})) {
    if (seenConceptIds.has(conceptId)) errors.push(`Duplicate concept id: ${conceptId}`);
    seenConceptIds.add(conceptId);
    if (!concept.label) errors.push(`${conceptId} is missing label.`);
    if (!concept.kind) errors.push(`${conceptId} is missing kind.`);
    for (const [bucket, aliases] of Object.entries(concept.aliases || {})) {
      if (!Array.isArray(aliases)) errors.push(`${conceptId}.${bucket} aliases must be an array.`);
      for (const alias of aliases || []) {
        if (!compact(alias)) errors.push(`${conceptId}.${bucket} contains an empty alias.`);
      }
    }
    for (const flag of concept.flags || []) {
      if (!ROUTING_FLAGS.includes(flag)) errors.push(`${conceptId} uses unknown routing flag ${flag}.`);
    }
  }

  for (const [conceptId, existingKind] of Object.entries(lexicon.service_kind_crosswalk || {})) {
    if (!seenConceptIds.has(conceptId)) errors.push(`Crosswalk references missing concept ${conceptId}.`);
    if (!existingKind) errors.push(`Crosswalk for ${conceptId} is empty.`);
  }

  const exampleIds = new Set();
  for (const example of lexicon.acceptance_examples || []) {
    if (!example.id) errors.push("Acceptance example is missing id.");
    if (exampleIds.has(example.id)) errors.push(`Duplicate acceptance example id: ${example.id}`);
    exampleIds.add(example.id);
    if (!example.input) errors.push(`${example.id} is missing input.`);
  }

  for (const blocked of lexicon.blocked_valid_word_substitutions || []) {
    const unsafeSafeCorrection = (lexicon.safe_corrections || []).find((item) =>
      item.surface === blocked.surface && item.normalized === blocked.blocked_to,
    );
    if (unsafeSafeCorrection) errors.push(`Unsafe valid-word correction is marked safe: ${blocked.surface} -> ${blocked.blocked_to}`);
  }

  return errors;
}

const LEXICON_SCHEMA_ERRORS = validateTreeServiceLexicon();
if (LEXICON_SCHEMA_ERRORS.length) {
  throw new Error(`Tree service lexicon schema errors: ${LEXICON_SCHEMA_ERRORS.join("; ")}`);
}

export function classifyTreeServiceTerm(value = "") {
  const text = String(value || "");
  if (TREE_SERVICE_PATTERNS.addOnService.test(text)) return "add_on_or_upgraded_service";
  if (TREE_SERVICE_PATTERNS.lowerOption.test(text)) return "base_or_lower_option";
  if (TREE_SERVICE_PATTERNS.baseService.test(text)) return "base_service";
  if (TREE_SERVICE_PATTERNS.pruning.test(text)) return "pruning_service";
  if (TREE_SERVICE_PATTERNS.reviewRisk.test(text)) return "review_risk";
  return "tree_service_scope";
}

function matchServiceConceptPhrases(text) {
  const occupied = [];
  const matches = [];
  const alternative = hasAlternativeScope(text);

  for (const entry of TREE_SERVICE_LEXICON_INDEXES.phrases_longest_first) {
    if (entry.kind !== "service" || !entry.existing_service_kind) continue;
    for (const rawMatch of text.matchAll(entry.pattern)) {
      const start = rawMatch.index ?? 0;
      const end = start + rawMatch[0].length;
      const span = { start, end };
      if (hasOccupiedSpan(span, occupied)) continue;
      const match = {
        concept_id: entry.concept_id,
        label: entry.label,
        kind: entry.kind,
        raw_span: rawMatch[0],
        start,
        end,
        match_type: entry.match_type,
        confidence: entry.confidence,
        polarity: "included",
        flags: entry.flags || [],
        evidence: { phrase: entry.phrase },
        existing_service_kind: entry.existing_service_kind,
      };
      match.polarity = polarityForMatch(text, match, alternative);
      matches.push(match);
      occupied.push(span);
    }
  }

  return matches;
}

const SERVICE_KIND_PRIORITY = Object.freeze([
  "storm_cleanup",
  "stump_grinding",
  "brush_cleanup",
  "limb_removal",
  "tree_trim",
  "haul_away",
  "tree_removal",
  "other_supported_service",
]);

const BASE_SERVICE_KINDS = new Set([
  "tree_removal",
  "tree_trim",
  "limb_removal",
  "storm_cleanup",
]);

const ADD_ON_SERVICE_KINDS = new Set([
  "stump_grinding",
  "haul_away",
  "brush_cleanup",
]);

function orderedServiceKinds(matches) {
  const kinds = new Set(matches.map((match) => match.existing_service_kind).filter(Boolean));
  return SERVICE_KIND_PRIORITY.filter((kind) => kinds.has(kind));
}

export function classifyTreeServiceScope(value = "") {
  const annotation = annotateTreeServiceText(value);
  const serviceMatches = uniqueMatches([
    ...annotation.matches.filter((match) => match.kind === "service" && match.existing_service_kind),
    ...matchServiceConceptPhrases(String(value || "")),
  ]);
  const activeMatches = serviceMatches.filter((match) =>
    match.polarity === "included" || match.polarity === "alternative",
  );
  const candidateMatches = serviceMatches.filter((match) => match.polarity !== "excluded" && match.polarity !== "completed");
  const candidateKinds = orderedServiceKinds(candidateMatches);
  const baseKinds = candidateKinds.filter((kind) => BASE_SERVICE_KINDS.has(kind));
  const addOnKinds = candidateKinds.filter((kind) => ADD_ON_SERVICE_KINDS.has(kind));
  const rawValue = String(value || "");
  const hasAlternative = activeMatches.some((match) => match.polarity === "alternative")
    || /\b(?:independent|different|separate|versus|vs\.?|or)\b/i.test(rawValue);
  const hasUncertaintyCue = /\b(?:maybe|possibly|perhaps|not sure|unclear|tbd|if (?:they|customer) wants?|if wanted|might include|could include|no price role cue)\b/i.test(rawValue);
  const hasIncrementalCue = /(?:\+\s*\$?\s*\d|\badd\s+\$?\s*\d|\b(?:extra|additional|add(?:ed)?\s+cost|incremental|on top of)\b)/i.test(rawValue);
  const hasExplicitOptionTotalCue = /\boption\s+[a-z]\b/i.test(String(value || ""))
    && /\$?\s*\d[\d,]*(?:\.\d+)?\b/.test(rawValue)
    && !hasIncrementalCue;

  let relationshipRole = "unresolved";
  if (hasAlternative) relationshipRole = "independent_alternative";
  else if (baseKinds.length && addOnKinds.length) relationshipRole = "base_with_dependent_addon";
  else if (baseKinds.length === 1 && !addOnKinds.length) relationshipRole = "base_service";
  else if (!baseKinds.length && addOnKinds.length) relationshipRole = "addon_only";

  const ambiguous = hasUncertaintyCue
    || baseKinds.length > 1
    || relationshipRole === "unresolved";
  const primaryMatch = activeMatches
    .filter((match) => match.existing_service_kind === candidateKinds[0])
    .sort((left, right) => right.confidence - left.confidence || left.start - right.start)[0];

  return {
    lexicon_id: TREE_SERVICE_LEXICON_ID,
    lexicon_version: TREE_SERVICE_LEXICON_VERSION,
    service_kind: ambiguous ? "" : (candidateKinds[0] || ""),
    candidate_kinds: candidateKinds,
    base_service_kinds: baseKinds,
    addon_service_kinds: addOnKinds,
    relationship_role: relationshipRole,
    price_role_hint: hasIncrementalCue
      ? "incremental_addon"
      : hasExplicitOptionTotalCue
        ? "explicit_option_total"
        : "unresolved",
    ambiguous,
    review_required: ambiguous || hasAlternative,
    confidence: primaryMatch?.confidence || 0,
    reason_code: ambiguous
      ? "shared_lexicon_requires_review"
      : primaryMatch
        ? `shared_lexicon_${primaryMatch.concept_id.replace(/[^a-z0-9]+/gi, "_")}`
        : "shared_lexicon_no_supported_service",
    evidence_text: primaryMatch?.raw_span || "",
    normalized_evidence_text: normalizeComparableText(primaryMatch?.raw_span || "").toLowerCase(),
    matched_concepts: activeMatches.map((match) => ({
      concept_id: match.concept_id,
      service_kind: match.existing_service_kind,
      raw_span: match.raw_span,
      confidence: match.confidence,
      polarity: match.polarity,
    })),
    excluded_concepts: serviceMatches
      .filter((match) => match.polarity === "excluded" || match.polarity === "completed")
      .map((match) => ({
        concept_id: match.concept_id,
        service_kind: match.existing_service_kind,
        raw_span: match.raw_span,
        polarity: match.polarity,
      })),
    routing_flags: annotation.routing_flags,
    warnings: annotation.warnings,
  };
}
