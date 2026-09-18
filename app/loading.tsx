import { Plane } from 'lucide-react'

export default function Loading() {
    return (
        <div className='relative flex min-h-[70vh] flex-col items-center justify-center gap-10 overflow-hidden p-6'>
            <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
                <div className='h-[480px] w-[480px] animate-pulse rounded-full bg-primary/10 blur-3xl' />
                <div className='ml-auto mr-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl' />
            </div>

            <div className='relative flex flex-col items-center gap-10'>
                <div className='relative h-32 w-32'>
                    <div
                        className='absolute inset-0 animate-spin rounded-full border-2 border-dashed border-primary/40'
                        style={{ animationDuration: '8s' }}
                    />
                    <div
                        className='absolute inset-3 animate-spin rounded-full border border-primary/20'
                        style={{
                            animationDuration: '1.6s',
                            animationDirection: 'reverse'
                        }}
                    />
                    <div className='absolute inset-6 animate-pulse rounded-full bg-primary/5' />
                    <div className='absolute inset-0 flex items-center justify-center'>
                        <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25'>
                            <Plane className='h-7 w-7' />
                        </div>
                    </div>
                </div>

                <div className='flex flex-col items-center gap-3'>
                    <p className='flex items-center gap-1 text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground'>
                        Cargando
                        <span className='inline-flex w-6 gap-0.5'>
                            {[0, 150, 300].map((delay) => (
                                <span
                                    key={delay}
                                    className='h-1.5 w-1.5 animate-bounce rounded-full bg-primary'
                                    style={{ animationDelay: `${delay}ms` }}
                                />
                            ))}
                        </span>
                    </p>
                    <div className='h-1 w-48 overflow-hidden rounded-full bg-muted'>
                        <div className='h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-primary to-accent' />
                    </div>
                </div>
            </div>

            <div className='relative w-full max-w-xl space-y-3'>
                <div className='flex items-center justify-between rounded-xl border bg-card p-4'>
                    <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 animate-pulse rounded-full bg-muted' />
                        <div className='space-y-2'>
                            <div className='h-3 w-32 animate-pulse rounded-full bg-muted' />
                            <div className='h-2.5 w-24 animate-pulse rounded-full bg-muted/70' />
                        </div>
                    </div>
                    <div className='flex gap-2'>
                        <div className='h-8 w-20 animate-pulse rounded-lg bg-muted/70' />
                        <div className='h-8 w-8 animate-pulse rounded-lg bg-muted' />
                    </div>
                </div>
                <div className='space-y-2 rounded-xl border bg-card p-4'>
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className='flex items-center justify-between gap-4 border-b border-muted/60 pb-2 last:border-0 last:pb-0'>
                            <div className='flex items-center gap-3'>
                                <div
                                    className='h-3 w-3 animate-pulse rounded-full bg-muted'
                                    style={{
                                        animationDelay: `${i * 120}ms`
                                    }}
                                />
                                <div
                                    className='h-3 w-40 animate-pulse rounded-full bg-muted'
                                    style={{
                                        animationDelay: `${i * 120}ms`
                                    }}
                                />
                            </div>
                            <div
                                className='h-3 w-24 animate-pulse rounded-full bg-muted/70'
                                style={{ animationDelay: `${i * 120}ms` }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}