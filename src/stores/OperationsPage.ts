import { create } from "zustand";

interface OperationsPageStoreSchema {
  pageStore: number;
  incrementPage: () => void;
  decrementPage: () => void;
  txIdsStore: number[];
  changeTxIds: (id: number, txIdsStore: number[]) => boolean;
  resetTxIds: () => void;
}

export const useOperationsPageStore = create<OperationsPageStoreSchema>(
  (set) => ({
    pageStore: 1,
    incrementPage: () => {
      set((state) => ({ pageStore: state.pageStore + 1 }));
    },
    decrementPage: () => {
      set((state) => ({ pageStore: state.pageStore - 1 }));
    },
    txIdsStore: [],
    changeTxIds: (id, txIdsStore) => {
      const index = txIdsStore.indexOf(id);
      let newTxIdsStore: number[];
      if (index !== -1) {
        newTxIdsStore = txIdsStore.filter((item) => item !== id);
      } else {
        newTxIdsStore = [...txIdsStore, id];
      }
      set({ txIdsStore: newTxIdsStore });
      return index === -1;
    },
    resetTxIds: () => {
      set({ txIdsStore: [] });
    },
  }),
);
