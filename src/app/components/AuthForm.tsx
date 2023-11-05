"use client";

import type { User } from "@prisma/client";
import { signIn, signOut } from "next-auth/react";
import { Button } from "./ui/button";
import { Icons } from "./ui/icons";

interface AuthFormProps {
  user: User | undefined;
}

const AuthForm = ({ user }: AuthFormProps) => {
  const login = async () => {
    await signIn("google");
  };

  const logout = async () => {
    await signOut();
  };

  return (
    <div>
      {user ? (
        <div>
          <h2>{`Bienvenido ${user.name}, tu rol es ${user.role}`}</h2>
          <Button onClick={logout}>Logout</Button>
        </div>
      ) : (
        <Button className="gap-2" onClick={login}>
          <Icons.google className="h-6" />
          Login
        </Button>
      )}
    </div>
  );
};

export default AuthForm;
