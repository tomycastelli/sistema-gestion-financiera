import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { env } from "~/env.mjs";
import { microsoft } from "~/server/auth";

export const dynamic = "force-dynamic"; // defaults to auto
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const provider = requestUrl.searchParams.get("provider");
  if (provider === "microsoft") {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    const url: URL = await microsoft.createAuthorizationURL(
      state,
      codeVerifier,
      {
        scopes: ["profile", "email"],
      },
    );

    cookies().set("state", state, {
      secure: env.NODE_ENV !== "development", // false in case of local development
      path: "/",
      httpOnly: true,
      maxAge: 60 * 10, // 10 min
    });

    cookies().set("code_verifier", codeVerifier, {
      secure: env.NODE_ENV !== "development",
      path: "/",
      httpOnly: true,
      maxAge: 60 * 10,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
      },
    });
  } else {
    return new Response(null, {
      status: 400,
    });
  }
}
