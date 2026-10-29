import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'
function subscribe(onChange: () => void) {
    const query = window.matchMedia(QUERY)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}
const snapshot = () => window.matchMedia(QUERY).matches
const serverSnapshot = () => false

export function useIsMobile() {
    return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
