"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { capitalizeFirstLetter } from "~/lib/functions";
import { cn } from "~/lib/utils";

const LinkTree = () => {
  const pathname = usePathname();
  const paths = pathname.split("/").filter((item) => item);
  let currentPath = "";

  return (
    <div className="flex flex-row space-x-1">
      <Link
        href="/"
        className={cn(pathname === "/" ? "text-primary" : "text-black")}
      >
        Inicio /{" "}
      </Link>
      {paths.map((path, index) => {
        currentPath += `/${path}`;
        return (
          <span key={index}>
            {currentPath === pathname ? (
              <p className="font-bold">{capitalizeFirstLetter(path)}</p>
            ) : (
              <Link href={currentPath} className="text-black">
                {capitalizeFirstLetter(path)}
              </Link>
            )}
            {index !== paths.length - 1 && <span> / </span>}
          </span>
        );
      })}
    </div>
  );
};

export default LinkTree;
