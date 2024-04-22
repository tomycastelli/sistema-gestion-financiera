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
  confirmationAtUpload: number[];
  setConfirmationAtUpload: (txId: number) => void;
  resetConfirmationAtUpload: () => void;
  removeConfirmationAtUpload: (txId: number) => void;
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
      ).map(transaction => transaction.txId > txId ? { ...transaction, txId: transaction.txId - 1 } : transaction)
      return {
        transactionsStore: newStore,
      };
    });
  },
  confirmationAtUpload: [],
  setConfirmationAtUpload: (txId) => {
    set((state) => {
      if (state.confirmationAtUpload.includes(txId)) {
        return { confirmationAtUpload: state.confirmationAtUpload.filter(n => n !== txId) }
      } else {
        return { confirmationAtUpload: [...state.confirmationAtUpload, txId] }
      }
    })
  },
  resetConfirmationAtUpload: () => set({ confirmationAtUpload: [] }),
  removeConfirmationAtUpload: (txId) => {
    set((state) => {
      const newData = state.confirmationAtUpload.filter(n => n !== txId)
      return { confirmationAtUpload: newData }
    })
  }
}));
