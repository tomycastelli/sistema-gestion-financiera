import Link from "next/link";

export default function Home() {
  return (
    <div className="flex h-full w-full flex-col">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">
        Bienvenido al portal de Maika!
      </h1>
      <Link className="text-xl font-semibold" href="/operaciones">
        Operaciones
      </Link>
      <Link
        className="text-xl font-semibold"
        href={{ pathname: "/cuentas", query: { tag: "maika" } }}
      >
        Cuentas
      </Link>
      <Link className="text-xl font-semibold" href={{ pathname: "/entidades" }}>
        Entidades
      </Link>
    </div>
  );
}
