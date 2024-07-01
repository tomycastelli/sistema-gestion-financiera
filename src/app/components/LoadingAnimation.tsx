"use client";

import dynamic from "next/dynamic";
import loadingJson from "~/../public/animations/loading.json";
import { cn } from "~/lib/utils";
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface LoadingAnimationProps {
  text?: string;
  size?: "sm" | "md" | "lg";
}

const LoadingAnimation = ({ text, size }: LoadingAnimationProps) => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Lottie
        animationData={loadingJson}
        className={cn(
          !size
            ? ""
            : size === "sm"
              ? "h-16"
              : size === "md"
                ? "h-40"
                : size === "lg"
                  ? "h-72"
                  : "",
        )}
        loop={true}
      />
      <p
        className={cn(
          "font-semibold tracking-tighter",
          !size
            ? ""
            : size === "sm"
              ? "text-sm"
              : size === "md"
                ? "text-lg"
                : size === "lg"
                  ? "text-2xl"
                  : "",
        )}
      >
        {text ? text : ""}
      </p>
    </div>
  );
};

export default LoadingAnimation;
