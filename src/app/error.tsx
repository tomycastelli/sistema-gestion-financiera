"use client"; // Error components must be Client Components

import { useEffect } from "react";
import { Icons } from "./components/ui/Icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="mt-64 flex w-full flex-col items-center justify-center">
      <h2 className="text-3xl font-semibold tracking-tighter">
        {error.message}
      </h2>
      <Icons.cross className="h-36 text-red" />
    </div>
  );
}
