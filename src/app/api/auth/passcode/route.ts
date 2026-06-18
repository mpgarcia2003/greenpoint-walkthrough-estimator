import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE_NAME,
  createAccessCookieValue,
  getConfiguredPasscode,
} from "@/lib/passcode";

export async function POST(request: Request) {
  const configuredPasscode = getConfiguredPasscode();

  if (!configuredPasscode) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "GREENPOINT_PASSCODE must be set to a 6 digit code before access can be granted.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    passcode?: string;
  };
  const submittedPasscode = String(body.passcode ?? "").trim();

  if (submittedPasscode !== configuredPasscode) {
    return NextResponse.json(
      { ok: false, message: "Incorrect passcode." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE_NAME, createAccessCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_COOKIE_NAME);

  return response;
}
