export const TREE_DUDE_PHONE = process.env.TREE_DUDE_PHONE || "502-310-6952";
export const TREE_DUDE_EMAIL = process.env.TREE_DUDE_EMAIL || "huagalli@hotmail.com";
export const PINGRAM_API_KEY = process.env.PINGRAM_API_KEY || "";
export const PINGRAM_API_URL = process.env.PINGRAM_API_URL || "https://api.pingram.io/send";
export const PINGRAM_FROM_EMAIL = process.env.PINGRAM_FROM_EMAIL || "";
export const PINGRAM_FROM_NAME = process.env.PINGRAM_FROM_NAME || "Alpha Tree Service";
export const PINGRAM_FROM_NUMBER = process.env.PINGRAM_FROM_NUMBER || "";
export const PINGRAM_REPLY_TO = process.env.PINGRAM_REPLY_TO || TREE_DUDE_EMAIL;
export const SIGNATURE_MIN_LENGTH = Number(process.env.SIGNATURE_MIN_LENGTH || 2);
export const SIGNATURE_MAX_LENGTH = Number(process.env.SIGNATURE_MAX_LENGTH || 50);
export const RATE_LIMIT_REQUESTS_PER_HOUR = Number(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || 10);
export const LEGAL_DISCLAIMER =
  "By typing your name, you agree this constitutes your electronic signature and you authorize Alpha Tree Service to perform the selected work.";
export const MOCK_NOTIFICATIONS = process.env.MOCK_NOTIFICATIONS !== "false";
