import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";

const accountsListsSchema = z.array(
  z.object({
    id: z.number().int(),
    idList: z.array(z.number()),
    isDefault: z.boolean(),
  }),
);

export const userPreferencesRouter = createTRPCRouter({
  addPreference: protectedLoggedProcedure
    .input(
      z.object({
        userId: z.string(),
        preference: z.object({ key: z.string(), value: z.any() }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { client, PutCommand, tableName, GetCommand, UpdateCommand } =
        ctx.dynamodb;

      if (input.preference.key === "accountsLists") {
        const accountsLists = accountsListsSchema.parse(input.preference.value);
        const getResponse = await client.send(
          new GetCommand({
            TableName: tableName,
            Key: {
              pk: `userId|${input.userId}`,
              sk: `userPreference|${input.preference.key}`,
            },
          }),
        );
        if (!getResponse.Item) {
          const putResponse = await client.send(
            new PutCommand({
              TableName: tableName,
              Item: {
                pk: `userId|${input.userId}`,
                sk: `userPreference|${input.preference.key}`,
                accountsLists,
              },
            }),
          );
          return putResponse;
        } else {
          const updateResponse = await client.send(
            new UpdateCommand({
              TableName: tableName,
              Key: {
                pk: `userId|${input.userId}`,
                sk: `userPreference|${input.preference.key}`,
              },
              UpdateExpression: "set accountsLists = :valueToPass",
              ExpressionAttributeValues: {
                ":valueToPass": input.preference.value,
              },
            }),
          );

          return updateResponse;
        }
      }
    }),
  getPreference: protectedProcedure
    .input(z.object({ userId: z.string(), preferenceKey: z.string() }))
    .query(async ({ ctx, input }) => {
      const { client, GetCommand, tableName } = ctx.dynamodb;

      const response = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            pk: `userId|${input.userId}`,
            sk: `userPreference|${input.preferenceKey}`,
          },
        }),
      );

      if (input.preferenceKey === "accountsLists" && response.Item) {
        try {
          const preference = accountsListsSchema.parse(
            response.Item.accountsLists,
          );
          return preference;
        } catch (error) {
          throw new TRPCError({
            message: "Preference schema is not correct",
            code: "UNPROCESSABLE_CONTENT",
          });
        }
      }
    }),
});
