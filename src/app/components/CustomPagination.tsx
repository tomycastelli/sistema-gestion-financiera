"use client";

import { useState, type FC } from "react";
import { Button } from "./ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "./ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { isNumeric } from "~/lib/functions";
import { Icons } from "./ui/Icons";

interface CustomPaginationProps {
  page: number;
  pathname?: string;
  changePageState?: (page: number) => void;
  totalCount: number;
  pageSize: number;
  itemName: string;
}

const CustomPagination: FC<CustomPaginationProps> = ({
  page,
  pathname,
  changePageState,
  totalCount,
  pageSize,
  itemName,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  console.log("Search params: ", searchParams.toString());
  const lastPage = Math.ceil(totalCount / pageSize);

  const createPageLink = (n: number): string => {
    const updatedParams = new URLSearchParams(searchParams);
    updatedParams.set("pagina", n.toString());
    return pathname + "?" + updatedParams.toString();
  };

  const [inputPage, setInputPage] = useState<string>(page.toString());

  const submitPage = (s: string) => {
    if (!isNumeric(s) || parseInt(s) < 1) {
      setInputPage(page.toString());
      return;
    }
    const n = parseInt(s) < lastPage ? parseInt(s) : lastPage;
    if (changePageState) {
      changePageState(n);
    } else if (pathname) {
      router.push(createPageLink(n));
    }
    setInputPage(n.toString());
  };

  return (
    <div className="flex w-fit flex-col items-center space-y-2">
      <Pagination>
        <PaginationContent>
          {page > 2 && (
            <PaginationItem>
              {pathname ? (
                <PaginationLink href={createPageLink(1)} isActive={page === 1}>
                  1
                </PaginationLink>
              ) : (
                changePageState && (
                  <Button
                    variant={page === 1 ? "outline" : "ghost"}
                    onClick={() => changePageState(1)}
                  >
                    1
                  </Button>
                )
              )}
            </PaginationItem>
          )}
          {page > 3 && (
            <CustomElipsis
              setInputPage={setInputPage}
              inputPage={inputPage}
              submitPage={submitPage}
            />
          )}
          {page > 1 && (
            <PaginationItem>
              {pathname ? (
                <PaginationLink href={createPageLink(page - 1)}>
                  {page - 1}
                </PaginationLink>
              ) : (
                changePageState && (
                  <Button
                    onClick={() => changePageState(page - 1)}
                    variant={"ghost"}
                  >
                    {page - 1}
                  </Button>
                )
              )}
            </PaginationItem>
          )}
          <PaginationItem>
            {pathname ? (
              <PaginationLink href={createPageLink(page)} isActive>
                {page}
              </PaginationLink>
            ) : (
              changePageState && (
                <Button
                  onClick={() => changePageState(page)}
                  variant={"outline"}
                >
                  {page}
                </Button>
              )
            )}
          </PaginationItem>
          {page < lastPage && (
            <PaginationItem>
              {pathname ? (
                <PaginationLink href={createPageLink(page + 1)}>
                  {page + 1}
                </PaginationLink>
              ) : (
                changePageState && (
                  <Button
                    onClick={() => changePageState(page + 1)}
                    variant={"ghost"}
                  >
                    {page + 1}
                  </Button>
                )
              )}
            </PaginationItem>
          )}
          {page < lastPage - 2 && (
            <CustomElipsis
              setInputPage={setInputPage}
              inputPage={inputPage}
              submitPage={submitPage}
            />
          )}
          {page < lastPage - 1 && (
            <PaginationItem>
              {pathname ? (
                <PaginationLink
                  href={createPageLink(lastPage)}
                  isActive={page === lastPage}
                >
                  {lastPage}
                </PaginationLink>
              ) : (
                changePageState && (
                  <Button
                    onClick={() => changePageState(lastPage)}
                    variant={page === lastPage ? "outline" : "ghost"}
                  >
                    {lastPage}
                  </Button>
                )
              )}
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
      <p className="text-sm font-light text-muted-foreground">
        {totalCount + " " + itemName}
      </p>
    </div>
  );
};

interface CustomElipsisProps {
  submitPage: (s: string) => void;
  inputPage: string;
  setInputPage: (s: string) => void;
}

const CustomElipsis: FC<CustomElipsisProps> = ({
  submitPage,
  inputPage,
  setInputPage,
}) => {
  return (
    <PaginationItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-transparent p-0">
            <PaginationEllipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="flex flex-row items-center gap-x-1">
          <Input
            className="w-16"
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => submitPage(inputPage)}
          >
            <Icons.send className="h-4" />
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>
    </PaginationItem>
  );
};

export default CustomPagination;
