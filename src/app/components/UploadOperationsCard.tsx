import Link from "next/link";

import { Button } from "~/app/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import { cn } from "~/lib/utils";

type CardProps = React.ComponentProps<typeof Card>;

export function UploadOperationsCard({ className, ...props }: CardProps) {
  return (
    <Card className={cn("w-[380px]", className)} {...props}>
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
}
