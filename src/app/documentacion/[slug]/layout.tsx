import { readFileSync, readdirSync } from "fs";
import path from "path";
import { env } from "~/env.mjs";
import { getHeadingsTree } from "~/lib/functions";
import DocsTree from "./DocsTree";
import TableOfContents from "./TableOfContents";

const DocsLayout = ({ children }: { children: React.ReactNode }) => {
  const fileNamesWithExtensions =
    env.NEXTAUTH_URL && env.NEXTAUTH_URL.startsWith("http://localhost")
      ? readdirSync(path.join("public", "docs"))
      : readdirSync(path.join(process.cwd(), "docs"));
  const fileNames = fileNamesWithExtensions.map(
    (fileName) => path.parse(fileName).name,
  );

  const headingsData = fileNames.map((fileName) => {
    const markdown =
      env.NEXTAUTH_URL && env.NEXTAUTH_URL.startsWith("http://localhost")
        ? readFileSync(path.join("public", "docs", `${fileName}.mdx`), "utf-8")
        : readFileSync(
            path.join(process.cwd(), "docs", `${fileName}.mdx`),
            "utf-8",
          );
    const headings = getHeadingsTree(markdown);
    return { name: fileName, headings };
  });

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
