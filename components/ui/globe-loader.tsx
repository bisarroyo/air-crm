import { cn } from 'cn'

interface GlobeLoaderProps {
    fullScreen?: boolean
    size?: number
    label?: string
    className?: string
}

interface Dot {
    x: number
    y: number
    r: number
    opacity: string
}

function buildGlobeDots(size: number): Dot[] {
    const cx = size / 2
    const cy = size / 2
    const R = size * 0.4
    const dots: Dot[] = []
    const round = (value: number) => Math.round(value * 100) / 100

    for (let latDeg = -70; latDeg <= 70; latDeg += 20) {
        const latRad = (latDeg * Math.PI) / 180
        const rowRadius = R * Math.cos(latRad)
        const y = round(cy - R * Math.sin(latRad))

        if (rowRadius < 4) {
            dots.push({
                x: round(cx),
                y,
                r: round(size * 0.02),
                opacity: '0.45'
            })
            continue
        }

        const count = Math.max(
            2,
            Math.round((2 * Math.PI * rowRadius) / (size * 0.055))
        )
        for (let i = 0; i < count; i++) {
            const angle = (i * 360) / count
            const rad = (angle * Math.PI) / 180
            const x = round(cx + rowRadius * Math.cos(rad))
            const edge = Math.abs(Math.cos(rad))
            const depth = Math.abs(Math.cos(latRad))
            const opacity = 0.2 + 0.8 * depth * (0.35 + 0.65 * edge)
            dots.push({
                x,
                y,
                r: round(size * 0.02),
                opacity: opacity.toFixed(2)
            })
        }
    }

    return dots
}

export function GlobeLoader({
    fullScreen = true,
    size = 180,
    label = 'Cargando',
    className
}: GlobeLoaderProps) {
    const dots = buildGlobeDots(size)

    const loader = (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-10',
                fullScreen && 'min-h-screen',
                className
            )}>
            <div className='relative' style={{ width: size, height: size }}>
                <div
                    className='absolute inset-0 rounded-full blur-3xl'
                    style={{ background: 'color-mix(in oklab, var(--primary) 12%, transparent)' }}
                />
                <div
                    className='absolute inset-0 animate-spin'
                    style={{ animationDuration: '16s' }}>
                    <svg
                        width={size}
                        height={size}
                        viewBox={`0 0 ${size} ${size}`}
                        fill='none'
                        aria-hidden='true'>
                        {dots.map((dot, index) => (
                            <circle
                                key={index}
                                cx={dot.x}
                                cy={dot.y}
                                r={dot.r}
                                fill='var(--primary)'
                                opacity={dot.opacity}
                            />
                        ))}
                    </svg>
                </div>
                <div
                    className='absolute inset-0 animate-spin rounded-full border border-dashed'
                    style={{
                        animationDuration: '5s',
                        borderColor: 'color-mix(in oklab, var(--primary) 25%, transparent)'
                    }}
                />
                <div
                    className='absolute inset-0 animate-spin'
                    style={{
                        animationDuration: '7s',
                        animationDirection: 'reverse'
                    }}>
                    <div
                        className='absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full'
                        style={{ background: 'color-mix(in oklab, var(--primary) 70%, transparent)' }}
                    />
                </div>
            </div>

            {label && (
                <div className='flex flex-col items-center gap-4'>
                    <p className='text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground'>
                        {label}
                        <span className='ml-1 inline-flex w-6 gap-0.5'>
                            {[0, 150, 300].map((delay) => (
                                <span
                                    key={delay}
                                    className='h-1.5 w-1.5 animate-bounce rounded-full'
                                    style={{
                                        animationDelay: `${delay}ms`,
                                        background: 'var(--primary)'
                                    }}
                                />
                            ))}
                        </span>
                    </p>
                    <div className='h-1 w-48 overflow-hidden rounded-full bg-muted'>
                        <div
                            className='h-full w-1/2 animate-pulse rounded-full'
                            style={{
                                background:
                                    'linear-gradient(to right, var(--primary), var(--accent))'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    )

    if (!fullScreen) {
        return loader
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm'>
            {loader}
        </div>
    )
}