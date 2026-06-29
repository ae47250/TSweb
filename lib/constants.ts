// Alpha Tree Service — fixed business + contractor constants.
// Sourced from the AlphaJSON v1.4 spec (company block + tree-dude contact info).

export const COMPANY = {
  name: "Alpha Tree Service",
  region: "Southeastern Indiana",
  ownerName: 'William "Billy" Gunter',
  ownerPhone: "812-599-6587",
  footerText: "Alpha Tree Service • Southeastern Indiana • 812-599-6587",
} as const

// The "tree dude" / contractor who receives signed-estimate notifications.
export const CONTRACTOR = {
  phone: process.env.TREE_DUDE_PHONE || "502-310-6952",
  email: process.env.TREE_DUDE_EMAIL || "huagalli@hotmail.com",
} as const

export const SIGNATURE_MIN_LENGTH = Number(process.env.SIGNATURE_MIN_LENGTH || 2)

export const OPTION_LABELS = ["Option A", "Option B", "Option C", "Option D"] as const
