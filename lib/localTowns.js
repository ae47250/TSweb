export const LOCAL_INDIANA_TOWNS = [
  "Seymour",
  "Madison",
  "Sellersburg",
  "Charlestown",
  "Scottsburg",
  "Vernon",
  "North Vernon",
  "Salem",
  "Austin",
  "Hanover",
  "Crothersville",
  "Little York",
  "Paoli",
  "Bedford",
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const LOCAL_TOWN_PATTERN = `(?:${LOCAL_INDIANA_TOWNS.map((town) => escapeRegExp(town).replace(/\s+/g, "\\s+")).join("|")})`;

export function hasLocalIndianaTown(value) {
  return new RegExp(`\\b${LOCAL_TOWN_PATTERN}\\b`, "i").test(String(value || ""));
}

export function hasIndianaState(value) {
  return /\b(?:Indiana|IN)\b/i.test(String(value || ""));
}

export function appendIndianaForLocalTown(value) {
  const text = String(value || "").trim();
  if (!text || !hasLocalIndianaTown(text) || hasIndianaState(text)) return text;
  return `${text.replace(/\s+,/g, ",")}, Indiana`;
}
