import { OAuth2RequestError } from "arctic";
import { DrizzleError, and, eq } from "drizzle-orm";
import { generateId } from "lucia";
import { cookies } from "next/headers";
import { ZodError, z } from "zod";
import { lucia, microsoft } from "~/server/auth";
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
    return new Response("Could not find code and state on cookies", {
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
      given_name: z.string().optional(),
      family_name: z.string().optional(),
      picture: z.string(),
      email: z.string(),
    });

    const microsoftUser = userSchema.parse(await response.json());

    const existingUser = await db.query.oauth_account.findFirst({
      where: and(
        eq(oauth_account.providerId, "microsoft"),
        eq(oauth_account.providerUserId, microsoftUser.sub),
      ),
    });

    if (existingUser) {
      // Esto se hace en el backend
      const session = await lucia.createSession(existingUser.userId, {});
      // Esto se hace server-side en el front
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

    const userFullName = microsoftUser.given_name ?
      (microsoftUser.given_name + " " + microsoftUser.family_name) : microsoftUser.name

    await db.transaction(async (tx) => {
      const [isOperadoresTag] = await tx
        .select({ tagName: tag.name })
        .from(tag)
        .where(eq(tag.name, "Operadores"));
      if (!isOperadoresTag) {
        await tx.insert(tag).values({ name: "Operadores" });
      }

      const adminsEmails = [
        "christian@ifc.com.ar",
        "tomas.castelli@ifc.com.ar",
      ];

      const [existingUserEntity] = await tx
        .select()
        .from(entities)
        .where(and(eq(entities.name, userFullName)));
      if (!existingUserEntity) {
        const [userEntity] = await tx
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
          entityId: userEntity!.id,
          permissions: adminsEmails.includes(microsoftUser.email)
            ? [{ name: "ADMIN" }]
            : null,
        });
      } else {
        await tx.insert(user).values({
          id: userId,
          name: userFullName,
          photoUrl: microsoftUser.picture,
          email: microsoftUser.email,
          entityId: existingUserEntity.id,
          permissions: adminsEmails.includes(microsoftUser.email)
            ? [{ name: "ADMIN" }]
            : null,
        });
      }

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
    if (e instanceof Error) {
      return new Response(e.message, {
        status: 500,
      });
    }
  }
}
