import { type FC, useState } from "react";
import { Button } from "../ui/button";

import { Icons } from "~/app/components/ui/Icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface Data {
  value: string;
  label: string;
  subData: {
    value: string;
    label: string;
  }[];
}

interface CustomSelectorProps {
  data: Data[];
  onSelect: (value: string | null, subValue: string | null) => void;
  selectedValue: string | null | undefined;
  selectedSubValue: string | null | undefined;
}

const CustomDropdownSelector: FC<CustomSelectorProps> = ({
  data,
  onSelect,
  selectedValue,
  selectedSubValue,
}) => {
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <DropdownMenu open={categoriesOpen} onOpenChange={setCategoriesOpen}>
      <DropdownMenuTrigger>
        <Button variant="outline">
          {data
            .flatMap((item) => item.subData)
            .find((subItem) => subItem.value === selectedSubValue)?.label ??
            "Elegir"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {data.map((item) => (
          <DropdownMenuSub key={item.value}>
            <DropdownMenuSubTrigger className="flex flex-row items-center justify-between">
              {item.label}
              {item.subData?.some(
                (subcategory) => subcategory.value === selectedValue,
              ) && <Icons.check className="h-4 w-4" />}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {item.subData?.map((subItem) => (
                  <DropdownMenuItem
                    onSelect={async (e) => {
                      e.preventDefault();
                      if (selectedSubValue === subItem.value) {
                        onSelect(null, null);
                      } else {
                        onSelect(item.value, subItem.value);
                      }
                      await new Promise((resolve) => setTimeout(resolve, 300));
                      setCategoriesOpen(false);
                    }}
                    key={subItem.value}
                    className="flex flex-row items-center justify-between"
                  >
                    <p>{subItem.label}</p>
                    {selectedSubValue === subItem.value && (
                      <Icons.check className="h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CustomDropdownSelector;
