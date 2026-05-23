import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'

interface AuthProviderProps {
    children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const initialize = useAuthStore((state) => state.initialize)
    const initialized = useAuthStore((state) => state.initialized)

    useEffect(() => {
        if (!initialized) {
            initialize()
        }
    }, [initialize, initialized])

    // Optionally render a loading spinner while initializing
    // if (!initialized) return <div>Loading...</div>

    return <>{children}</>
}
