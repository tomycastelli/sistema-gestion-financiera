import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "~/env.mjs";
import {
  getGlobalSettings,
  globalSettingSchema,
  settingEnum,
} from "~/lib/trpcFunctions";
import { globalSettings } from "~/server/db/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const globalSettingsRouter = createTRPCRouter({
  getMainName: publicProcedure.query(() => {
    return env.MAIN_NAME;
  }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db.select().from(globalSettings);

    const foundPeriod = response.find((obj) => obj.name === "accountingPeriod");
    const foundMainTag = response.find((obj) => obj.name === "mainTag");
    const foundBlockOperators = response.find(
      (obj) => obj.name === "blockOperators",
    );

    if (!foundPeriod) {
      response.push({
        name: "accountingPeriod",
        data: { months: 1, graceDays: 10 },
      });
    }
    if (!foundMainTag) {
      response.push({
        name: "mainTag",
        data: { tag: env.MAIN_NAME },
      });
    }
    if (!foundBlockOperators) {
      response.push({
        name: "blockOperators",
        data: { enabled: false },
      });
    }

    const parsedResponse = globalSettingSchema.array().safeParse(response);

    if (!parsedResponse.success) {
      throw new TRPCError({
        code: "PARSE_ERROR",
        message: parsedResponse.error.message,
      });
    }

    return parsedResponse.data;
  }),
  get: publicProcedure
    .input(z.object({ name: settingEnum }))
    .query(async ({ ctx, input }) => {
      const response = await getGlobalSettings(ctx.redis, ctx.db, input.name);

      return response;
    }),
  set: protectedProcedure
    .input(globalSettingSchema)
    .mutation(async ({ ctx, input }) => {
      // Only admins can modify global settings
      const hasAdminPermission = ctx.user.permissions?.some(
        (p) => p.name === "ADMIN",
      );

      if (!hasAdminPermission) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Solo los administradores pueden modificar la configuración global",
        });
      }

      const [response] = await ctx.db
        .insert(globalSettings)
        .values(input)
        .onConflictDoUpdate({
          target: globalSettings.name,
          set: { data: input.data },
        })
        .returning();

      if (response) {
        await ctx.redis.del(`globalSetting|${response.name}`);
      }

      return response;
    }),
});
