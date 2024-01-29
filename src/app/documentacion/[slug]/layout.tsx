import { getHeadingsTree } from "~/lib/functions";
import DocsTree from "./DocsTree";
import TableOfContents from "./TableOfContents";

const DocsLayout = async ({ children }: { children: React.ReactNode }) => {
  const fileNames = [
    "entidades",
    "logs",
    "permisos",
    "peticiones",
    "transacciones",
  ];

  const headingsData = await Promise.all(
    fileNames.map(async (fileName) => {
      const res = await fetch(
        `https://du502cbk6jn66.cloudfront.net/content/docs/${fileName}.mdx`,
      );
      const mdxText = await res.text();
      const headings = getHeadingsTree(mdxText);
      return { name: fileName, headings };
    }),
  );

  return (
    <div className="grid grid-cols-7 gap-2 lg:gap-8">
      <div className="col-span-1">
        <div className="sticky top-8">
          <DocsTree fileNames={fileNames} />
        </div>
      </div>
      <div className="col-span-7 lg:col-span-5">{children}</div>
      <div className="hidden lg:col-span-1 lg:block">
        <div className="sticky top-8">
          <TableOfContents data={headingsData} />
        </div>
      </div>
    </div>
  );
};

export default DocsLayout;
