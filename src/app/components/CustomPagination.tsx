import { type FC } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "./ui/pagination";

interface CustomPaginationProps {
  page: number;
  pathname: string;
  totalCount: number;
  pageSize: number;
  itemName: string;
}

const CustomPagination: FC<CustomPaginationProps> = ({
  page,
  pathname,
  totalCount,
  pageSize,
  itemName,
}) => {
  const lastPage = Math.ceil(totalCount / pageSize);

  return (
    <div className="my-4 flex w-min flex-col items-center space-y-2">
      <Pagination>
        <PaginationContent>
          {page > 2 && (
            <PaginationItem>
              <PaginationLink
                href={{
                  pathname: pathname,
                  query: { pagina: 1 },
                }}
                isActive={page === 1}
              >
                1
              </PaginationLink>
            </PaginationItem>
          )}
          {page > 3 && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}
          {page > 1 && (
            <PaginationItem>
              <PaginationLink
                href={{
                  pathname: pathname,
                  query: { pagina: page - 1 },
                }}
              >
                {page - 1}
              </PaginationLink>
            </PaginationItem>
          )}
          <PaginationItem>
            <PaginationLink
              href={{
                pathname: pathname,
                query: { pagina: page },
              }}
              isActive
            >
              {page}
            </PaginationLink>
          </PaginationItem>
          {page < lastPage && (
            <PaginationItem>
              <PaginationLink
                href={{
                  pathname: pathname,
                  query: { pagina: page + 1 },
                }}
              >
                {page + 1}
              </PaginationLink>
            </PaginationItem>
          )}
          {page < lastPage - 2 && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}
          {page < lastPage - 1 && (
            <PaginationItem>
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
