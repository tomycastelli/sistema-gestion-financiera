"use client";

import { signIn } from "next-auth/react";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";

const AuthForm = () => {
  const msftLogin = async () => {
    await signIn("azure-ad");
  };

  return (
    <div className="flex flex-col space-y-2">
      <Button variant="outline" className="gap-2" onClick={msftLogin}>
        <Icons.microsoft className="h-6" />
        Ingresar con Microsoft
      </Button>
    </div>
  );
};

export default AuthForm;
