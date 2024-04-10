import { create } from "zustand";

interface OperationsPageStoreSchema {
  txIdsStore: number[];
  changeTxIds: (id: number) => void;
  resetTxIds: () => void;
  selectedTxForMvs: number | undefined
  setSelectedTxForMvs: (id: number | undefined) => void
}

export const useOperationsPageStore = create<OperationsPageStoreSchema>(
  (set) => ({
    txIdsStore: [],
    changeTxIds: (id) => set((state) => ({
      txIdsStore: state.txIdsStore.includes(id) ? state.txIdsStore.filter(number => number !== id) : [...state.txIdsStore, id]
    })),
    resetTxIds: () => {
      set({ txIdsStore: [] });
    },
    selectedTxForMvs: undefined,
    setSelectedTxForMvs: (id) => set({ selectedTxForMvs: id })
  }),
);
