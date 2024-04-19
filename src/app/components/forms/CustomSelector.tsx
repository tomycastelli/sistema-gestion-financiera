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
import { ScrollArea } from "../ui/scroll-area";
import { truncateString } from "~/lib/functions";

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
  isMultiSelect?: boolean;
}

const CustomSelector = ({
  data,
  field,
  fieldName,
  placeholder,
  buttonClassName,
  isLoading,
  isMultiSelect,
}: CustomSelectorProps) => {
  const [open, setOpen] = React.useState(false);
  const { setValue } = useFormContext();

  return data ? (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "w-36 justify-between bg-transparent",
            !field.value && "text-muted-foreground",
            buttonClassName,
          )}
        >
          {isLoading
            ? "Cargando..."
            : field.value
              ? Array.isArray(field.value) ? field.value.length > 1 ? field.value.length + " " + "elementos" : data.find(d => d.value === field.value[0])?.label : data.find(d => d.value === field.value)?.label
              : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandEmpty>...</CommandEmpty>
          <ScrollArea className="h-62 w-48 rounded-md">
            <CommandGroup>
              {data
                .sort((a, b) => {
                  if (!field.value) return 0;
                  if (Array.isArray(field.value)) {
                    const aIndex = field.value.indexOf(a.value);
                    const bIndex = field.value.indexOf(b.value);
                    if (aIndex !== -1 && bIndex !== -1)
                      return aIndex - bIndex;
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                  } else {
                    if (a.value === field.value) return -1;
                    if (b.value === field.value) return 1;
                  }
                  return 0;
                })
                .map((obj) => (
                  <CommandItem
                    key={obj.value}
                    value={obj.label}
                    onSelect={() => {
                      if (isMultiSelect) {
                        if (field.value && Array.isArray(field.value)) {
                          if (field.value.includes(obj.value)) {
                            setValue(
                              fieldName,
                              field.value.filter(
                                (item) => item !== obj.value,
                              ),
                            );
                          } else {
                            setValue(fieldName, [
                              ...field.value,
                              obj.value,
                            ]);
                          }
                        } else {
                          setValue(fieldName, [obj.value]);
                        }
                      } else {
                        setOpen(false);
                        if (field.value === obj.value) {
                          setValue(fieldName, undefined);
                        } else {
                          setValue(fieldName, obj.value);
                        }
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        (Array.isArray(field.value) && field.value.includes(obj.value)) ||
                          field.value === obj.value
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {truncateString(obj.label, 22)}
                  </CommandItem>
                ))}
            </CommandGroup>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  ) : (
    <p>No data found</p>
  )
}

export default CustomSelector;
