import { type Prisma, type PrismaClient } from "@prisma/client";
import { type DefaultArgs } from "@prisma/client/runtime/library";
import type Redis from "ioredis";
import { type Session } from "next-auth";
import { z } from "zod";
import { mergePermissions, type PermissionSchema } from "./permissionsTypes";

const permissionsInput = z.object({ userId: z.string().optional() });

export const getAllPermissions = async (
  redis: Redis,
  session: Session | null,
  db: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
  input: z.infer<typeof permissionsInput>,
) => {
  if (!session) {
    return [];
  }
  const cachedResponseString = await redis.get(
    `user_permissions:${session.user.id}`,
  );
  if (cachedResponseString) {
    const cachedResponse: z.infer<typeof PermissionSchema> =
      JSON.parse(cachedResponseString);
    return cachedResponse;
  }

  // @ts-ignore
  const { permissions } = await db.user.findUnique({
    where: {
      id: input.userId ? input.userId : session.user.id,
    },
    select: {
      permissions: true,
    },
  });
  if (session.user.roleId) {
    // @ts-ignore
    const { rolePermissions } = await db.role.findUnique({
      where: {
        id: session.user.roleId,
      },
      select: {
        permissions: true,
      },
    });

    if (rolePermissions && permissions) {
      const merged = mergePermissions(rolePermissions, permissions);

      await redis.set(
        `user_permissions:${session.user.id}`,
        JSON.stringify(merged),
        "EX",
        300,
      );

      return merged as z.infer<typeof PermissionSchema> | null;
    }
    if (rolePermissions && !permissions) {
      await redis.set(
        `user_permissions:${session.user.id}`,
        JSON.stringify(rolePermissions),
        "EX",
        300,
      );

      return rolePermissions as z.infer<typeof PermissionSchema> | null;
    }
  }
  if (permissions) {
    await redis.set(
      `user_permissions:${session.user.id}`,
      JSON.stringify(permissions),
      "EX",
      300,
    );

    return permissions as z.infer<typeof PermissionSchema> | null;
  }
};
