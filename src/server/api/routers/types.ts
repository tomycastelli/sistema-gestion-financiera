export type OperationsByUserResponse = {
  id: number;
  date: Date;
  observations: string | null;
  status: boolean;
  _count: {
    transactions: number;
  };
};
