export const dynamic = "force-static";

import { readFileSync } from "fs";
import path from "path";
import rehypeSlug from "rehype-slug";
import DocsTemplate from "~/app/components/DocsTemplate";
import { env } from "~/env.mjs";

const Page = ({ params }: { params: { slug: string } }) => {
  const filepath =
    env.NEXTAUTH_URL && env.NEXTAUTH_URL.startsWith("http://localhost")
      ? path.join("public", "docs", `${params.slug}.mdx`)
      : path.join(process.cwd(), "docs", `${params.slug}.mdx`);
  const markdown = readFileSync(filepath, "utf-8");

  return (
    <div className="flex flex-col space-y-6">
      <DocsTemplate
        source={markdown}
        options={{
          mdxOptions: {
            rehypePlugins: [rehypeSlug],
          },
        }}
      />
    </div>
  );
};

export default Page;
