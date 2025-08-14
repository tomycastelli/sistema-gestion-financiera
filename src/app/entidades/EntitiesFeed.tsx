"use client";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import { type ColumnDef } from "@tanstack/react-table";
import type { User } from "lucia";
import { MoreHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, type FC } from "react";
import { toast } from "sonner";
import useSearch from "~/hooks/useSearch";
import { capitalizeFirstLetter, getAllChildrenTags } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import CustomPagination from "../components/CustomPagination";
import EntityCard from "../components/ui/EntityCard";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../components/ui/hover-card";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { DataTable } from "../cuentas/DataTable";
import AddEntitiesForm from "./AddEntitiesForm";
import AddTagsForm from "./AddTagsForm";
import EntityOptions from "./EntityOptions";

interface EntitiesFeedProps {
  initialEntities: RouterOutputs["entities"]["getAll"];
  userPermissions: RouterOutputs["users"]["getAllPermissions"];
  initialTags: RouterOutputs["tags"]["getFiltered"];
  main_name: string;
  user: User;
}

const EntitiesFeed: FC<EntitiesFeedProps> = ({
  initialEntities,
  userPermissions,
  initialTags,
  main_name,
  user,
}) => {
  const [tagFilter, setTagFilter] = useState("todos");
  const [tagFilterMode, setTagFilterMode] = useState("children");
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  const { data: tags, isSuccess } = api.tags.getFiltered.useQuery(undefined, {
    initialData: initialTags,
    refetchOnWindowFocus: false,
  });

  const { data: entities, isLoading } = api.entities.getAll.useQuery(
    undefined,
    {
      initialData: initialEntities,
      refetchOnWindowFocus: false,
    },
  );

  const {
    results: filteredEntities,
    searchValue,
    setSearchValue,
  } = useSearch<(typeof entities)[0]>({
    dataSet: entities,
    keys: ["name"],
    scoreThreshold: 0.4,
  });

  const {
    results: doubleFilteredEntities,
    searchValue: searchId,
    setSearchValue: setSearchId,
  } = useSearch<(typeof entities)[0]>({
    dataSet: filteredEntities,
    keys: ["id"],
    scoreThreshold: 0.001,
  });

  const tripleFilteredEntities = doubleFilteredEntities.filter((entity) => {
    if (tagFilter === "todos") {
      return true;
    }
    return tagFilterMode === "strict"
      ? entity.tag.name === tagFilter
      : getAllChildrenTags(tagFilter, tags).includes(entity.tag.name);
  });

  const { mutateAsync: getUrlAsync, isLoading: isLoadingFile } =
    api.files.getEntities.useMutation({
      onSuccess(newOperation) {
        if (newOperation) {
          const link = document.createElement("a");
          link.href = newOperation.downloadUrl;
          link.download = newOperation.filename;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      },
      onError(err) {
        toast.error("Error al generar el archivo", {
          description: err.message,
        });
      },
    });

  const onDownloadClick = (fileType: "xlsx") => {
    const promise = getUrlAsync();

    toast.promise(promise, {
      loading: "Generando archivo...",
      success(data) {
        return `Archivo generado: ${data.filename}`;
      },
    });
  };

  const columns: ColumnDef<(typeof entities)[number]>[] = [
    {
      accessorKey: "id",
      header: "ID",
    },
    {
      accessorKey: "name",
      header: "Nombre",
    },
    {
      accessorKey: "tag.name",
      header: "Tag",
    },
    {
      accessorKey: "sucursalOrigenEntity.name",
      header: "Sucursal de origen",
    },
    {
      accessorKey: "operadorAsociadoEntity.name",
      header: "Operador asociado",
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const entity = row.original;

        if (user)
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  disabled={entity.tag.name === "Operadores"}
                >
                  <span className="sr-only">Abrir menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <EntityOptions
                  entities={entities}
                  entity={entity}
                  tags={tags}
                  user={user}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          );
      },
    },
  ];

  return (
    <div className="mx-auto my-4 flex max-w-4xl flex-col flex-wrap gap-4">
      <div className="flex flex-row items-center justify-between gap-4 rounded-xl border border-muted p-4">
        <div className="flex flex-row gap-4">
          <Input
            className="w-36"
            placeholder="ID"
            value={searchId}
            onChange={(e) => {
              setPage(1);
              setSearchId(e.target.value);
            }}
          />
          <Input
            className="w-36"
            placeholder="Nombre"
            value={searchValue}
            onChange={(e) => {
              setPage(1);
              setSearchValue(e.target.value);
            }}
          />
          <div className="flex flex-row items-center gap-2">
            <Select onValueChange={setTagFilter} value={tagFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup defaultValue="todos">
                  <SelectLabel>Tags</SelectLabel>
                  <SelectItem value="todos">Todos</SelectItem>
                  {initialTags.map((tag) => (
                    <SelectItem key={tag.name} value={tag.name}>
                      {capitalizeFirstLetter(tag.name)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {!isLoading ? (
                  <Button variant="outline" tooltip="Descargar">
                    <Icons.download className="h-5" />
                  </Button>
                ) : (
                  <p>Cargando...</p>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Extensión</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => onDownloadClick("xlsx")}>
                    <Icons.excel className="h-4" />
                    <span>Excel</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {isSuccess && (
          <div className="flex flex-row space-x-4">
            <AddEntitiesForm
              entities={entities}
              tags={tags}
              userPermissions={userPermissions}
            />
            <AddTagsForm
              main_name={main_name}
              tags={tags}
              userPermissions={userPermissions}
            />
          </div>
        )}
      </div>
      <div className="flex">
        {isLoading ? (
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        ) : filteredEntities.length > 0 ? (
          <div className="flex w-full flex-col gap-4">
            <CustomPagination
              page={page}
              totalCount={tripleFilteredEntities.length}
              pageSize={pageSize}
              itemName="entidades"
              changePageState={setPage}
            />
            <DataTable
              columns={columns}
              data={tripleFilteredEntities.slice(
                (page - 1) * pageSize,
                page * pageSize,
              )}
            />
            <CustomPagination
              page={page}
              totalCount={tripleFilteredEntities.length}
              pageSize={pageSize}
              itemName="entidades"
              changePageState={setPage}
            />
          </div>
        ) : (
          <h1 className="text-xl font-semibold tracking-tight">
            No se encontraron entidades
          </h1>
        )}
      </div>
    </div>
  );
};

export default EntitiesFeed;
