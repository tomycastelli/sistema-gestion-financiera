"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "~/app/components/ui/Icons";
import { Separator } from "~/app/components/ui/separator";
import { capitalizeFirstLetter } from "~/lib/functions";
import { cn } from "~/lib/utils";

const DocsTree = ({ fileNames }: { fileNames: string[] }) => {
  const pathname = usePathname();
  const parts = pathname.split("/");
  const currentFile = parts[parts.length - 1];

  return (
    <div className="flex flex-col space-y-4">
      <h1 className="text-2xl font-semibold">Documentos</h1>
      <Separator />
      {fileNames.map((name) => (
        <Link
          href={`/documentacion/${name}`}
          key={name}
          className={cn(
            "group flex flex-row items-center space-x-2",
            name === currentFile && "font-bold",
          )}
        >
          <p className="text-xl hover:text-primary">
            {capitalizeFirstLetter(name)}
          </p>
          <Icons.chevronRight className="h-6 text-primary opacity-0 group-hover:opacity-100" />
        </Link>
      ))}
    </div>
  );
};

export default DocsTree;
