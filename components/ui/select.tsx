"use client"

import { Select } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function SelectRoot({
    ...props
}: Select.Root.Props<unknown>) {
    return <Select.Root {...props} />
}

function SelectTrigger({
    className,
    children,
    ...props
}: Select.Trigger.Props) {
    return (
        <Select.Trigger
            data-slot="select-trigger"
            className={cn(
                "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-left outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
                className
            )}
            {...props}
        >
            {children}
            <ChevronDownIcon size={16} className="shrink-0 text-muted-foreground" />
        </Select.Trigger>
    )
}

function SelectValue({
    className,
    ...props
}: Select.Value.Props) {
    return (
        <Select.Value
            data-slot="select-value"
            className={cn("flex-1 truncate", className)}
            {...props}
        />
    )
}

function SelectPopup({
    className,
    children,
    ...props
}: Select.Popup.Props) {
    return (
        <Select.Portal>
            <Select.Backdrop />
            <Select.Positioner
                className="isolate z-50 outline-none"
                side="bottom"
                align="start"
                sideOffset={4}
            >
                <Select.Popup
                    data-slot="select-popup"
                    className={cn(
                        "z-50 max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95",
                        className
                    )}
                    {...props}
                >
                    {children}
                </Select.Popup>
            </Select.Positioner>
        </Select.Portal>
    )
}

function SelectList({
    className,
    ...props
}: Select.List.Props) {
    return (
        <Select.List
            data-slot="select-list"
            className={cn("flex flex-col gap-0.5", className)}
            {...props}
        />
    )
}

function SelectItem({
    className,
    children,
    ...props
}: Select.Item.Props) {
    return (
        <Select.Item
            data-slot="select-item"
            className={cn(
                "group/select-item relative flex cursor-default scroll-my-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 pr-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className
            )}
            {...props}
        >
            {children}
            <span className="pointer-events-none absolute right-2 flex items-center justify-center">
                <Select.ItemIndicator>
                    <CheckIcon size={14} />
                </Select.ItemIndicator>
            </span>
        </Select.Item>
    )
}

function SelectGroup({
    className,
    ...props
}: Select.Group.Props) {
    return (
        <Select.Group
            data-slot="select-group"
            className={cn("flex flex-col gap-0.5", className)}
            {...props}
        />
    )
}

function SelectLabel({
    className,
    ...props
}: Select.GroupLabel.Props) {
    return (
        <Select.GroupLabel
            data-slot="select-label"
            className={cn(
                "px-1.5 py-1 text-xs font-medium text-muted-foreground",
                className
            )}
            {...props}
        />
    )
}

export {
    SelectRoot,
    SelectTrigger,
    SelectValue,
    SelectPopup,
    SelectList,
    SelectItem,
    SelectGroup,
    SelectLabel
}
