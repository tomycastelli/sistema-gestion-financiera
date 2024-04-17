import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { getGlobalSettings, globalSettingSchema, settingEnum } from "~/lib/trpcFunctions";
import { globalSettings } from "~/server/db/schema";


export const globalSettingsRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db.select().from(globalSettings)

    if (response.length === 0) {
      return [
        {
          name: "accountingPeriod",
          data: { months: 1, graceDays: 10 }
        },
        {
          name: "otherSetting",
          data: { example: true }
        }
      ]
    }

    const parsedResponse = globalSettingSchema.array().safeParse(response)

    if (!parsedResponse.success) {
      throw new TRPCError({
        code: "PARSE_ERROR",
        message: parsedResponse.error.message
      })
    }

    return parsedResponse.data
  }),
  get: protectedProcedure.input(z.object({ name: settingEnum })).query(async ({ ctx, input }) => {
    const response = await getGlobalSettings(ctx, input.name)

    return response
  }),
  set: protectedProcedure.input(globalSettingSchema).mutation(async ({ ctx, input }) => {
    const [response] = await ctx.db.insert(globalSettings).values(input)
      .onConflictDoUpdate({
        target: globalSettings.name,
        set: { data: input.data }
      }).returning()

    if (response) {
      await ctx.redis.del(`globalSetting|${response.name}`)
    }

    return response
  })
})
