"use client";

import type { Session } from "next-auth";
import { signIn, signOut } from "next-auth/react";
import { Icons } from "./ui/Icons";
import { Button } from "./ui/button";

interface AuthFormProps {
  session: Session;
}

const AuthForm = ({ session }: AuthFormProps) => {
  const login = async () => {
    await signIn("google");
  };

  const logout = async () => {
    await signOut();
  };

  return (
    <div>
      {session ? (
        <div>
          <h2>{`Bienvenido ${session.user.name}, tu rol es ${session.user.role}`}</h2>
          <Button onClick={logout}>Logout</Button>
        </div>
      ) : (
        <Button variant="outline" className="gap-2" onClick={login}>
          <Icons.google className="h-6" />
          Login
        </Button>
      )}
    </div>
  );
};

export default AuthForm;
