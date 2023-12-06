import { create } from "zustand";

type Timeframe = "daily" | "weekly" | "monthly" | "yearly";

interface TimeframeStore {
  selectedTimeframe: Timeframe;
  setTimeframe: (newTimeframe: Timeframe) => void;
  selectedCurrency: string;
  setSelectedCurrency: (newCurrency: string) => void;
}

export const useCuentasStore = create<TimeframeStore>((set) => ({
  selectedCurrency: "ars",
  setSelectedCurrency: (newCurrency: string) =>
    set({ selectedCurrency: newCurrency }),
  selectedTimeframe: "daily",
  setTimeframe: (newTimeframe: Timeframe) =>
    set({ selectedTimeframe: newTimeframe }),
}));
