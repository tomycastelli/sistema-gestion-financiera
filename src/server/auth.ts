import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { MicrosoftEntraId } from "arctic";
import { Lucia } from "lucia";
import { cookies } from "next/headers";
import { cache } from "react";
import { type z } from "zod";
import { env } from "~/env.mjs";
import { type PermissionSchema } from "~/lib/permissionsTypes";
import { db } from "./db";
import { session, user } from "./db/schema";

const adapter = new DrizzlePostgreSQLAdapter(db, session, user);

const baseUrl =
  env.NODE_ENV === "production"
    ? "https://financial-tracker.vercel.app"
    : "http://localhost:3000";

const redirectUrl = `${baseUrl}/api/auth/callback/azure-ad`;

export const microsoft = new MicrosoftEntraId(
  env.AZURE_AD_TENANT_ID,
  env.AZURE_AD_CLIENT_ID,
  env.AZURE_AD_CLIENT_SECRET,
  redirectUrl,
);

export const lucia = new Lucia(adapter, {
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
