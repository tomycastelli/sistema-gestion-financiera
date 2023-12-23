import { create } from "zustand";

type Timeframe = "day" | "week" | "month" | "year";

interface TimeframeStore {
  selectedTimeframe: Timeframe;
  setTimeframe: (newTimeframe: Timeframe) => void;
  selectedCurrency: string | undefined;
  setSelectedCurrency: (newCurrency: string | undefined) => void;
  movementsTablePage: number;
  setMovementsTablePage: (page: number) => void;
  destinationEntityId: number | undefined;
  setDestinationEntityId: (id: number | undefined) => void;
}

export const useCuentasStore = create<TimeframeStore>((set) => ({
  selectedCurrency: undefined,
  setSelectedCurrency: (newCurrency: string | undefined) =>
    set({ selectedCurrency: newCurrency }),
  selectedTimeframe: "day",
  setTimeframe: (newTimeframe: Timeframe) =>
    set({ selectedTimeframe: newTimeframe }),
  movementsTablePage: 1,
  setMovementsTablePage(page: number) {
    set({ movementsTablePage: page });
  },
  destinationEntityId: undefined,
  setDestinationEntityId(id: number | undefined) {
    set({ destinationEntityId: id });
  },
}));
