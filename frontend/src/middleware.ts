import { NextResponse, type NextRequest } from "next/server";

// Presence check only; the backend validates the signed session on every API call.
export function middleware(req: NextRequest) {
  if (process.env.CT_AUTH_DISABLED === "1") return NextResponse.next(); // local UI preview only
  if (!req.cookies.get("ct_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api|_next|manifest.webmanifest|icon|favicon.ico).*)"],
};
