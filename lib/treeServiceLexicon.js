export const TREE_SERVICE_LEXICON = Object.freeze({
  baseServiceTerms: [
    "remove",
    "removal",
    "remove all",
    "tree removal",
    "take down",
    "takedown",
    "take tree down",
    "cut down",
    "cut tree",
    "fell",
    "felling",
    "drop",
    "sectioning",
    "dismantling",
  ],
  addOnServiceTerms: [
    "stump",
    "stumps",
    "stumping",
    "stump grinding",
    "grind",
    "grinding",
    "stump removal",
    "root ball removal",
    "haul away",
    "haul off",
    "hauling",
    "debris removal",
    "green waste removal",
    "cleanup",
    "clean up",
    "final cleanup",
    "grindings cleanup",
    "chip",
    "chipping",
    "brush",
    "brush removal",
    "wood removal",
    "log removal",
    "disposal",
    "dump fee",
    "dump fees",
    "tipping fee",
    "tipping fees",
    "rounds",
    "firewood rounds",
    "bucking",
    "splitting",
    "log splitting",
    "stacking",
    "backfill",
    "topsoil",
    "seed",
    "seeding",
    "rake",
    "blow",
    "restore work area",
  ],
  lowerOptionTerms: [
    "drop and leave",
    "drop only",
    "drop stack wood",
    "cut only",
    "removal only",
    "leave wood",
    "leave debris",
    "leave brush",
    "leave chips",
    "chips left on site",
    "wood left on site",
    "customer keeps wood",
    "no haul away",
    "no haul off",
    "no cleanup",
  ],
  pruningTerms: [
    "trim",
    "trimming",
    "prune",
    "pruning",
    "crown clean",
    "deadwooding",
    "dead wooding",
    "crown raise",
    "crown lift",
    "crown thin",
    "crown reduction",
  ],
  supportTerms: ["cabling"],
  reviewRiskTerms: ["topping", "lopping", "hack job"],
});

const TREE_SERVICE_PATTERN_SOURCE_VALUES = {
  baseService:
    "remove|removal|remove\\s+all|tree\\s+removal|take\\s+down|takedown|take\\s+tree\\s+down|cut\\s+down|cut\\s+tree|fell(?:ing)?|drop|section(?:ing)?|dismantl(?:e|ing)",
  addOnService:
    "stumps?|stumping|stump\\s+grind(?:ing)?|grind(?:ing)?|stump\\s+removal|root\\s+ball\\s+removal|haul(?:\\s+off|\\s+away)?|hauling|debris\\s+removal|green\\s+waste\\s+removal|cleanup|clean\\s+up|final\\s+cleanup|grindings\\s+cleanup|chip(?:ping)?|brush(?:\\s+removal)?|wood\\s+removal|log\\s+removal|disposal|dump\\s+fees?|tipping\\s+fees?|firewood\\s+rounds|rounds|bucking|splitting|log\\s+splitting|stacking|backfill|topsoil|seed(?:ing)?|rake|blow|restore\\s+work\\s+area",
  lowerOption:
    "drop\\s+and\\s+leave|drop\\s+only|drop\\s+stack\\s+wood|cut\\s+only|removal\\s+only|leave\\s+wood|leave\\s+debris|leave\\s+brush|leave\\s+chips|chips\\s+left\\s+on\\s+site|wood\\s+left\\s+on\\s+site|customer\\s+keeps\\s+wood|no\\s+haul(?:\\s+away|\\s+off)?|no\\s+cleanup",
  pruning:
    "trim|trimming|prune|pruning|crown\\s+clean|dead\\s*wooding|crown\\s+(?:raise|lift|thin|reduction)",
  support: "cabling",
  reviewRisk: "topping|lopping|hack\\s+job",
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
  ].join("|"),
});

export const TREE_SERVICE_PATTERNS = Object.freeze({
  baseService: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.baseService})\\b`, "i"),
  addOnService: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.addOnService})\\b`, "i"),
  lowerOption: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.lowerOption})\\b`, "i"),
  pruning: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.pruning})\\b`, "i"),
  reviewRisk: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.reviewRisk})\\b`, "i"),
  workScope: new RegExp(`\\b(?:${TREE_SERVICE_PATTERN_SOURCES.workScope})\\b`, "i"),
  explicitAdditiveCue: /(?:\+|\b(?:extra|add(?:ed)?|add\s+on|add-on|add\s+to\s+that|plus|on\s+top|additional|also|in\s+addition)\b)/i,
  unitOrRateCue: /\b(?:per|each|per\s+stump|per\s+tree|per\s+load|per\s+hour|hourly|minimum)\b/i,
});

export function classifyTreeServiceTerm(value = "") {
  const text = String(value || "");
  if (TREE_SERVICE_PATTERNS.addOnService.test(text)) return "add_on_or_upgraded_service";
  if (TREE_SERVICE_PATTERNS.lowerOption.test(text)) return "base_or_lower_option";
  if (TREE_SERVICE_PATTERNS.baseService.test(text)) return "base_service";
  if (TREE_SERVICE_PATTERNS.pruning.test(text)) return "pruning_service";
  if (TREE_SERVICE_PATTERNS.reviewRisk.test(text)) return "review_risk";
  return "tree_service_scope";
}
