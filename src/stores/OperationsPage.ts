import { create } from "zustand";

interface OperationsPageStoreSchema {
  txIdsStore: number[];
  changeTxIds: (id: number, txIdsStore: number[]) => boolean;
  resetTxIds: () => void;
}

export const useOperationsPageStore = create<OperationsPageStoreSchema>(
  (set) => ({
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
