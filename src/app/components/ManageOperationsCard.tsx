import Link from "next/link";

import { Button } from "~/app/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";

const ManageOperationsCard = () => {
  return (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Carga</CardTitle>
        <CardDescription>Visualizá y carga operaciones</CardDescription>
      </CardHeader>
      <CardFooter className="w-full">
        <Link href={"/operaciones/carga"} className="w-full">
          <Button className="w-full">Cargar nueva operación</Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default ManageOperationsCard;
