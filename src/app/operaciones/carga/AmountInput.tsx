"use client"

import { type FC } from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel } from "~/app/components/ui/form";
import { Input } from "~/app/components/ui/input";
import { useNumberFormat } from "@react-input/number-format";

interface AmountInputProps {
  name: string;
}

const AmountInput: FC<AmountInputProps> = ({ name }) => {
  const { control } = useFormContext();

  const inputRef = useNumberFormat({ locales: "es-AR" })

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Monto</FormLabel>
          <FormControl>
            <Input
              ref={inputRef}
              className="w-32" name={field.name} placeholder="$"
              value={field.value}
              onChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  )
}

export default AmountInput
