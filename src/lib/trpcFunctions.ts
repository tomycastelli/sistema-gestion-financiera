import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type Redis from "ioredis";
import type { User } from "lucia";
import { z, ZodError } from "zod";
import { env } from "~/env.mjs";
import type { dynamodb } from "~/server/dynamodb";
import type * as schema from "../server/db/schema";
import { globalSettings, role } from "../server/db/schema";
import { getAllChildrenTags } from "./functions";
import { mergePermissions, PermissionSchema } from "./permissionsTypes";

export const getAllPermissions = async (
  redis: Redis,
  user: User | null | undefined,
  db: PostgresJsDatabase<typeof schema>,
) => {
  if (!user) {
    return [];
  }

  const cachedResponseString = await redis.get(`user_permissions|${user.id}`);
  if (cachedResponseString) {
    const cachedResponse: z.infer<typeof PermissionSchema> =
      JSON.parse(cachedResponseString);
    return cachedResponse;
  }

  if (user.roleId) {
    const roleFound = await db.query.role.findFirst({
      where: eq(role.id, user.roleId),
    });

    if (roleFound?.permissions && user?.permissions) {
      try {
        const permissions = PermissionSchema.parse(roleFound.permissions);

        const merged = mergePermissions(permissions, user.permissions);

        await redis.set(
          `user_permissions|${user.id}`,
          JSON.stringify(merged),
          "EX",
          3600,
        );

        return merged;
      } catch (e) {
        if (e instanceof ZodError) {
          throw new TRPCError({
            code: "PARSE_ERROR",
            message: e.toString(),
          });
        }
      }
    }
    if (roleFound?.permissions) {
      const permissions = PermissionSchema.parse(roleFound.permissions);
      await redis.set(
        `user_permissions|${user.id}`,
        JSON.stringify(permissions),
        "EX",
        3600,
      );

      return permissions;
    }
  }
  if (user?.permissions) {
    await redis.set(
      `user_permissions|${user.id}`,
      JSON.stringify(user.permissions),
      "EX",
      3600,
    );

    return user.permissions;
  }
  return [];
};

export const getAllTags = async (
  redis: Redis,
  db: PostgresJsDatabase<typeof schema>,
) => {
  await redis.del("tags");
  const cachedTagsString = await redis.get("tags");
  if (cachedTagsString) {
    const cachedTags: typeof tags = JSON.parse(cachedTagsString);
    return cachedTags;
  }

  const tags = await db.query.tag.findMany({
    with: {
      children: true,
    },
  });

  if (tags) {
    await redis.set("tags", JSON.stringify(tags), "EX", 3600);
  }
  return tags;
};

export const getAllEntities = async (
  redis: Redis,
  db: PostgresJsDatabase<typeof schema>,
) => {
  const cachedEntities: string | null = await redis.get("entities");

  if (cachedEntities) {
    const parsedEntities: typeof entities = JSON.parse(cachedEntities);

    return parsedEntities;
  }

  const entities = await db.query.entities.findMany({
    with: {
      tag: true,
      operadorAsociadoEntity: true,
      sucursalOrigenEntity: true,
    },
    columns: {
      id: true,
      name: true,
    },
  });

  if (!entities)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Entities returned empty from database",
    });

  const mainTag = (await getGlobalSettings(redis, db, "mainTag")) as {
    name: string;
    data: { tag: string };
  };

  const tags = await getAllTags(redis, db);

  const mainTags = getAllChildrenTags(mainTag.data.tag, tags);

  const sortedEntities = entities.sort((a, b) => {
    if (mainTags.includes(a.tag.name) && !mainTags.includes(b.tag.name)) {
      return -1;
    } else if (
      !mainTags.includes(a.tag.name) &&
      mainTags.includes(b.tag.name)
    ) {
      return 1;
    } else {
      return 0;
    }
  });

  await redis.set("entities", JSON.stringify(sortedEntities), "EX", 3600);

  return sortedEntities;
};

export const logIO = async (
  dynamodbClient: typeof dynamodb,
  userId: string,
  name: string,
  input: object,
  output: object,
): Promise<void> => {
  const { client, PutCommand, tableName } = dynamodbClient;

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: "log",
        sk: Date.now().toString(),
        userId,
        name,
        input,
        output,
      },
    }),
  );
};

export const settingEnum = z.enum(["accountingPeriod", "mainTag"]);

const accountingPeriodSchema = z.object({
  name: z.literal(settingEnum.enum.accountingPeriod),
  data: z.object({
    months: z.number().positive().int(),
    graceDays: z
      .number()
      .int()
      .refine((n) => n >= 0),
  }),
});

const mainTagSettingSchema = z.object({
  name: z.literal(settingEnum.enum.mainTag),
  data: z.object({
    tag: z.string(),
  }),
});

export const globalSettingSchema = z.union([
  accountingPeriodSchema,
  mainTagSettingSchema,
]);

export const getGlobalSettings = async (
  redis: Redis,
  db: PostgresJsDatabase<typeof schema>,
  setting: z.infer<typeof settingEnum>,
) => {
  const cachedResponseString = await redis.get(`globalSetting|${setting}`);

  if (cachedResponseString) {
    const cachedResponse = globalSettingSchema.safeParse(
      JSON.parse(cachedResponseString),
    );

    if (!cachedResponse.success) {
      throw new TRPCError({
        code: "PARSE_ERROR",
        message: cachedResponse.error.message,
      });
    }

    return cachedResponse.data;
  }

  const [response] = await db
    .select()
    .from(globalSettings)
    .where(eq(globalSettings.name, setting))
    .limit(1);

  if (!response) {
    if (setting === settingEnum.enum.accountingPeriod) {
      return {
        name: settingEnum.enum.accountingPeriod,
        data: { months: 1, graceDays: 10 },
      };
    }
    if (setting === settingEnum.enum.mainTag) {
      return {
        name: settingEnum.enum.mainTag,
        data: { tag: env.MAIN_NAME },
      };
    }
  }

  const parsedResponse = globalSettingSchema.safeParse(response);

  if (!parsedResponse.success) {
    throw new TRPCError({
      code: "PARSE_ERROR",
      message: parsedResponse.error.message,
    });
  }

  await redis.set(
    `globalSetting|${setting}`,
    JSON.stringify(parsedResponse.data),
    "EX",
    7200,
  );

  return parsedResponse.data;
};

export const deletePattern = async (redis: Redis, pattern: string) => {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(keys);
  }
};
