import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const OperationsMenuCard = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-4xl">Entidades</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <Link
            href={"/entidades"}
            className="flex p-4 transition-all hover:border-l-8 hover:border-primary"
            prefetch={false}
          >
            <h1 className="text-3xl font-semibold tracking-tight">Gestión</h1>
          </Link>
          <Link
            href={"/entidades/grafico"}
            className="flex p-4 transition-all hover:border-l-8 hover:border-primary"
            prefetch={false}
          >
            <h1 className="text-3xl font-semibold tracking-tight">Gráfico</h1>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default OperationsMenuCard;
