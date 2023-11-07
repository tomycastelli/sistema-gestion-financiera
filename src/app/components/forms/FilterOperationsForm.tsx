import { z } from "zod";

const FormSchema = z.object({
  operationId: z.string().optional(),
  opDay: z.date().optional(),
  opDateIsGreater: z.date().optional(),
  opDateIsLesser: z.date().optional(),
  transactionId: z.number().optional(),
  transactionType: z.string().optional(),
  transactionDate: z.date().optional(),
  operatorEntityId: z.number().optional(),
  fromEntityId: z.number().optional(),
  toEntityId: z.number().optional(),
  currency: z.string().optional(),
  method: z.string().optional(),
  status: z.boolean().optional(),
  uploadedById: z.string().optional(),
});

const FilterOperationsForm = () => {
  return <div>FilterOperationsForm</div>;
};

export default FilterOperationsForm;
