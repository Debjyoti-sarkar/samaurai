const [, , orderId, status = "SUCCESS"] = process.argv;

if (!orderId) {
  console.error(
    "Usage: node scripts/test-payment-confirm.js <orderId> [SUCCESS|FAILED]",
  );
  process.exit(1);
}

const normalizedStatus = String(status).toUpperCase();
if (!["SUCCESS", "FAILED"].includes(normalizedStatus)) {
  console.error("Status must be SUCCESS or FAILED");
  process.exit(1);
}

const baseUrl =
  process.env.PAYMENT_API_BASE_URL || "http://localhost:3001/api/payment";
const secret = process.env.PAYMENT_WEBHOOK_SECRET || "";

const headers = {
  "Content-Type": "application/json",
};

if (secret) {
  headers["x-payment-webhook-secret"] = secret;
}

const payload = {
  orderId,
  status: normalizedStatus,
};

if (normalizedStatus === "FAILED") {
  payload.failureReason = "Manual demo failure";
}

const response = await fetch(`${baseUrl}/payments/test-confirm`, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));

if (!response.ok) {
  process.exit(1);
}
