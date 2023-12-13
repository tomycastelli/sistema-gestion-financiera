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
        <CardTitle>Gestión</CardTitle>
        <CardDescription>Visualizá y modifica operaciones</CardDescription>
      </CardHeader>
      <CardFooter className="w-full">
        <Link href={"/operaciones/gestion"} className="w-full">
          <Button className="w-full">Gestionar</Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default ManageOperationsCard;
