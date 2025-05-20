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
    relatedTxId: z.number().int().optional(),
    metadata: z.object({ exchange_rate: z.number().optional() }).optional(),
    status: z.boolean().default(false).optional(),
    category: z.string().optional(),
    subCategory: z.string().optional(),
  }),
);

const dateType = z.discriminatedUnion("date", [
  z.object({ date: z.literal("now") }),
  z.object({
    date: z.literal("custom"),
    data: z.object({ opDate: z.date(), opTime: z.string() }),
  }),
]);

export type SingleTransactionInStoreSchema = z.infer<
  typeof TransactionsStoreSchema
>[number];

interface OperationStore {
  transactionsStore: SingleTransactionInStoreSchema[];
  opDate: z.infer<typeof dateType>;
  setOpDate: (date: z.infer<typeof dateType>) => void;
  observations: string;
  setObservations: (observations: string) => void;
  resetTransactionsStore: () => void;
  addTransactionToStore: (transaction: SingleTransactionInStoreSchema) => void;
  removeTransactionFromStore: (txId: number) => void;
  confirmationAtUpload: number[];
  setConfirmationAtUpload: (txId: number) => void;
  resetConfirmationAtUpload: () => void;
  removeConfirmationAtUpload: (txId: number) => void;
  setAllConfirmationAtUpload: (bool: boolean) => void;
  isInitialDataSubmitted: boolean;
  setIsInitialDataSubmitted: (bool: boolean) => void;
  resetOperationData: () => void;
}

export const useTransactionsStore = create<OperationStore>((set) => ({
  transactionsStore: [],
  opDate: { date: "now" },
  setOpDate: (date) => {
    set(() => ({ opDate: date }));
  },
  observations: "",
  setObservations: (obs) => {
    set(() => ({ observations: obs }));
  },
  isInitialDataSubmitted: false,
  setIsInitialDataSubmitted: (bool) => {
    set(() => ({ isInitialDataSubmitted: bool }));
  },
  resetOperationData: () => {
    set(() => ({ observations: "", opDate: { date: "now" } }));
  },
  resetTransactionsStore: () => {
    set(() => ({
      transactionsStore: [],
    }));
  },
  addTransactionToStore: (newTransaction) => {
    set((state) => {
      return {
        transactionsStore: [...state.transactionsStore, newTransaction],
      };
    });
  },
  removeTransactionFromStore: (txId) => {
    set((state) => {
      const newStore = state.transactionsStore
        .filter((transaction) => transaction.txId !== txId)
        .map((transaction) =>
          transaction.txId > txId
            ? { ...transaction, txId: transaction.txId - 1 }
            : transaction,
        );
      return {
        transactionsStore: newStore,
      };
    });
  },
  confirmationAtUpload: [],
  setConfirmationAtUpload: (txId) => {
    set((state) => {
      if (state.confirmationAtUpload.includes(txId)) {
        return {
          confirmationAtUpload: state.confirmationAtUpload.filter(
            (n) => n !== txId,
          ),
        };
      } else {
        return { confirmationAtUpload: [...state.confirmationAtUpload, txId] };
      }
    });
  },
  setAllConfirmationAtUpload: (bool) => {
    set((state) => {
      if (bool) {
        const cambioIds = state.transactionsStore
          .filter((tx) => tx.type === "cambio")
          .map((tx) => tx.txId);
        return { confirmationAtUpload: cambioIds };
      } else {
        return { confirmationAtUpload: [] };
      }
    });
  },
  resetConfirmationAtUpload: () => set({ confirmationAtUpload: [] }),
  removeConfirmationAtUpload: (txId) => {
    set((state) => {
      const newData = state.confirmationAtUpload.filter((n) => n !== txId);
      return { confirmationAtUpload: newData };
    });
  },
}));
