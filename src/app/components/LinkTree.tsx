"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { capitalizeFirstLetter } from "~/lib/functions";

const LinkTree = () => {
  const pathname = usePathname();
  const paths = pathname.split("/").filter((item) => item);
  let currentPath = "";

  return (
    <div className="text-md flex flex-row space-x-1 lg:text-lg">
      <Link href="/" prefetch={false}>
        Inicio /{" "}
      </Link>
      {paths.map((path, index) => {
        currentPath += `/${path}`;
        return (
          <span key={index}>
            {currentPath === pathname ? (
              <p className="font-bold">{capitalizeFirstLetter(path)}</p>
            ) : (
              <Link
                prefetch={false}
                href={currentPath}
                className="rounded-xl transition-all hover:text-primary hover:shadow-md"
              >
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
