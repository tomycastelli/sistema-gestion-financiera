"use client";

import Lottie from "lottie-react";
import { useState, type FC } from "react";
import useSearch from "~/hooks/useSearch";
import { capitalizeFirstLetter, translateWord } from "~/lib/functions";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import loadingJson from "../../../public/animations/loading.json";
import EntityCard from "../components/ui/EntityCard";
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
import AddEntitiesForm from "./AddEntitiesForm";
import EntityOptions from "./EntityOptions";

interface EntitiesFeedProps {
  initialEntities: RouterOutputs["entities"]["getAll"];
}

const EntitiesFeed: FC<EntitiesFeedProps> = ({ initialEntities }) => {
  const [tagFilter, setTagFilter] = useState("todos");

  const { data: entities, isLoading } = api.entities.getAll.useQuery(
    undefined,
    {
      initialData: initialEntities,
      refetchOnWindowFocus: false,
    },
  );

  const tags = [...new Set(entities.map((entity) => entity.tag))];

  const {
    results: filteredEntities,
    searchValue,
    setSearchValue,
  } = useSearch<(typeof entities)[0]>({
    dataSet: entities,
    keys: ["name"],
  });

  return (
    <div className="mx-auto my-4 flex max-w-4xl flex-col space-y-8">
      <div className="flex flex-row justify-between space-x-4 rounded-xl border border-muted p-4">
        <div className="flex flex-row justify-start space-x-4">
          <Input
            className="w-36"
            placeholder="Nombre"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <Select onValueChange={setTagFilter} value={tagFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup defaultValue="todos">
                <SelectLabel>Tags</SelectLabel>
                <SelectItem value="todos">Todos</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {capitalizeFirstLetter(translateWord(tag))}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <AddEntitiesForm />
      </div>
      <div className="flex items-center justify-center">
        {isLoading ? (
          <Lottie animationData={loadingJson} className="h-24" loop={true} />
        ) : filteredEntities.length > 0 ? (
          <div className="mx-auto grid grid-cols-5 gap-11">
            {filteredEntities
              .filter((entity) => {
                if (tagFilter === "todos") {
                  return true;
                }
                return entity.tag === tagFilter;
              })
              .map((entity) => (
                <div
                  key={entity.id}
                  className="flex flex-col items-center justify-center space-y-2 self-start"
                >
                  <EntityCard entity={entity} />
                  {entity.tag !== "user" && <EntityOptions entity={entity} />}
                </div>
              ))}
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
