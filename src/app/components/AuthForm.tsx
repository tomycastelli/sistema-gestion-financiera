"use client";

import { signIn } from "next-auth/react";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";

const AuthForm = () => {
  const login = async () => {
    await signIn("google");
  };

  return (
    <div>
      <Button variant="outline" className="gap-2" onClick={login}>
        <Icons.google className="h-6" />
        Login
      </Button>
    </div>
  );
};

export default AuthForm;
