"use client";

import Lottie from "lottie-react";
import loadingJson from "../../../public/animations/loading.json";

interface LoadingAnimationProps {
  text: string | null;
}

const LoadingAnimation = ({ text }: LoadingAnimationProps) => {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Lottie animationData={loadingJson} className="h-72" loop={true} />
      <p className="text-xl font-semibold tracking-tighter">
        {text ? text : ""}
      </p>
    </div>
  );
};

export default LoadingAnimation;
