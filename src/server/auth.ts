import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { Google, MicrosoftEntraId } from "arctic";
import { Lucia, TimeSpan } from "lucia";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { type z } from "zod";
import { env } from "~/env.mjs";
import { type PermissionSchema } from "~/lib/permissionsTypes";
import { db } from "./db";
import { session, user } from "./db/schema";

const adapter = new DrizzlePostgreSQLAdapter(db, session, user);

const baseUrl =
  env.NODE_ENV === "production"
    ? env.VERCEL_URL
      ? `https://sistema-maika.vercel.app`
      : "https://sistema.maika.com.ar"
    : "http://localhost:3000";

const msftRedirectUrl = `${baseUrl}/api/auth/callback/azure-ad`;
const googleRedirectUrl = `${baseUrl}/api/auth/callback/google`;

export const microsoft = new MicrosoftEntraId(
  env.AZURE_AD_TENANT_ID,
  env.AZURE_AD_CLIENT_ID,
  env.AZURE_AD_CLIENT_SECRET,
  msftRedirectUrl,
);

export const google = new Google(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  googleRedirectUrl,
);

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(2, "w"),
  sessionCookie: {
    attributes: {
      secure: env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      name: attributes.name,
      email: attributes.email,
      photoUrl: attributes.photoUrl,
      permissions: attributes.permissions,
      roleId: attributes.roleId,
      entityId: attributes.entityId,
      preferredEntity: attributes.preferredEntity,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      name: string;
      email: string;
      photoUrl: string;
      permissions?: z.infer<typeof PermissionSchema> | null;
      entityId: number;
      roleId?: number | null;
      preferredEntity: number | null;
    };
  }
}

export const getUser = cache(async () => {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return null;
  const { session, user } = await lucia.validateSession(sessionId);
  try {
    if (session?.fresh) {
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
    }
    if (!session) {
      const sessionCookie = lucia.createBlankSessionCookie();
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
    }
  } catch {
    // Next.js throws error when attempting to set cookies when rendering page
  }
  return user;
});

export const logOut = async () => {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return null;
  const { session } = await lucia.validateSession(sessionId);
  if (!session) {
    return {
      error: "Unauthorized",
    };
  }

  await lucia.invalidateSession(session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );

  await lucia.deleteExpiredSessions();

  return redirect("/");
};
