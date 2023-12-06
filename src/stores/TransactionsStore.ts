import z from "zod";
import { create } from "zustand";

const TransactionsStoreSchema = z.array(
  z.object({
    txId: z.number().int(),
    type: z.string(),
    fromEntityId: z.number().int(),
    toEntityId: z.number().int(),
    operatorId: z.number().int(),
    currency: z.string(),
    amount: z.number(),
    method: z.string().optional(),
    metadata: z.object({ exchangeRate: z.number().optional() }).optional(),
    status: z.boolean().default(false).optional(),
  }),
);

export type SingleTransactionInStoreSchema = z.infer<
  typeof TransactionsStoreSchema
>[number];

interface OperationStore {
  transactionsStore: SingleTransactionInStoreSchema[];
  resetTransactionsStore: () => void;
  addTransactionToStore: (
    transaction: Omit<SingleTransactionInStoreSchema, "txId">,
  ) => void;
  removeTransactionFromStore: (txId: number) => void;
}

export const useTransactionsStore = create<OperationStore>((set) => ({
  transactionsStore: [],
  resetTransactionsStore: () => {
    set(() => ({
      transactionsStore: [],
    }));
  },
  addTransactionToStore: (transaction) => {
    set((state) => {
      const lastTxId =
        state.transactionsStore.length > 0
          ? state.transactionsStore[state.transactionsStore.length - 1]?.txId ??
            0
          : 0;
      const newTransaction = {
        ...transaction,
        txId: lastTxId + 1,
      };
      return {
        transactionsStore: [...state.transactionsStore, newTransaction],
      };
    });
  },
  removeTransactionFromStore: (txId) => {
    set((state) => {
      const newStore = state.transactionsStore.filter(
        (transaction) => transaction.txId !== txId,
      );
      return {
        transactionsStore: newStore,
      };
    });
  },
}));
