import z from "zod";
import { create } from "zustand";
import { getCurrentTime } from "~/lib/functions";

export const InitialOperationStoreSchema = z.object({
  opDate: z.date(),
  opTime: z.string().optional(),
  opObservations: z.string().optional(),
});

interface InitialOperationStore {
  initialOperationStore: z.infer<typeof InitialOperationStoreSchema>;
  resetInitialOperationStore: () => void;
  isInitialOperationSubmitted: boolean;
  setInitialOperationStore: (
    newOperation: z.infer<typeof InitialOperationStoreSchema>,
  ) => void;
  setIsInitialOperationSubmitted: (isSubmitted: boolean) => void;
}

export const useInitialOperationStore = create<InitialOperationStore>()(
  (set) => ({
    initialOperationStore: {
      opDate: new Date(),
      opTime: getCurrentTime(),
      opObservations: "",
    },
    resetInitialOperationStore: () => {
      set(() => ({
        initialOperationStore: {
          opDate: new Date(),
          opTime: getCurrentTime(),
          opObservations: "",
        },
      }));
    },
    isInitialOperationSubmitted: false,
    setInitialOperationStore: (newOperation) => {
      set(() => {
        return { initialOperationStore: newOperation };
      });
    },
    setIsInitialOperationSubmitted: (isSubmitted) => {
      set(() => ({ isInitialOperationSubmitted: isSubmitted }));
    },
  }),
);
