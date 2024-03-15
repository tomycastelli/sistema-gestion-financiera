import { OAuth2RequestError } from "arctic";
import { DrizzleError, and, eq } from "drizzle-orm";
import { generateId } from "lucia";
import { cookies } from "next/headers";
import { ZodError, z } from "zod";
import { lucia, microsoft } from "~/server/auth";
import { db2 } from "~/server/db";
import { entities, oauth_account, user } from "~/server/db/schema";

export const dynamic = "force-dynamic"; // defaults to auto
export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const storedState = cookies().get("state")?.value ?? null;
  const storedCodeVerifier = cookies().get("code_verifier")?.value ?? null;

  if (
    !code ||
    !storedState ||
    !state ||
    !storedCodeVerifier ||
    state !== storedState
  ) {
    return new Response(null, {
      status: 400,
    });
  }

  try {
    const tokens = await microsoft.validateAuthorizationCode(
      code,
      storedCodeVerifier,
    );

    const response = await fetch("https://graph.microsoft.com/oidc/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    const userSchema = z.object({
      sub: z.string(),
      name: z.string(),
      given_name: z.string(),
      family_name: z.string(),
      picture: z.string(),
      email: z.string(),
    });

    const microsoftUser = userSchema.parse(await response.json());

    const existingUser = await db2.query.oauth_account.findFirst({
      where: and(
        eq(oauth_account.providerId, "microsoft"),
        eq(oauth_account.providerUserId, microsoftUser.sub),
      ),
    });

    if (existingUser) {
      const session = await lucia.createSession(existingUser.userId, {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": sessionCookie.serialize(),
        },
      });
    }

    const userId = generateId(15);

    await db2.transaction(async (tx) => {
      const userFullName =
        microsoftUser.given_name + " " + microsoftUser.family_name;
      const userEntity = await tx
        .insert(entities)
        .values({
          name: userFullName,
          tagName: "Operadores",
        })
        .returning();
      await tx.insert(user).values({
        id: userId,
        name: userFullName,
        photoUrl: microsoftUser.picture,
        email: microsoftUser.email,
        entityId: userEntity[0]!.id,
      });
      await tx.insert(oauth_account).values({
        providerId: "microsoft",
        providerUserId: microsoftUser.sub,
        userId: userId,
      });
    });

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": sessionCookie.serialize(),
      },
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return new Response(e.toString(), {
        status: 422,
      });
    }
    if (e instanceof OAuth2RequestError) {
      return new Response(e.message, {
        status: 400,
      });
    }
    if (e instanceof DrizzleError) {
      return new Response(e.message, {
        status: 500,
      });
    }
    return new Response(null, {
      status: 500,
    });
  }
}
