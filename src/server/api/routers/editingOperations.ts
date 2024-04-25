import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { findDifferences } from "~/lib/functions";
import { generateMovements, getAllEntities, logIO, undoMovements } from "~/lib/trpcFunctions";
import {
  Status,
  entities,
  operations,
  transactions,
  transactionsMetadata,
} from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";
import { currentAccountOnlyTypes } from "~/lib/variables";
import { alias } from "drizzle-orm/pg-core";

export const editingOperationsRouter = createTRPCRouter({
  updateTransactionValues: protectedProcedure
    .input(
      z.object({
        txId: z.number().int(),
        newTransactionData: z.object({
          fromEntityId: z.number(),
          toEntityId: z.number(),
          operatorEntityId: z.number(),
          currency: z.string(),
          amount: z.number(),
        }),
        oldTransactionData: z.object({
          fromEntityId: z.number(),
          toEntityId: z.number(),
          operatorEntityId: z.number(),
          currency: z.string(),
          amount: z.number(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.transaction(async (transaction) => {
        const [historyResponse2] = await transaction
          .select({ history: transactionsMetadata.history })
          .from(transactionsMetadata)
          .where(eq(transactionsMetadata.transactionId, input.txId));

        const oldHistoryJson2 = historyResponse2?.history;

        const changesMade = findDifferences(
          input.oldTransactionData,
          input.newTransactionData,
          ctx.user.id,
        );

        // @ts-ignore
        let newHistoryJson2 = [];

        if (
          oldHistoryJson2 &&
          typeof oldHistoryJson2 === "object" &&
          Array.isArray(oldHistoryJson2)
        ) {
          newHistoryJson2 = [...oldHistoryJson2, changesMade];
        } else if (oldHistoryJson2 !== undefined) {
          newHistoryJson2 = [changesMade];
        }

        const [newTxObj] = await transaction
          .update(transactions)
          .set({
            fromEntityId: input.newTransactionData.fromEntityId,
            toEntityId: input.newTransactionData.toEntityId,
            operatorEntityId: input.newTransactionData.operatorEntityId,
            currency: input.newTransactionData.currency,
            amount: input.newTransactionData.amount,
          })
          .where(eq(transactions.id, input.txId)).returning({ id: transactions.id, operationId: transactions.operationId });

        if (!newTxObj) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Transaction to update not found"
          })
        }
        await transaction
          .update(transactionsMetadata)
          .set({
            // @ts-ignore
            history: newHistoryJson2,
          })
          .where(eq(transactionsMetadata.transactionId, input.txId));

        const entitiesData = await getAllEntities(ctx.redis, ctx.db)

        const toEntityObj = entitiesData.find(e => e.id === input.oldTransactionData.toEntityId)

        if (!toEntityObj) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La entidad con ID ${input.oldTransactionData.toEntityId} no fue encontrada`
          })
        }

        const [opData] = await transaction.select().from(operations).where(eq(operations.id, newTxObj.operationId))

        const deletedMovements = await undoMovements(transaction, { id: newTxObj.id, fromEntity: { id: input.oldTransactionData.fromEntityId }, toEntity: { id: toEntityObj.id, tagName: toEntityObj.tag.name }, currency: input.oldTransactionData.currency, amount: input.oldTransactionData.amount, operation: { date: opData!.date } })

        const fromEntity = alias(entities, "fromEntity");
        const toEntity = alias(entities, "toEntity");

        const [newTxResponse] = await transaction.select().from(transactions)
          .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
          .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
          .leftJoin(operations, eq(transactions.operationId, operations.id))
          .where(eq(transactions.id, newTxObj.id))

        const txForMovement = { ...newTxResponse!.Transactions, fromEntity: newTxResponse!.fromEntity!, toEntity: newTxResponse!.toEntity!, operation: newTxResponse!.Operations! }

        const filteredMovements = deletedMovements.filter(mv => mv.entitiesMovementId === null)

        // Filtro para loopear los movimientos originales, no los que hacen referencia a los originales
        for (const deletedMovement of filteredMovements) {
          await generateMovements(transaction, txForMovement, deletedMovement.account, deletedMovement.direction, deletedMovement.type)
        }


        return newTxResponse!.Transactions
      });

      if (response) {
        await logIO(
          ctx.dynamodb,
          ctx.user.id,
          "Actualizar transacción",
          input,
          response,
        );
      }
      return response;
    }),

  updateTransactionStatus: protectedLoggedProcedure
    .input(
      z.object({
        transactionIds: z.array(z.number().int()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const response = await ctx.db.transaction(async (transaction) => {
          const confirmedTxs = []

          const fromEntity = alias(entities, "fromEntity");
          const toEntity = alias(entities, "toEntity");

          for (const txId of input.transactionIds) {
            const [transactionData] = await transaction.select().from(transactions)
              .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
              .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
              .leftJoin(operations, eq(transactions.operationId, operations.id))
              .where(eq(transactions.id, txId))

            if (!transactionData || !transactionData.Operations) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Transaction ${txId} does not exist`
              })
            }

            if (transactionData.Transactions.status !== Status.enumValues[2] || currentAccountOnlyTypes.has(transactionData.Transactions.type)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "This transaction cannot be confirmed"
              })
            }
            await transaction
              .update(transactions)
              .set({
                status: "confirmed",
              })
              .where(eq(transactions.id, txId));

            await transaction
              .update(transactionsMetadata)
              .set({
                confirmedBy: ctx.user.id,
                confirmedDate: new Date(),
              })
              .where(eq(transactionsMetadata.transactionId, txId));

            const mappedTransaction = { ...transactionData.Transactions, operation: { date: transactionData.Operations.date }, fromEntity: transactionData.fromEntity!, toEntity: transactionData.toEntity! }

            await generateMovements(transaction, mappedTransaction, false, 1, "confirmation");
            await generateMovements(transaction, mappedTransaction, true, 1, "confirmation");

            confirmedTxs.push(mappedTransaction.id)
          }

          return confirmedTxs;
        });

        await logIO(
          ctx.dynamodb,
          ctx.user.id,
          "Confirmar transacción",
          input,
          response,
        );

        return response;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
        });
      }
    }),
  cancelTransaction: protectedLoggedProcedure
    .input(
      z.object({
        transactionId: z.number().int().optional(),
        operationId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.transaction(async (transaction) => {
        const transactionsToCancel = await transaction.query.transactions.findMany({
          where: and(
            input.transactionId
              ? eq(transactions.id, input.transactionId)
              : undefined,
            input.operationId
              ? eq(transactions.operationId, input.operationId)
              : undefined,
          ),
          with: {
            operation: true,
            movements: true,
            fromEntity: true,
            toEntity: true
          }
        })

        // Transaction cancellation
        await transaction.update(transactions).set({ status: Status.enumValues[0] }).where(inArray(transactions.id, transactionsToCancel.map(tx => tx.id)))

        if (input.transactionId) {
          await transaction
            .update(transactionsMetadata)
            .set({
              cancelledBy: ctx.user.id,
              cancelledDate: new Date(),
            })
            .where(eq(transactionsMetadata.transactionId, input.transactionId));
        } else if (input.operationId) {
          const relatedTxIds = await transaction
            .select({ id: transactions.id })
            .from(transactions)
            .where(eq(transactions.operationId, input.operationId));
          await transaction
            .update(transactionsMetadata)
            .set({
              cancelledBy: ctx.user.id,
              cancelledDate: new Date(),
            })
            .where(
              inArray(
                transactionsMetadata.transactionId,
                relatedTxIds.map((obj) => obj.id),
              ),
            );
        }

        // Para cancelar, vamos a crear los mismos movimientos con los datos de la transaccion invertidos
        for (const tx of transactionsToCancel) {
          for (const mv of tx.movements.filter(m => m.entitiesMovementId === null)) {
            await generateMovements(transaction, tx, mv.account, mv.direction * (-1), "cancellation")
          }
        }

        return transactionsToCancel
      });

      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Cancelar transacciones",
        input,
        response,
      );

      return response;
    }),
  changeOpData: protectedProcedure.input(z.object({
    opId: z.number(),
    opObservations: z.string().optional(),
    oldOpDate: z.date(),
    opDate: z.date()
  })).mutation(async ({ ctx, input }) => {
    const response = await ctx.db.transaction(async (transaction) => {
      const [updatedOperation] = await transaction.update(operations)
        .set({ observations: input.opObservations, date: input.opDate }).where(eq(operations.id, input.opId)).returning()

      if (input.oldOpDate.valueOf() !== input.opDate.valueOf()) {
        const fromEntity = alias(entities, "fromEntity")
        const toEntity = alias(entities, "toEntity")
        const relatedTxs = await transaction.select().from(transactions)
          .leftJoin(fromEntity, eq(fromEntity.id, transactions.fromEntityId))
          .leftJoin(toEntity, eq(toEntity.id, transactions.toEntityId))
          .where(eq(transactions.operationId, input.opId))

        for (const relatedTx of relatedTxs) {
          const deletedMvs = await undoMovements(transaction, { ...relatedTx.Transactions, operation: { date: input.oldOpDate }, fromEntity: relatedTx.fromEntity!, toEntity: relatedTx.toEntity! })

          const filteredMovements = deletedMvs.filter(mv => mv.entitiesMovementId === null)

          for (const deletedMv of filteredMovements) {
            await generateMovements(transaction, { ...relatedTx.Transactions, fromEntity: relatedTx.fromEntity!, toEntity: relatedTx.toEntity!, operation: { date: input.opDate } }, deletedMv.account, deletedMv.direction, deletedMv.type)
          }
        }
      }

      return updatedOperation
    })

    return response
  })
});
