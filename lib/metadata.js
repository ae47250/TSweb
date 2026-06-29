let dailyCounter = 0;
let lastDate = "";

export function generateDocumentId(now = new Date()) {
  const ymd = now.toISOString().slice(0, 10).replaceAll("-", "");
  if (ymd !== lastDate) {
    lastDate = ymd;
    dailyCounter = 0;
  }
  dailyCounter += 1;
  return `EST-${ymd}-${String(dailyCounter).padStart(3, "0")}`;
}

export function formatDisplayDate(now = new Date()) {
  return now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
