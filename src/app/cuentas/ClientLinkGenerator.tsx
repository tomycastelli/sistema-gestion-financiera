"use client";

import moment from "moment";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { generateLink } from "~/lib/functions";
import { api } from "~/trpc/react";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useToast } from "../components/ui/use-toast";

interface ClientLinkGeneratorProps {
  selectedEntityString: string;
}

const ClientLinkGenerator = ({
  selectedEntityString,
}: ClientLinkGeneratorProps) => {
  const { toast } = useToast();
  const [expiryTime, setExpiryTime] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const utils = api.useContext();
  const { mutateAsync } = api.shareableLinks.createLink.useMutation({
    async onSuccess() {
      await utils.shareableLinks.getLinksByEntityId.refetch();
    },
  });
  const { data: sharedLinks, isLoading } =
    api.shareableLinks.getLinksByEntityId.useQuery({
      sharedEntityId: parseInt(selectedEntityString),
    });

  const pathname = usePathname();

  const handleSubmit = async () => {
    let expiryTimeInDays = 0;
    if (expiryTime === "dia") {
      expiryTimeInDays = 1;
    } else if (expiryTime === "semana") {
      expiryTimeInDays = 7;
    } else if (expiryTime === "mes") {
      expiryTimeInDays = 30;
    } else if (expiryTime === "ilimitado") {
      expiryTimeInDays = 730;
    }

    const expiryTimeDate = moment().add(expiryTimeInDays, "days").toDate();
    const data = await mutateAsync({
      sharedEntityId: parseInt(selectedEntityString),
      expiration: expiryTimeDate,
    });
    setIsOpen(false);

    if (data?.id !== undefined) {
      const link = generateLink({
        selectedClient: selectedEntityString,
        linkId: data.id,
        linkToken: data.password,
      });
      toast({
        title: "Link generado exitosamente",
        description: `${pathname}?${link}`,
        variant: "success",
      });

      await navigator.clipboard.writeText(link);
    }
  };

  return (
    <div>
      <DropdownMenu open={isOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            className="rounded-xl border-transparent bg-transparent p-1 text-black hover:text-white"
            onClick={() => setIsOpen(true)}
          >
            <Icons.shareLink className="h-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          onEscapeKeyDown={() => setIsOpen(false)}
          onInteractOutside={() => setIsOpen(false)}
        >
          <DropdownMenuLabel className="flex flex-row items-center">
            <p className="mr-2">Expiración</p>
            <Icons.stopWatch className="h-5" />
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={expiryTime}
            onValueChange={setExpiryTime}
          >
            <DropdownMenuRadioItem value="dia">
              <span>1 día</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="semana">
              <span>1 semana</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="mes">
              <span>1 mes</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ilimitado">
              <span>Ilimitado</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={expiryTime.length === 0}
            onClick={() => handleSubmit()}
          >
            <Icons.plus className="h-4" />
            <span>Generar link</span>
          </DropdownMenuItem>
          <DropdownMenuGroup>
            {isLoading ? (
              <p>Cargando links...</p>
            ) : (
              sharedLinks?.map((link) => (
                <DropdownMenuItem key={link.id}>
                  <Link
                    target="_blank"
                    href={
                      pathname +
                      "?" +
                      generateLink({
                        selectedClient: selectedEntityString,
                        linkId: link.id,
                        linkToken: link.password,
                      })
                    }
                  >
                    <p className="text-slate-300">
                      {link.id}{" "}
                      <span className="ml-2 font-semibold text-black">
                        {link.expiration?.toLocaleDateString("es-AR")}
                      </span>{" "}
                    </p>
                  </Link>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ClientLinkGenerator;
