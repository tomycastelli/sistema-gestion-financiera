import { type FC } from "react";
import { Button } from "./ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "./ui/pagination";

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
  const lastPage = Math.ceil(totalCount / pageSize);

  return (
    <div className="my-4 flex w-fit flex-col items-center space-y-2">
      <Pagination>
        <PaginationContent>
          {page > 2 && (
            <PaginationItem>
              {pathname ? (
                <PaginationLink
                  href={{
                    pathname: pathname,
                    query: { pagina: 1 },
                  }}
                  isActive={page === 1}
                >
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
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}
          {page > 1 && (
            <PaginationItem>
              {pathname ? (
                <PaginationLink
                  href={{
                    pathname: pathname,
                    query: { pagina: page - 1 },
                  }}
                >
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
              <PaginationLink
                href={{
                  pathname: pathname,
                  query: { pagina: page },
                }}
                isActive
              >
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
                <PaginationLink
                  href={{
                    pathname: pathname,
                    query: { pagina: page + 1 },
                  }}
                >
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
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}
          {page < lastPage - 1 && (
            <PaginationItem>
              {pathname ? (
                <PaginationLink
                  href={{
                    pathname: pathname,
                    query: {
                      pagina: lastPage,
                    },
                  }}
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

export default CustomPagination;
