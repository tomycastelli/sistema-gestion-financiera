import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { chat, chatToUsers, messages, user } from "~/server/db/schema";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { env } from "~/env.mjs";
import { alias } from "drizzle-orm/pg-core";

export const messagesRouter = createTRPCRouter({
  createChat: protectedProcedure.input(z.object({
    name: z.string().optional(),
    usersIds: z.set(z.string()).min(1, "Minimum length is 1 user")
  })).mutation(async ({ ctx, input }) => {
    if (input.usersIds.has(ctx.user.id)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Provided users ids set has the id of the requesting user"
      })
    }

    if (input.usersIds.size === 1) {
      const ctu1 = alias(chatToUsers, "ctu1")
      const ctu2 = alias(chatToUsers, "ctu2")

      const oneUser = Array.from(input.usersIds)

      const statement = sql`SELECT EXISTS (
                              SELECT 1
                              FROM ${chatToUsers} ctu1
                              WHERE ${ctu1.userId} = ${ctx.user.id}
                              AND NOT EXISTS (
                                SELECT 1
                                FROM ${chatToUsers} ctu2
                                WHERE ${ctu2.chatId} = ${ctu1.chatId}
                                AND ${ctu2.userId} <> ${ctx.user.id}
                                AND ${ctu2.userId} <> ${oneUser[0]}
                              )
                            );`

      const [res] = await ctx.db.execute(statement)

      const chatExists = z.object({ exists: z.boolean() }).safeParse(res)

      if (!chatExists.success) {
        throw new TRPCError({
          code: "PARSE_ERROR",
          message: chatExists.error.message
        })
      } else {
        if (chatExists.data.exists === true) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "There is already a chat between the two users"
          })
        }
      }
    }


    const response = await ctx.db.transaction(async (transaction) => {
      const [chatCreated] = await transaction.insert(chat).values({ name: input.name }).returning()

      if (!chatCreated) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Chat could not be created"
        })
      }

      input.usersIds.add(ctx.user.id)

      interface RelationsToInsert {
        chatId: number;
        userId: string;
      }

      const relationsToInsert: RelationsToInsert[] = []

      input.usersIds.forEach(str => relationsToInsert.push({ chatId: chatCreated.id, userId: str }))

      await transaction.insert(chatToUsers).values(relationsToInsert)

      return chatCreated

    })


    return response
  }),
  getUserChats: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db.transaction(async (transaction) => {
      const userChats = await transaction.select({ id: chatToUsers.chatId, unseenMessages: count(messages.id) })
        .from(chatToUsers)
        .leftJoin(messages, and(eq(chatToUsers.chatId, messages.chatId), gt(messages.timestamp, chatToUsers.lastConnection)))
        .where(eq(chatToUsers.userId, ctx.user.id))
        .groupBy(chatToUsers.chatId)

      const ids = userChats.length > 0 ? userChats.map(obj => obj.id) : [0]

      // Consigo los chats en donde aparece el usuario
      const otherUsersInChats = await transaction
        .select({ id: chatToUsers.chatId, name: chat.name, userId: user.id, userName: user.name }).from(chatToUsers)
        .leftJoin(chat, eq(chatToUsers.chatId, chat.id))
        .leftJoin(user, eq(chatToUsers.userId, user.id))
        .where(inArray(chatToUsers.chatId, ids))

      return { otherUsersInChats, userChats }

    })

    interface MappedChat {
      id: number;
      name: string | null;
      unseenMessages: number
      users: {
        id: string
        name: string
      }[];
    }

    const mappedChats = response.otherUsersInChats.filter(obj => obj.userId !== ctx.user.id).reduce((acc: MappedChat[], curr) => {
      const existingChat = acc.find(chat => chat.id === curr.id);

      if (existingChat) {
        existingChat.users.push({ id: curr.userId!, name: curr.userName! })
      } else {
        acc.push({
          id: curr.id,
          name: curr.name,
          unseenMessages: response.userChats.find(c => c.id === curr.id)?.unseenMessages ?? 0,
          users: [{ id: curr.userId!, name: curr.userName! }]
        })
      }
      return acc
    }, [])

    return mappedChats
  }),

  getChatHistory: protectedProcedure.input(z.object({ chatId: z.number(), limit: z.number().min(1), page: z.number().min(1) })).query(async ({ ctx, input }) => {
    const preparedWithPage = ctx.db.select({ id: messages.id, userId: messages.userId, timestamp: messages.timestamp, message: messages.message }).from(messages)
      .where(
        eq(messages.chatId, sql.placeholder("chat_id"))).orderBy(desc(messages.timestamp)).limit(sql.placeholder("queryLimit")).offset(sql.placeholder("queryPage")).prepare("getMessages")

    const preparedWithoutPage = ctx.db.select({ id: messages.id, userId: messages.userId, timestamp: messages.timestamp, message: messages.message }).from(messages)
      .where(
        eq(messages.chatId, sql.placeholder("chat_id"))).orderBy(desc(messages.timestamp)).limit(sql.placeholder("queryLimit")).prepare("getMessages")


    interface ResponseMessages {
      id: number;
      userId: string;
      timestamp: number;
      message: string;
    }

    let responseMessages: ResponseMessages[] = []

    // Choose what to query and what to send based on certain conditions
    // Undefined cursor means it is the first query done by the client

    // Query those messages from the cache and then query the remaining ones from database
    const redisMessageSchema = z.array(z.object({
      userid: z.string(),
      message: z.string(),
      timestamp: z.number()
    }))

    const redisMessagesStrings = await ctx.redis.zrange(`chat:${input.chatId}`, "+inf", "-inf", "BYSCORE", "REV", "LIMIT", (input.page - 1) * input.limit, (input.limit * input.page) - 1)

    if (redisMessagesStrings.length > 0) {

      const jsonParsedStrings = []

      for (const messageString of redisMessagesStrings) {
        jsonParsedStrings.push(JSON.parse(messageString))
      }

      const result = redisMessageSchema.safeParse(jsonParsedStrings)

      if (!result.success) {
        throw new TRPCError({
          code: "PARSE_ERROR",
          message: result.error.toString()
        })
      }

      // If cache had all required messages to send
      if ((input.limit - redisMessagesStrings.length) <= 0) {

        const fakeIdRedisMessages = result.data.map((redisMsg, index) => ({ id: index + 40, userId: redisMsg.userid, message: redisMsg.message, timestamp: redisMsg.timestamp }))

        responseMessages = fakeIdRedisMessages
      } else {
        const dbMessages = await preparedWithoutPage.execute({ chat_id: input.chatId, queryLimit: input.limit - redisMessagesStrings.length })

        const highestId = dbMessages[-1]?.id ?? 0
        const fakeIdRedisMessages = result.data.map((redisMsg, index) => ({ id: highestId + index + 1, userId: redisMsg.userid, message: redisMsg.message, timestamp: redisMsg.timestamp }))

        responseMessages = [...fakeIdRedisMessages, ...dbMessages]
      }
    } else {
      // Query all messages from database as there are none in cache
      const dbMessages = await preparedWithPage.execute({ chat_id: input.chatId, queryLimit: input.limit, queryPage: (input.page - 1) * input.limit })

      responseMessages = dbMessages
    }

    responseMessages = responseMessages.sort((a, b) => a.timestamp - b.timestamp)

    return responseMessages
  }),

  sendMessage: protectedProcedure.input(z.object({ chatId: z.number().int(), message: z.string(), timestamp: z.number() })).mutation(async ({ ctx, input }) => {
    try {
      const res = await fetch(env.CHAT_URL + `/message?chatId=${input.chatId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userid: ctx.user.id, timestamp: input.timestamp, message: input.message })
      })
      return res
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Post message request to chat server failed"
      })
    }
  }),
  deleteMessage: protectedProcedure.input(z.object({ chatId: z.number().int(), message: z.string(), timestamp: z.number() })).mutation(async ({ ctx, input }) => {
    const [response] = await ctx.db.delete(messages).where(and(
      eq(messages.chatId, input.chatId),
      eq(messages.userId, ctx.user.id),
      eq(messages.message, input.message),
      eq(messages.timestamp, input.timestamp)
    )).returning()
    if (response) {
      return response
    } else {
      try {
        const res = await fetch(env.CHAT_URL + `/message?chatId=${input.chatId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ userid: ctx.user.id, timestamp: input.timestamp, message: input.message })
        })

        return res
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Delete message request to the chat server failed"
        })
      }
    }
  }),
  updateChatLastConnection: protectedProcedure.input(z.object({ chatId: z.number().int(), userId: z.string(), lastConnection: z.number().int() })).mutation(async ({ ctx, input }) => {
    const [updatedChat] = await ctx.db.update(chatToUsers).set({ lastConnection: input.lastConnection }).where(and(
      eq(chatToUsers.chatId, input.chatId),
      eq(chatToUsers.userId, input.userId)
    )).returning()

    return updatedChat
  })
})

