"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FC } from "react";
import { convertToSlug } from "~/lib/functions";

interface HeadingNode {
  text: string;
  children?: HeadingNode[];
}

interface TableOfContentsProps {
  data: { name: string; headings: HeadingNode[] }[];
}

const TableOfContents: FC<TableOfContentsProps> = ({ data }) => {
  const pathname = usePathname();
  const parts = pathname.split("/");
  const currentFile = parts[parts.length - 1];
  const currentData = data.find((d) => d.name === currentFile);

  return (
    <div className="flex flex-col space-y-4">
      <h1 className="text-xl font-semibold">Secciones</h1>
      {currentData?.headings.map((heading) => (
        <div key={heading.text} className="flex flex-col space-y-2">
          <Link
            href={`#${convertToSlug(heading.text)}`}
            className="group flex flex-row items-start space-x-2"
          >
            <span className="mt-2 rounded-full bg-primary p-1"></span>
            <h2 className="text-lg group-hover:text-primary">{heading.text}</h2>
          </Link>
          {heading.children &&
            heading.children.map((child) => (
              <Link
                href={`#${convertToSlug(child.text)}`}
                key={child.text}
                className="group ml-4 flex flex-row items-start space-x-2"
              >
                <span className="mt-2 rounded-full bg-primary p-1"></span>
                <h3 className="text-md group-hover:text-primary">
                  {child.text}
                </h3>
              </Link>
            ))}
        </div>
      ))}
    </div>
  );
};

export default TableOfContents;
