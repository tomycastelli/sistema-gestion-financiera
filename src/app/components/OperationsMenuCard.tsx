import Link from "next/link";
import { api } from "~/trpc/server";
import OperationsMenuBarChart from "./OperationsMenuBarChart";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const OperationsMenuCard = async ({ userId }: { userId: string }) => {
  const insights = await api.operations.insights.query({ userId: userId });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl">Operaciones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <Link
            href={"/operaciones/carga"}
            className="flex p-4 transition-all hover:border-l-8 hover:border-primary"
          >
            <h1 className="text-3xl font-semibold tracking-tight">Carga</h1>
          </Link>
          <Link
            href={"/operaciones/gestion"}
            className="flex p-4 transition-all hover:border-l-8 hover:border-primary"
          >
            <h1 className="text-3xl font-semibold tracking-tight">Gestión</h1>
          </Link>
          <div className="h-full w-full">
            <OperationsMenuBarChart data={insights.monthCount} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OperationsMenuCard;
