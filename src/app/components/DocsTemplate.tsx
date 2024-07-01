import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import { Icons } from "./ui/Icons";

const components = {
  h1: (props: React.HTMLProps<HTMLHeadingElement>) => (
    <div className="mb-4 mt-8 flex">
      <Link
        href={`#${props.id}`}
        className="group flex flex-row items-center space-x-2 transition-all hover:text-primary"
      >
        <h1 {...props} className="text-6xl font-bold">
          {props.children}
        </h1>
        <Icons.externalLink className="h-8 opacity-0 group-hover:opacity-100" />
      </Link>
    </div>
  ),
  h2: (props: React.HTMLProps<HTMLHeadingElement>) => (
    <div className="mb-2 mt-4 flex">
      <Link
        href={`#${props.id}`}
        className="group flex flex-row items-center space-x-2 transition-all hover:text-primary"
      >
        <h2 {...props} className="text-4xl font-semibold">
          {props.children}
        </h2>
        <Icons.externalLink className="h-6 opacity-0 group-hover:opacity-100" />
      </Link>
    </div>
  ),
  h3: (props: React.HTMLProps<HTMLHeadingElement>) => (
    <div className="mb-2 mt-4 flex">
      <Link
        href={`#${props.id}`}
        className="group flex flex-row items-center space-x-2 transition-all hover:text-primary"
      >
        <h3 {...props} className="text-2xl font-semibold">
          {props.children}
        </h3>
        <Icons.externalLink className="h-5 opacity-0 group-hover:opacity-100" />
      </Link>
    </div>
  ),
  p: (props: React.HTMLProps<HTMLParagraphElement>) => (
    <p {...props} className="my-1 text-justify text-lg">
      {props.children}
    </p>
  ),
  img: (props: React.HTMLProps<HTMLImageElement>) => (
    <Image
      width={1724}
      height={1242}
      style={{ height: "auto", objectFit: "contain", position: "relative" }}
      {...(props as ImageProps)}
    />
  ),
  ul: (props: React.HTMLProps<HTMLUListElement>) => (
    <ul {...props} className="flex flex-col space-y-2 text-lg">
      {props.children}
    </ul>
  ),
  li: (props: React.HTMLProps<HTMLLIElement>) => (
    <li {...props} className="ml-2 text-lg">
      {props.children}
    </li>
  ),
};

const DocsTemplate = (props: MDXRemoteProps) => {
  return (
    <MDXRemote {...props} components={{ ...components, ...props.components }} />
  );
};

export default DocsTemplate;
