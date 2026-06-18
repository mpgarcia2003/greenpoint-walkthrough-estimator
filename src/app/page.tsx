import { cookies } from "next/headers";

import { AccessGate } from "@/components/auth/access-gate";
import { EstimatorApp } from "@/components/estimator/estimator-app";
import { ACCESS_COOKIE_NAME, isValidAccessCookie } from "@/lib/passcode";

export default async function Home() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (!isValidAccessCookie(accessCookie)) {
    return <AccessGate />;
  }

  return <EstimatorApp />;
}
