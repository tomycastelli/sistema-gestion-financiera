export const dynamic = "force-static";
import rehypeSlug from "rehype-slug";
import DocsTemplate from "~/app/components/DocsTemplate";

const Page = async ({ params }: { params: { slug: string } }) => {
  const res = await fetch(
    `https://du502cbk6jn66.cloudfront.net/content/docs/${params.slug}.mdx`,
  );
  const mdxText = await res.text();

  return (
    <div className="flex flex-col space-y-6">
      <DocsTemplate
        source={mdxText}
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
