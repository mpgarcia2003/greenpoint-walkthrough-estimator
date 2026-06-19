import { cookies } from "next/headers";

import { ACCESS_COOKIE_NAME, isValidAccessCookie } from "@/lib/passcode";

export async function isWalkthroughApiAuthorized() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  return isValidAccessCookie(accessCookie);
}

export function cloudUnavailableResponse() {
  return Response.json(
    {
      ok: false,
      message:
        "Cloud walkthrough storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY on the server.",
    },
    { status: 503 },
  );
}
