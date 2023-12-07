import { type Prisma, type PrismaClient } from "@prisma/client";
import { type DefaultArgs } from "@prisma/client/runtime/library";
import { TRPCError } from "@trpc/server";
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

  const user = await db.user.findUnique({
    where: {
      id: input.userId ? input.userId : session.user.id,
    },
  });
  if (session.user.roleId) {
    const role = await db.role.findUnique({
      where: {
        id: session.user.roleId,
      },
    });

    if (role?.permissions && user?.permissions) {
      const merged = mergePermissions(
        // @ts-ignore
        role.permissions,
        user.permissions,
      );

      await redis.set(
        `user_permissions:${session.user.id}`,
        JSON.stringify(merged),
        "EX",
        300,
      );

      return merged as z.infer<typeof PermissionSchema> | null;
    }
    if (role?.permissions) {
      await redis.set(
        `user_permissions:${session.user.id}`,
        JSON.stringify(role.permissions),
        "EX",
        300,
      );

      return role.permissions as z.infer<typeof PermissionSchema> | null;
    }
  }
  if (user?.permissions) {
    await redis.set(
      `user_permissions:${session.user.id}`,
      JSON.stringify(user.permissions),
      "EX",
      300,
    );

    return user.permissions as z.infer<typeof PermissionSchema> | null;
  }
};

export const getAllTags = async (
  redis: Redis,
  db: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
) => {
  const cachedTagsString = await redis.get("tags");
  if (cachedTagsString) {
    const cachedTags: typeof tags = JSON.parse(cachedTagsString);
    return cachedTags;
  }

  const tags = await db.tag.findMany({
    include: {
      childTags: true,
    },
  });
  if (tags) {
    await redis.set("tags", JSON.stringify(tags), "EX", 3600);
  }
  return tags;
};

export const getAllEntities = async (
  redis: Redis,
  db: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
) => {
  const cachedEntities: string | null = await redis.get("cached_entities");

  if (cachedEntities) {
    console.log("Entities queried from cache");
    const parsedEntities: typeof entities = JSON.parse(cachedEntities);

    return parsedEntities;
  }

  const entities = await db.entities.findMany({
    select: {
      id: true,
      name: true,
      tag: true,
    },
  });

  console.log("Entities queried from database");

  if (!entities)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Entities returned empty from database",
    });

  await redis.set("cached_entities", JSON.stringify(entities), "EX", "3600");

  return entities;
};
