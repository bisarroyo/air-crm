'use client'

import { useCallback, useRef } from 'react'

type Caret = { start: number; end: number }

/**
 * Inserta texto en la posición del cursor de un input/textarea controlado en
 * lugar de al final.
 *
 * Hace falta recordar la selección porque al hacer clic en un botón (por
 * ejemplo el de una variable) el campo pierde el foco y `selectionStart` ya no
 * es confiable en ese momento.
 */
export function useInsertAtCursor<T extends HTMLInputElement | HTMLTextAreaElement>() {
    const ref = useRef<T>(null)
    const caret = useRef<Caret | null>(null)

    /** Se engancha a onSelect/onKeyUp/onClick/onBlur para no perder la posición. */
    const remember = useCallback(() => {
        const element = ref.current
        if (!element) return
        caret.current = {
            start: element.selectionStart ?? 0,
            end: element.selectionEnd ?? 0
        }
    }, [])

    const insert = useCallback(
        (text: string, current: string, onChange: (next: string) => void) => {
            const element = ref.current
            const focused =
                element !== null && document.activeElement === element
            const start = focused
                ? (element.selectionStart ?? current.length)
                : (caret.current?.start ?? current.length)
            const end = focused
                ? (element.selectionEnd ?? start)
                : (caret.current?.end ?? start)

            const next = current.slice(0, start) + text + current.slice(end)
            const position = start + text.length
            caret.current = { start: position, end: position }
            onChange(next)

            // Tras el re-render el cursor vuelve al final; se restaura.
            requestAnimationFrame(() => {
                const node = ref.current
                if (!node) return
                node.focus()
                node.setSelectionRange(position, position)
            })
        },
        []
    )

    /** Props para esparcir en el input/textarea. */
    const cursorProps = {
        ref,
        onSelect: remember,
        onKeyUp: remember,
        onClick: remember,
        onBlur: remember
    }

    return { cursorProps, insert }
}