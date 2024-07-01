"use client";

import Link from "next/link";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";

const AuthForm = () => {
  return (
    <div className="flex flex-col items-center space-y-2">
      <Link href={"/api/auth?provider=microsoft"}>
        <Button variant="outline" className="gap-2">
          <Icons.microsoft className="h-6" />
          Ingresar con Microsoft
        </Button>
      </Link>
      <Link href={"/api/auth?provider=google"}>
        <Button variant="outline" className="gap-2">
          <Icons.google className="h-6" />
          Ingresar con Google
        </Button>
      </Link>
    </div>
  );
};

export default AuthForm;
