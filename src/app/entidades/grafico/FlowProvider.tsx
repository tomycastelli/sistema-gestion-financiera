"use client";

import { ReactFlowProvider } from "reactflow";
import { type RouterOutputs } from "~/trpc/shared";
import Flow from "./Flow";

interface FlowProviderProps {
  initialTags: RouterOutputs["tags"]["getAll"];
  initialEntities: RouterOutputs["entities"]["getAll"];
}

const FlowProvider = ({ initialEntities, initialTags }: FlowProviderProps) => {
  return (
    <div className="h-[41rem] rounded-xl border border-muted-foreground">
      <ReactFlowProvider>
        <Flow initialEntities={initialEntities} initialTags={initialTags} />
      </ReactFlowProvider>
    </div>
  );
};

export default FlowProvider;
