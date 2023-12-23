export const dynamic = "force-static";

import { readFileSync } from "fs";
import path from "path";
import rehypeSlug from "rehype-slug";
import DocsTemplate from "~/app/components/DocsTemplate";

const Page = ({ params }: { params: { slug: string } }) => {
  const filepath = path.join("docs", `${params.slug}.mdx`);
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
