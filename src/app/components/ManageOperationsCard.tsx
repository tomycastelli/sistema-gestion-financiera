import Link from "next/link";

import { Button } from "~/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import { cn } from "~/lib/utils";

const data = [
  {
    title: "32",
    description: "Transacciones pendientes para confirmar",
  },
  {
    title: "58",
    description: "Transacciones modificadas",
  },
];

type CardProps = React.ComponentProps<typeof Card>;

export function ManageOperationsCard({ className, ...props }: CardProps) {
  return (
    <Card className={cn("w-[380px]", className)} {...props}>
      <CardHeader>
        <CardTitle>Gestionar</CardTitle>
        <CardDescription>Visualizá y gestioná operaciones</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          {data.map((item, index) => (
            <div
              key={index}
              className="mb-4 grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0"
            >
              <span className="flex h-2 w-2 translate-y-1 rounded-full bg-sky-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="w-full">
        <Link href={"/gestionar"} className="w-full">
          <Button className="w-full">Gestionar</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
