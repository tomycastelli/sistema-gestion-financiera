"use client";

import { usePathname } from "next/navigation";

const LinkTree = () => {
  const pathname = usePathname();

  return <div>{pathname}</div>;
};

export default LinkTree;
