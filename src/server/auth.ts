import { PrismaAdapter } from "@next-auth/prisma-adapter";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { type z } from "zod";

import { env } from "~/env.mjs";
import { type PermissionSchema } from "~/lib/permissionsTypes";
import { db } from "~/server/db";
import { api } from "~/trpc/server";
import { redis } from "./redis";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface User {
    roleId?: number | null;
    permissions?: z.infer<typeof PermissionSchema> | null;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      roleId?: number | null;
      permissions?: z.infer<typeof PermissionSchema> | null;
    } & DefaultSession["user"];
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/",
  },
  callbacks: {
    redirect() {
      return "/";
    },
    signIn: async ({ user }) => {
      const isWhitelisted = await api.users.isWhitelisted.query({
        email: user.email ? user.email : "",
      });
      return isWhitelisted;
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        roleId: user.roleId,
        permissions: user.permissions,
      },
    }),
  },
  adapter: PrismaAdapter(db),
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "database",
    updateAge: 12 * 60 * 60,
  },
  events: {
    createUser: async (message) => {
      if (message.user.name) {
        await api.entities.addOne.mutate({
          name: message.user.name,
          tag: "user",
        });
        await redis.del("users");
      }
    },
    signIn: (message) => {
      console.log(
        `User ${
          message.user.name
        } signed in at: ${new Date().toLocaleTimeString("es-AR")}`,
      );
    },
    signOut: (message) => {
      console.log(
        `User ${
          message.session.user.name
        } signed out at ${new Date().toLocaleTimeString("es-AR")}`,
      );
    },
  },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: `${profile.given_name} ${profile.family_name}`,
          email: profile.email,
        };
      },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);
