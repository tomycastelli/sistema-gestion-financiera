"use client";

import Lottie from "lottie-react";
import { useState, type FC } from "react";
import useSearch from "~/hooks/useSearch";
import {
  capitalizeFirstLetter,
  getAllChildrenTags,
  translateWord,
} from "~/lib/functions";
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
}

const EntitiesFeed: FC<EntitiesFeedProps> = ({
  initialEntities,
  userPermissions,
  initialTags,
}) => {
  const [tagFilter, setTagFilter] = useState("todos");
  const [tagFilterMode, setTagFilterMode] = useState("children");
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

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
  });

  const twiceFilteredEntities = filteredEntities.filter((entity) => {
    if (tagFilter === "todos") {
      return true;
    }
    return tagFilterMode === "strict"
      ? entity.tag.name === tagFilter
      : getAllChildrenTags(tagFilter, initialTags).includes(entity.tag.name);
  });

  return (
    <div className="mx-auto my-4 flex max-w-4xl flex-col space-y-8">
      <div className="flex flex-row flex-wrap justify-between space-x-4 space-y-6 rounded-xl border border-muted p-4">
        <div className="flex flex-row justify-start space-x-4">
          <Input
            className="w-36"
            placeholder="Nombre"
            value={searchValue}
            onChange={(e) => {
              setPage(1);
              setSearchValue(e.target.value);
            }}
          />
          <div className="flex flex-row items-center space-x-2">
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
                      {capitalizeFirstLetter(translateWord(tag.name))}
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
              <HoverCardContent className="flex w-40 flex-col">
                <p
                  className={cn(
                    tagFilterMode === "strict"
                      ? "font-semibold"
                      : "font-light text-gray-300",
                  )}
                >
                  Estricto
                </p>
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
        <div className="flex flex-row space-x-4">
          <AddEntitiesForm
            initialTags={initialTags}
            userPermissions={userPermissions}
          />
          <AddTagsForm
            entities={initialEntities}
            initialTags={initialTags}
            userPermissions={userPermissions}
          />
        </div>
      </div>
      <div className="flex items-center justify-center">
        {isLoading ? (
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        ) : filteredEntities.length > 0 ? (
          <div className="flex flex-col space-y-6">
            <div className="mx-auto grid grid-cols-2 gap-11 md:grid-cols-4 xl:grid-cols-6">
              {twiceFilteredEntities
                .slice((page - 1) * pageSize, page * pageSize)
                .map((entity) => (
                  <div
                    key={entity.id}
                    className="flex flex-col items-center justify-center space-y-2 self-start"
                  >
                    <EntityCard entity={entity} />
                    {entity.tag.name !== "user" &&
                      manageableEntities.find(
                        (item) => item.name === entity.name,
                      ) && <EntityOptions entity={entity} tags={initialTags} />}
                  </div>
                ))}
            </div>
            <CustomPagination
              page={page}
              totalCount={twiceFilteredEntities.length}
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
