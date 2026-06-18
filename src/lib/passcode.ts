import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "greenpoint_access";

const SIGNATURE_MESSAGE = "greenpoint-walkthrough-estimator-access";

export function getConfiguredPasscode() {
  const configuredPasscode =
    process.env.GREENPOINT_PASSCODE ??
    (process.env.NODE_ENV === "production" ? "" : "123456");
  const normalizedPasscode = configuredPasscode.trim();

  if (!/^\d{6}$/.test(normalizedPasscode)) {
    return "";
  }

  return normalizedPasscode;
}

export function createAccessCookieValue(passcode = getConfiguredPasscode()) {
  if (!passcode) {
    return "";
  }

  return createHmac("sha256", passcode)
    .update(SIGNATURE_MESSAGE)
    .digest("hex");
}

export function isValidAccessCookie(value?: string) {
  const expectedValue = createAccessCookieValue();

  if (!value || !expectedValue || value.length !== expectedValue.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(value), Buffer.from(expectedValue));
}
