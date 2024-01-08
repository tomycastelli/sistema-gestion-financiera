export const dynamic = "force-static";
import { readFileSync } from "fs";
import rehypeSlug from "rehype-slug";
import DocsTemplate from "~/app/components/DocsTemplate";

const Page = ({ params }: { params: { slug: string } }) => {
  const markdown = readFileSync(`../docs/${params.slug}.mdx`, "utf-8");

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
