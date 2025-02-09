export type OperationsByUserResponse = {
  id: number;
  date: Date;
  observations: string | null;
  status: boolean;
  _count: {
    transactions: number;
  };
};

export type GroupedExchangeRate = {
  date: string;
  [key: string]: string | number | null;
};
