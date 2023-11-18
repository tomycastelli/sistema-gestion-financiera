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

export function ManageOperationsCard({ className, ...props }: CardProps) {
  return (
    <Card className={cn("w-[380px]", className)} {...props}>
      <CardHeader>
        <CardTitle>Gestionar</CardTitle>
        <CardDescription>Visualizá y gestioná operaciones</CardDescription>
      </CardHeader>
      <CardFooter className="w-full">
        <Link href={"/operaciones/gestionar"} className="w-full">
          <Button className="w-full">Gestionar</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
