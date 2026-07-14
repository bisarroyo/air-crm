import {
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectContent,
    Select
} from '@/components/ui/select'

function ColorDot({ color }: { color: string }) {
    return (
        <span
            className='inline-block h-2.5 w-2.5 shrink-0 rounded-full'
            style={{ backgroundColor: color || '#6b7280' }}
        />
    )
}

type Option = {
    id: number | string
    label: string
    color?: string | null
}

interface DisplaySelectProps {
    options: Option[]
    value?: string
    onChange?: (value: string) => void
    firstOptionName?: string
    showFirstOption?: boolean
}

export default function DisplaySelect({
    options,
    value,
    onChange,
    firstOptionName,
    showFirstOption = true
}: DisplaySelectProps) {
    return (
        <Select
            value={value}
            onValueChange={(value) => {
                onChange?.(value ?? '')
            }}>
            <SelectTrigger className='h-8'>
                <SelectValue>
                    {() => {
                        const option = options.find(
                            (o) => String(o.id) === value
                        )

                        if (!option) {
                            return firstOptionName
                        }

                        return (
                            <div className='flex items-center gap-2'>
                                {option?.color && (
                                    <ColorDot color={option.color} />
                                )}
                                <span>{option.label}</span>
                            </div>
                        )
                    }}
                </SelectValue>
            </SelectTrigger>

            <SelectContent>
                <SelectGroup>
                    {showFirstOption && (
                        <SelectItem value=''>{firstOptionName}</SelectItem>
                    )}

                    {options.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)}>
                            {option?.color && <ColorDot color={option.color} />}
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}
