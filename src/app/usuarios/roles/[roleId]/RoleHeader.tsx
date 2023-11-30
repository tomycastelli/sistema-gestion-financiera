"use client";

import { type FC } from "react";
import { Separator } from "~/app/components/ui/separator";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

interface RoleHeaderProps {
  initialRole: RouterOutputs["roles"]["getById"];
}

const RoleHeader: FC<RoleHeaderProps> = ({ initialRole }) => {
  const { data: role } = api.roles.getById.useQuery(
    { id: initialRole!.id },
    { initialData: initialRole!, refetchOnWindowFocus: false },
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{role!.name}</h1>
      <p className="text-muted-foreground">
        {
          // @ts-ignore
          role.permissions.length
        }{" "}
        permisos
      </p>
      <p className="text-muted-foreground">
        {role!.users ? role!.users.length : 0} usuarios
      </p>
      <Separator className={`bg-${role!.color} mt-2`} />
    </div>
  );
};

export default RoleHeader;
