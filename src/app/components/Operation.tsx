import type { FC } from "react";
import type { RouterOutputs } from "~/trpc/shared";

interface OperationProps {
  operation: RouterOutputs["operations"]["getOperations"][number];
}

const Operation: FC<OperationProps> = ({ operation }) => {
  return (
    <div className="flex flex-col p-8">
      <h1>{operation.id}</h1>
      <h2>{operation.date.toLocaleDateString("es-AR")}</h2>
      <p>{operation.observations}</p>
    </div>
  );
};

export default Operation;
