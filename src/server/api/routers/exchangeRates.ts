import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { exchangeRates } from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  publicProcedure,
} from "../trpc";
import type { GroupedExchangeRate } from "./types";

export const exchangeRatesRouter = createTRPCRouter({
  getDateExchangeRates: publicProcedure
    .input(
      z.object({
        date: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.date) {
        return [];
      }

      const exchangeRatesData = await ctx.db
        .select()
        .from(exchangeRates)
        .where(eq(exchangeRates.date, input.date));

      return exchangeRatesData;
    }),
  getAllExchangeRates: publicProcedure
    .input(
      z.object({
        page: z.number().int(),
        fromDate: z.string().nullish(),
        toDate: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.page < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Page must be greater than 1 (was ${input.page})`,
        });
      }
      const pageSize = 12;

      // Get total count of distinct dates
      const [countObj] = await ctx.db
        .select({
          count: sql<number>`COUNT(DISTINCT ${exchangeRates.date})`,
        })
        .from(exchangeRates)
        .where(
          and(
            input.fromDate
              ? gte(exchangeRates.date, input.fromDate)
              : undefined,
            input.toDate ? lte(exchangeRates.date, input.toDate) : undefined,
          ),
        );

      // Get distinct dates for current page
      const distinctDates = await ctx.db
        .select({ date: exchangeRates.date })
        .from(exchangeRates)
        .where(
          and(
            input.fromDate
              ? gte(exchangeRates.date, input.fromDate)
              : undefined,
            input.toDate ? lte(exchangeRates.date, input.toDate) : undefined,
          ),
        )
        .orderBy(desc(exchangeRates.date))
        .groupBy(exchangeRates.date)
        .limit(pageSize)
        .offset((input.page - 1) * pageSize);

      const mappedDates = distinctDates.map((d) => d.date);

      // Get exchange rates for these dates
      const exchangeRatesData = await ctx.db
        .select()
        .from(exchangeRates)
        .where(inArray(exchangeRates.date, mappedDates))
        .orderBy(desc(exchangeRates.date));

      // Transform data into final format directly
      const groupedData = distinctDates.map((dateObj) => {
        const ratesForDate = exchangeRatesData.filter(
          (rate) => rate.date === dateObj.date,
        );

        return {
          date: dateObj.date,
          ...ratesForDate.reduce(
            (acc, rate) => ({
              ...acc,
              [rate.currency]: rate.rate,
            }),
            {},
          ),
        } as GroupedExchangeRate;
      });

      return {
        data: groupedData,
        totalDates: countObj!.count,
      };
    }),

  getLatestExchangeRates: publicProcedure
    .input(
      z.object({
        dayInPast: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rankedRates = ctx.db.$with("ranked_rates").as(
        ctx.db
          .select({
            currency: exchangeRates.currency,
            date: exchangeRates.date,
            rate: exchangeRates.rate,
            rn: sql`ROW_NUMBER() OVER (PARTITION BY ${exchangeRates.currency} ORDER BY ${exchangeRates.date} DESC)`.as(
              "rn",
            ),
          })
          .from(exchangeRates)
          .where(
            input.dayInPast
              ? sql`${exchangeRates.date} <= TO_CHAR(TO_DATE(${input.dayInPast}, 'DD-MM-YYYY'), 'YYYY-MM-DD')`
              : undefined,
          ),
      );

      const latestRates = await ctx.db
        .with(rankedRates)
        .select({
          currency: rankedRates.currency,
          date: rankedRates.date,
          rate: rankedRates.rate,
        })
        .from(rankedRates)
        .where(sql`${rankedRates.rn} = 1`);

      return latestRates;
    }),
  addExchangeRates: protectedLoggedProcedure
    .input(
      z
        .object({
          currency: z.string(),
          date: z.string(),
          rate: z.number(),
        })
        .array(),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !(
          ctx.user.permissions?.some(
            (p) => p.name === "ADMIN" || p.name === "UNIFIED_CURRENCIES_EDIT",
          ) ?? false
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User is not authorized to upload exchange rates",
        });
      }

      await ctx.db
        .insert(exchangeRates)
        .values(input)
        .onConflictDoUpdate({
          target: [exchangeRates.currency, exchangeRates.date],
          set: { rate: sql.raw(`excluded.${exchangeRates.rate.name}`) },
        });
    }),
  editExchangeRate: protectedLoggedProcedure
    .input(
      z.object({
        currency: z.string(),
        date: z.string(),
        rate: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !(
          ctx.user.permissions?.some(
            (p) => p.name === "ADMIN" || p.name === "UNIFIED_CURRENCIES_EDIT",
          ) ?? false
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User is not authorized to upload exchange rates",
        });
      }

      await ctx.db
        .update(exchangeRates)
        .set({ rate: input.rate })
        .where(
          and(
            eq(exchangeRates.currency, input.currency),
            eq(exchangeRates.date, input.date),
          ),
        );
    }),
  deleteExchangeRate: protectedLoggedProcedure
    .input(
      z.object({
        currency: z.string(),
        date: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(exchangeRates)
        .where(
          and(
            eq(exchangeRates.currency, input.currency),
            eq(exchangeRates.date, input.date),
          ),
        );
    }),
});
