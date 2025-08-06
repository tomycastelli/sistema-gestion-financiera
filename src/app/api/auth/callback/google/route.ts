import { OAuth2RequestError } from "arctic";
import { DrizzleError, and, eq } from "drizzle-orm";
import { generateId } from "lucia";
import { cookies } from "next/headers";
import { ZodError, z } from "zod";
import { google, lucia } from "~/server/auth";
import { db } from "~/server/db";
import { entities, oauth_account, tag, user } from "~/server/db/schema";

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
    const tokens = await google.validateAuthorizationCode(
      code,
      storedCodeVerifier,
    );

    const response = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      },
    );

    const userSchema = z.object({
      sub: z.string(),
      name: z.string(),
      given_name: z.string().optional(),
      family_name: z.string().optional(),
      picture: z.string(),
      email: z.string(),
      email_verified: z.boolean(),
    });

    const googleUser = userSchema.parse(await response.json());

    const existingUser = await db.query.oauth_account.findFirst({
      where: and(
        eq(oauth_account.providerId, "google"),
        eq(oauth_account.providerUserId, googleUser.sub),
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

    await db.transaction(async (tx) => {
      const [isOperadoresTag] = await tx
        .select({ tagName: tag.name })
        .from(tag)
        .where(eq(tag.name, "Operadores"));
      if (!isOperadoresTag) {
        await tx.insert(tag).values({ name: "Operadores" });
      }

      const [existingEntity] = await tx
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.name, googleUser.name));

      if (!existingEntity) {
        const [userEntity] = await tx
          .insert(entities)
          .values({
            name: googleUser.name,
            tagName: "Operadores",
          })
          .returning();
        await tx.insert(user).values({
          id: userId,
          name: googleUser.name,
          photoUrl: googleUser.picture,
          email: googleUser.email,
          entityId: userEntity!.id,
        });
      } else {
        // If entity exists, create a new entity with "2" appended to the name
        const newEntityName = `${googleUser.name} 2`;
        const [userEntity] = await tx
          .insert(entities)
          .values({
            name: newEntityName,
            tagName: "Operadores",
          })
          .returning();
        await tx.insert(user).values({
          id: userId,
          name: newEntityName,
          photoUrl: googleUser.picture,
          email: googleUser.email,
          entityId: userEntity!.id,
        });
      }

      await tx.insert(oauth_account).values({
        providerId: "google",
        providerUserId: googleUser.sub,
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
      console.error(e);
      return new Response(e.toString(), {
        status: 422,
      });
    }
    if (e instanceof OAuth2RequestError) {
      console.error(e);
      return new Response(e.message, {
        status: 400,
      });
    }
    if (e instanceof DrizzleError) {
      console.error(e);
      return new Response(e.message, {
        status: 500,
      });
    }
    console.error(e);
    // @ts-ignore
    return new Response(e, {
      status: 500,
    });
  }
}
