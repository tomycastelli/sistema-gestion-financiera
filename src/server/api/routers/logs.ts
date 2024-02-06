import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const logsRouter = createTRPCRouter({
  getLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().int(),
        page: z.number().int(),
        cursor: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { client, QueryCommand, tableName } = ctx.dynamodb;

      const cursor = input.cursor
        ? JSON.parse(Buffer.from(input.cursor, "base64").toString("utf-8"))
        : undefined;

      const response = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pkValue",
          ExpressionAttributeValues: {
            ":pkValue": "log",
          },
          ScanIndexForward: false,
          Limit: input.limit,
          ExclusiveStartKey: cursor,
        }),
      );

      let nextCursor = null;

      if (response.LastEvaluatedKey) {
        nextCursor = Buffer.from(
          JSON.stringify(response.LastEvaluatedKey),
        ).toString("base64");
      }

      const logsSchema = z.array(
        z.object({
          pk: z.string(),
          sk: z.string(),
          name: z.string(),
          createdBy: z.string(),
          input: z.record(z.any()),
          output: z.record(z.any()),
        }),
      );

      return {
        logs: response.Items as z.infer<typeof logsSchema>,
        nextCursor,
        count: response.Count ?? 0,
      };
    }),
});
