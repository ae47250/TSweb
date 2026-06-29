import { MOCK_NOTIFICATIONS, TREE_DUDE_EMAIL, TREE_DUDE_PHONE } from "../config/constants.js";

export async function notifyContractor({ documentId, customerName, address, selectedOption, price, signedAtDisplay, estimateUrl }) {
  const payload = {
    documentId,
    sms: {
      to: TREE_DUDE_PHONE,
      provider: "pingram",
      message: `${customerName || "Customer"} accepted ${selectedOption || "an option"}${price ? ` - ${price}` : ""}.${signedAtDisplay ? ` Signed: ${signedAtDisplay}.` : ""} View signed estimate: ${estimateUrl || `/e/${documentId}`}`.trim(),
    },
    email: {
      to: TREE_DUDE_EMAIL,
      subject: `Signed Estimate - ${customerName || "Customer"} - ${documentId}`,
    },
  };

  if (MOCK_NOTIFICATIONS) {
    return {
      mocked: true,
      sentSms: false,
      sentEmail: false,
      intendedRecipients: { phone: TREE_DUDE_PHONE, email: TREE_DUDE_EMAIL },
      payload,
    };
  }

  throw new Error("Live notifications require explicit manual production approval before MOCK_NOTIFICATIONS=false is used.");
}
