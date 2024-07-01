import Fuse from "fuse.js";
import { useMemo, useState } from "react";

interface IUseSearchProps<T> {
  dataSet: T[];
  keys: string[];
  scoreThreshold?: number;
}

export default function useSearch<T>({
  dataSet,
  keys,
  scoreThreshold = 0.55,
}: IUseSearchProps<T>) {
  const [searchValue, setSearchValue] = useState("");

  const fuse = useMemo(() => {
    const options = {
      includeScore: true,
      keys,
    };

    return new Fuse(dataSet, options);
  }, [dataSet, keys]);

  const results = useMemo(() => {
    if (!searchValue) return dataSet;

    const searchResults = fuse.search(searchValue);

    return searchResults
      .filter(
        (fuseResult) =>
          fuseResult.score !== undefined && fuseResult.score < scoreThreshold,
      )
      .map((fuseResult) => fuseResult.item);
  }, [fuse, searchValue, dataSet, scoreThreshold]);

  return {
    searchValue,
    setSearchValue,
    results,
  };
}
