import {
  MOCK_NOTIFICATIONS,
  PINGRAM_API_KEY,
  PINGRAM_API_URL,
  PINGRAM_FROM_EMAIL,
  PINGRAM_FROM_NAME,
  PINGRAM_FROM_NUMBER,
  PINGRAM_REPLY_TO,
  TREE_DUDE_EMAIL,
  TREE_DUDE_PHONE,
} from "../config/constants.js";

function compact(value) {
  return String(value || "").trim();
}

function firstName(name = "customer") {
  return compact(name).split(/\s+/)[0] || "there";
}

function missingPingramConfig(channel) {
  const missing = [];
  if (!PINGRAM_API_KEY) missing.push("PINGRAM_API_KEY");
  if (!PINGRAM_API_URL) missing.push("PINGRAM_API_URL");
  if (channel === "email" && !PINGRAM_FROM_EMAIL) missing.push("PINGRAM_FROM_EMAIL");
  return missing;
}

function mockResult({ channel, to, subject, message, payload }) {
  return {
    mocked: true,
    sent: false,
    channel,
    to,
    subject,
    message,
    provider: "pingram",
    payload,
  };
}

function recipientId(channel, to) {
  return `${channel}-${compact(to).replace(/[^a-z0-9]/gi, "").slice(-16) || "recipient"}`;
}

function pingramPayload({ channel, to, subject, message }) {
  if (channel === "email") {
    return {
      type: "alpha_tree_estimate_email",
      to: {
        id: recipientId(channel, to),
        email: compact(to),
      },
      forceChannels: ["EMAIL"],
      email: {
        subject: compact(subject),
        html: compact(message).replace(/\n/g, "<br>"),
        senderName: PINGRAM_FROM_NAME,
        senderEmail: PINGRAM_FROM_EMAIL,
      },
      options: {
        email: {
          replyToAddresses: PINGRAM_REPLY_TO ? [PINGRAM_REPLY_TO] : [],
          fromAddress: PINGRAM_FROM_EMAIL,
          fromName: PINGRAM_FROM_NAME,
        },
      },
    };
  }

  return {
    type: "alpha_tree_estimate_sms",
    to: {
      id: recipientId(channel, to),
      number: compact(to),
    },
    forceChannels: ["SMS"],
    sms: {
      message: compact(message),
      from: PINGRAM_FROM_NUMBER || undefined,
    },
  };
}

async function sendPingram({ channel, to, subject = "", message }) {
  const recipient = compact(to);
  if (!recipient) throw new Error(`Missing ${channel} recipient.`);

  const payload = pingramPayload({ channel, to: recipient, subject, message });

  if (MOCK_NOTIFICATIONS) return mockResult({ channel, to: recipient, subject, message, payload });

  const missing = missingPingramConfig(channel);
  if (missing.length) {
    throw new Error(`Live Pingram ${channel} requires ${missing.join(", ")}.`);
  }

  const response = await fetch(PINGRAM_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINGRAM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const detail = data?.error || data?.message || response.statusText || "Pingram request failed.";
    throw new Error(`Pingram ${channel} failed: ${detail}`);
  }

  return {
    mocked: false,
    sent: true,
    channel,
    to: recipient,
    subject,
    provider: "pingram",
    providerResponse: data,
  };
}

export function customerEstimateMessage({ customerName, estimateUrl }) {
  return `Hi ${firstName(customerName)}, your Alpha Tree Service estimate is ready. Review options and sign here: ${estimateUrl}`;
}

export function customerEstimateEmail({ customerName, estimateUrl }) {
  const subject = `Alpha Tree Service Estimate - ${compact(customerName) || "Customer"}`;
  const message = `Hi ${firstName(customerName)},

Your Alpha Tree Service estimate is ready. Please review the options and sign electronically.

View Your Alpha Tree Service Estimate:
${estimateUrl}`;

  return { subject, message };
}

export async function notifyCustomerEstimate({ channel, documentId, customerName, customerPhone, customerEmail, estimateUrl }) {
  const safeChannel = channel === "email" ? "email" : "sms";
  const link = compact(estimateUrl) || `/e/${encodeURIComponent(documentId || "")}`;

  if (safeChannel === "email") {
    const email = customerEstimateEmail({ customerName, estimateUrl: link });
    return sendPingram({
      channel: "email",
      to: customerEmail,
      subject: email.subject,
      message: email.message,
    });
  }

  return sendPingram({
    channel: "sms",
    to: customerPhone,
    message: customerEstimateMessage({ customerName, estimateUrl: link }),
  });
}

export async function notifyContractor({ documentId, customerName, address, selectedOption, price, signedAtDisplay, estimateUrl }) {
  const message = `${customerName || "Customer"} accepted ${selectedOption || "an option"}${price ? ` - ${price}` : ""}.${signedAtDisplay ? ` Signed: ${signedAtDisplay}.` : ""} View signed estimate: ${estimateUrl || `/e/${documentId}`}`.trim();
  const subject = `Signed Estimate - ${customerName || "Customer"} - ${documentId}`;
  const sms = await sendPingram({
    channel: "sms",
    to: TREE_DUDE_PHONE,
    message,
  });
  const email = await sendPingram({
    channel: "email",
    to: TREE_DUDE_EMAIL,
    subject,
    message: `${message}${address ? `\n\nService address: ${address}` : ""}`,
  });

  return {
    mocked: sms.mocked && email.mocked,
    sentSms: sms.sent,
    sentEmail: email.sent,
    intendedRecipients: { phone: TREE_DUDE_PHONE, email: TREE_DUDE_EMAIL },
    payload: {
      documentId,
      sms,
      email,
    },
  };
}
