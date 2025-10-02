import Fuse from "fuse.js";
import { useMemo, useState } from "react";

interface IUseSearchProps<T> {
  dataSet: T[];
  keys: string[];
  scoreThreshold?: number;
  initialValue?: string;
  additionalProcess?: (results: T[], searchValue: string) => T[];
}

export default function useSearch<T>({
  dataSet,
  keys,
  scoreThreshold = 0.55,
  initialValue = "",
  additionalProcess,
}: IUseSearchProps<T>) {
  const [searchValue, setSearchValue] = useState(initialValue);

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

    const filteredResults = searchResults
      .filter(
        (fuseResult) =>
          fuseResult.score !== undefined && fuseResult.score < scoreThreshold,
      )
      .map((fuseResult) => fuseResult.item);

    // Apply additional filter if provided
    return additionalProcess
      ? additionalProcess(filteredResults, searchValue)
      : filteredResults;
  }, [fuse, searchValue, dataSet, scoreThreshold, additionalProcess]);

  return {
    searchValue,
    setSearchValue,
    results,
  };
}
