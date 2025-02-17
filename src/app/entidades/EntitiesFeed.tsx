"use client";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import type { User } from "lucia";
import dynamic from "next/dynamic";
import { useState, type FC } from "react";
import useSearch from "~/hooks/useSearch";
import { capitalizeFirstLetter, getAllChildrenTags } from "~/lib/functions";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import CustomPagination from "../components/CustomPagination";
import EntityCard from "../components/ui/EntityCard";
import { Button } from "../components/ui/button";
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

  const manageableEntities = entities.filter((entity) => {
    if (
      userPermissions?.find(
        (p) => p.name === "ADMIN" || p.name === "ACCOUNTS_VISUALIZE",
      )
    ) {
      return true;
    } else if (
      userPermissions?.find(
        (p) =>
          p.name === "ACCOUNTS_VISUALIZE_SOME" &&
          (p.entitiesIds?.includes(entity.id) ||
            getAllChildrenTags(p.entitiesTags, initialTags).includes(
              entity.tag.name,
            )),
      )
    ) {
      return true;
    }
  });

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
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button
                  variant="outline"
                  className="border-transparent bg-transparent p-0 hover:bg-transparent"
                >
                  <Switch
                    id="tagFilterMode"
                    checked={tagFilterMode === "strict" ? true : false}
                    onCheckedChange={(checked) =>
                      setTagFilterMode(checked ? "strict" : "children")
                    }
                  />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="flex w-[12rem] flex-row gap-1">
                <p
                  className={cn(
                    tagFilterMode === "strict"
                      ? "font-semibold"
                      : "font-light text-gray-300",
                  )}
                >
                  Estricto
                </p>
                /
                <p
                  className={cn(
                    tagFilterMode === "children"
                      ? "font-semibold"
                      : "font-light text-gray-300",
                  )}
                >
                  Todo el arbol
                </p>
              </HoverCardContent>
            </HoverCard>
          </div>
        </div>
        {isSuccess && (
          <div className="flex flex-row space-x-4">
            <AddEntitiesForm tags={tags} userPermissions={userPermissions} />
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
          <div className="flex flex-col items-start gap-6">
            <div className="flex flex-wrap justify-center gap-8">
              {tripleFilteredEntities
                .slice((page - 1) * pageSize, page * pageSize)
                .map((entity) => (
                  <div
                    key={entity.id}
                    className="flex flex-col items-center justify-center space-y-2 self-start"
                  >
                    <EntityCard entity={entity} />
                    {isSuccess &&
                      entity.tag.name !== "Operadores" &&
                      manageableEntities.find(
                        (item) => item.name === entity.name,
                      ) && (
                        <EntityOptions
                          entity={entity}
                          tags={tags}
                          user={user}
                        />
                      )}
                  </div>
                ))}
            </div>
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
