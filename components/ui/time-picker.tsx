"use client"

import * as React from "react"
import { cn } from "cn"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ClockIcon, ChevronDownIcon, CheckIcon } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"

type TimeInterval = 15 | 30 | 60

interface TimePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  interval?: TimeInterval
  format24h?: boolean
}

function generateTimeSlots(interval: TimeInterval = 15, format24h = true): string[] {
  const slots: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      if (format24h) {
        slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
      } else {
        const period = hour >= 12 ? "PM" : "AM"
        const displayHour = hour % 12 === 0 ? 12 : hour % 12
        slots.push(`${displayHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${period}`)
      }
    }
  }
  return slots
}

function formatTimeForDisplay(time: string, format24h = true): string {
  if (!time) return ""
  if (format24h) return time
  const [hourStr, minute] = time.split(":")
  const hour = parseInt(hourStr, 10)
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour.toString().padStart(2, "0")}:${minute} ${period}`
}

export function TimePicker({
  value,
  onChange,
  placeholder = "Seleccionar hora",
  disabled,
  className,
  interval = 15,
  format24h = true,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const timeSlots = React.useMemo(() => generateTimeSlots(interval, format24h), [interval, format24h])

  function handleSelect(time: string) {
    setOpen(false)
    onChange?.(time)
  }

  const displayValue = value ? formatTimeForDisplay(value, format24h) : ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
            disabled={disabled}
            aria-label={placeholder}
          >
            <ClockIcon className="mr-2 h-4 w-4 opacity-70" />
            {displayValue || <span className="text-muted-foreground">{placeholder}</span>}
            <ChevronDownIcon className="ml-auto h-4 w-4 opacity-70" />
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) min-w-[160px] p-0 max-h-96 overflow-y-auto" align="start" sideOffset={8}>
        <div className="p-1">
          {timeSlots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => handleSelect(slot)}
              disabled={disabled}
              className={cn(
                "w-full px-3 py-1.5 text-sm text-left rounded-md transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                "data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
                value === slot && "bg-primary text-primary-foreground"
              )}
              data-selected={value === slot}
            >
              <span className="flex items-center gap-2">
                {formatTimeForDisplay(slot, format24h)}
                {value === slot && <CheckIcon className="h-3.5 w-3.5" />}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function DateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  datePlaceholder = "Fecha",
  timePlaceholder = "Hora",
  disabled,
  className,
  interval = 15,
  format24h = true,
}: {
  dateValue?: string
  timeValue?: string
  onDateChange?: (value: string) => void
  onTimeChange?: (value: string) => void
  datePlaceholder?: string
  timePlaceholder?: string
  disabled?: boolean
  className?: string
  interval?: TimeInterval
  format24h?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DatePicker
        value={dateValue}
        onChange={onDateChange}
        placeholder={datePlaceholder}
        disabled={disabled}
        className="flex-1"
      />
      <TimePicker
        value={timeValue}
        onChange={onTimeChange}
        placeholder={timePlaceholder}
        disabled={disabled}
        interval={interval}
        format24h={format24h}
        className="w-[140px]"
      />
    </div>
  )
}