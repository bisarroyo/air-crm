"use client"

import * as React from "react"
import { cn } from "cn"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon, ChevronDownIcon } from "lucide-react"

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = value ? new Date(value) : undefined

  function handleSelect(date: Date | undefined) {
    setOpen(false)
    if (date) {
      const formatted = date.toISOString().split("T")[0]
      onChange?.(formatted)
    } else {
      onChange?.("")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground",
              className
            )}
            disabled={disabled}
            aria-label={placeholder}
          >
            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
            {selectedDate ? (
              selectedDate.toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronDownIcon className="ml-auto h-4 w-4 opacity-70" />
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={disabled}
          locale={{ code: "es-ES" }}
        />
      </PopoverContent>
    </Popover>
  )
}