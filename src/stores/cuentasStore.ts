import { create } from "zustand";

type Timeframe = "day" | "week" | "month" | "year";

interface TimeframeStore {
  selectedTimeframe: Timeframe;
  setTimeframe: (newTimeframe: Timeframe) => void;
  selectedCurrency: string | undefined;
  setSelectedCurrency: (newCurrency: string | undefined) => void;
  movementsTablePage: number;
  setMovementsTablePage: (page: number) => void;
  originEntityId: number | undefined;
  setOriginEntityId: (id: number | undefined) => void;
  destinationEntityId: number | undefined;
  setDestinationEntityId: (id: number | undefined) => void;
  fromDate: Date | undefined;
  setFromDate: (date: Date | undefined) => void;
  toDate: Date | undefined;
  setToDate: (date: Date | undefined) => void;
  isInverted: boolean;
  setIsInverted: (isInverted: boolean) => void;
  timeMachineDate: Date | undefined;
  setTimeMachineDate: (date: Date | undefined) => void;
}

export const useCuentasStore = create<TimeframeStore>((set) => ({
  selectedCurrency: undefined,
  setSelectedCurrency: (newCurrency) => set({ selectedCurrency: newCurrency }),
  selectedTimeframe: "day",
  setTimeframe: (newTimeframe) => set({ selectedTimeframe: newTimeframe }),
  movementsTablePage: 1,
  setMovementsTablePage(page) {
    set({ movementsTablePage: page });
  },
  originEntityId: undefined,
  setOriginEntityId(id) {
    set({ originEntityId: id });
  },
  destinationEntityId: undefined,
  setDestinationEntityId(id) {
    set({ destinationEntityId: id });
  },
  fromDate: undefined,
  setFromDate(date) {
    set({ fromDate: date });
  },
  toDate: undefined,
  setToDate(date) {
    set({ toDate: date });
  },
  isInverted: false,
  setIsInverted(isInverted) {
    set({ isInverted });
  },
  timeMachineDate: undefined,
  setTimeMachineDate(date) {
    set({ timeMachineDate: date });
  },
}));
