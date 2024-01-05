import { readdirSync } from "fs";
import Link from "next/link";
import path from "path";
import { env } from "~/env.mjs";
import { capitalizeFirstLetter } from "~/lib/functions";

const page = () => {
  const fileNamesWithExtensions =
    env.NEXTAUTH_URL && env.NEXTAUTH_URL.startsWith("http://localhost")
      ? readdirSync(path.join("public", "docs"))
      : readdirSync(path.join(process.cwd(), "docs"));
  const fileNames = fileNamesWithExtensions.map(
    (fileName) => path.parse(fileName).name,
  );
  return (
    <div className="flex flex-col space-y-6">
      <h1 className="mx-auto flex text-4xl font-semibold">Documentación</h1>
      <div className="flex flex-col space-y-4">
        {fileNames.map((file) => (
          <Link
            href={`/documentacion/${file}`}
            key={file}
            className="flex flex-row items-center space-x-2 text-2xl font-semibold"
          >
            <span className="h-4 w-4 rounded-full bg-primary"></span>
            <p>{capitalizeFirstLetter(file)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default page;
