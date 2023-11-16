import { create } from "zustand";
import type { RouterInputs } from "~/trpc/shared";

type OperationsQueryInput = RouterInputs["operations"]["getOperations"];

type OperationsQueryInputStore = {
  operationsQueryInput: OperationsQueryInput;
  setOperationsQueryInput: (newInputs: Partial<OperationsQueryInput>) => void;
  setPage: (newPage: number) => void;
  resetOperationsQueryInput: () => void;
};

const useOperationsQueryInputStore = create<OperationsQueryInputStore>(
  (set) => ({
    operationsQueryInput: {
      limit: 8,
      page: 1,
    },
    setOperationsQueryInput: (newInputs) =>
      set((state) => ({
        operationsQueryInput: {
          ...state.operationsQueryInput,
          ...newInputs,
        },
      })),
    setPage: (newPage) =>
      set((state) => ({
        operationsQueryInput: {
          ...state.operationsQueryInput,
          page: Math.max(newPage, 1),
        },
      })),
    resetOperationsQueryInput: () =>
      set({
        operationsQueryInput: {
          limit: 8,
          page: 1,
        },
      }),
  }),
);

export default useOperationsQueryInputStore;
