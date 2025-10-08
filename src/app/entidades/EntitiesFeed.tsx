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
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import CustomPagination from "../components/CustomPagination";
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
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
  const [tagFilterMode] = useState("children");
  const [statusFilter, setStatusFilter] = useState("todas");
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
    keys: ["name", "id"],
    scoreThreshold: 0.4,
    additionalProcess: (results, searchValue) => {
      if (/^\d+$/.test(searchValue)) {
        return results.slice(0, 1);
      }
      return results;
    },
  });

  const doubleFilteredEntities = filteredEntities.filter((entity) => {
    if (tagFilter === "todos") {
      return true;
    }
    return tagFilterMode === "strict"
      ? entity.tag.name === tagFilter
      : getAllChildrenTags(tagFilter, tags).includes(entity.tag.name);
  });

  const tripleFilteredEntities = doubleFilteredEntities.filter((entity) => {
    if (statusFilter === "todas") {
      return true;
    }
    if (statusFilter === "habilitadas") {
      return entity.enabled;
    }
    if (statusFilter === "deshabilitadas") {
      return !entity.enabled;
    }
    return true;
  });

  const { mutateAsync: getUrlAsync } = api.files.getEntities.useMutation({
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

  const onDownloadClick = () => {
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
      accessorKey: "category",
      header: "Categoría",
      accessorFn: (row) => capitalizeFirstLetter(row.category ?? ""),
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
                  disabled={entity.tag.name === "Maika"}
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
      <div className="flex flex-row items-end justify-between gap-4 rounded-xl border border-muted p-4">
        <div className="flex flex-row gap-4">
          <div className="flex flex-col gap-1">
            <Label className="mb-1">Búsqueda</Label>
            <Input
              className="w-36"
              placeholder="ID/Nombre"
              value={searchValue}
              onChange={(e) => {
                setPage(1);
                setSearchValue(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-row items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="mb-1">Tags</Label>
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
            </div>
            <div className="flex flex-col gap-1">
              <Label className="mb-1">Estado</Label>
              <Select onValueChange={setStatusFilter} value={statusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup defaultValue="todas">
                    <SelectLabel>Estado</SelectLabel>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="habilitadas">Habilitadas</SelectItem>
                    <SelectItem value="deshabilitadas">
                      Deshabilitadas
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
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
                  <DropdownMenuItem onClick={() => onDownloadClick()}>
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
        ) : tripleFilteredEntities.length > 0 ? (
          <div className="flex w-full flex-col gap-4">
            <CustomPagination
              page={page}
              totalCount={tripleFilteredEntities.length}
              pageSize={pageSize}
              itemName="entidades"
              changePageState={setPage}
            />
            <DataTable
              showCategory={true}
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
