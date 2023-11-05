"use client";

import { Check } from "lucide-react";
import React from "react";
import { useFormContext, type FieldElement } from "react-hook-form";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface Data {
  value: string;
  label: string;
}

interface CustomSelectorProps {
  data: Data[] | undefined;
  field: FieldElement;
  fieldName: string;
  placeholder?: string;
  buttonClassName?: string;
  isLoading?: boolean;
}

const CustomSelector = ({
  data,
  field,
  fieldName,
  placeholder,
  buttonClassName,
  isLoading,
}: CustomSelectorProps) => {
  const [open, setOpen] = React.useState(false);
  const { setValue } = useFormContext();

  return (
    <div>
      {data ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                "w-[150px] justify-between bg-transparent",
                !field.value && "text-muted-foreground",
                buttonClassName,
              )}
            >
              {isLoading
                ? "Cargando..."
                : field.value
                ? data.find((obj) => obj.value === field.value)?.label
                : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Buscar..." />
              <CommandEmpty>...</CommandEmpty>
              <CommandGroup>
                {data.map((obj) => (
                  <CommandItem
                    key={obj.value}
                    value={obj.value}
                    onSelect={() => {
                      setOpen(false);
                      setValue(fieldName, obj.value);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        obj.value === field.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {obj.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <p>No data found</p>
      )}
    </div>
  );
};

export default CustomSelector;
