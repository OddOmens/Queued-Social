import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type {
    AuthStore,
    AuthUser,
    UpdatePasswordData,
    UpdateProfileData,
    AuthResponse,
    AuthError
} from '@/types/auth'

// Helper function to convert Supabase auth error to our AuthError type
const mapAuthError = (error: any): AuthError => ({
    message: error?.message || 'An authentication error occurred',
    status: error?.status
})

// Helper function to create auth response
const createAuthResponse = <T>(data: T | null, error: any = null): AuthResponse<T> => ({
    data,
    error: error ? mapAuthError(error) : null
})

export const useAuthStore = create<AuthStore>()(
    devtools(
        persist(
            (set, get) => ({
                // Initial state
                user: null,
                loading: false,
                initialized: false,

                // Actions

                signInWithGoogle: async (): Promise<AuthResponse<null>> => {
                    set({ loading: true })

                    try {
                        const { error } = await supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                                redirectTo: `${window.location.origin}/`
                            }
                        })

                        if (error) {
                            set({ loading: false })
                            return createAuthResponse(null, error)
                        }

                        // OAuth redirect will handle the rest
                        return createAuthResponse(null)
                    } catch (error) {
                        set({ loading: false })
                        return createAuthResponse(null, error)
                    }
                },

                signOut: async (): Promise<AuthResponse<null>> => {
                    set({ loading: true })

                    try {
                        const { error } = await supabase.auth.signOut()

                        if (error) {
                            set({ loading: false })
                            return createAuthResponse(null, error)
                        }

                        set({ user: null, loading: false })
                        return createAuthResponse(null)
                    } catch (error) {
                        set({ loading: false })
                        return createAuthResponse(null, error)
                    }
                },


                updatePassword: async (data: UpdatePasswordData): Promise<AuthResponse<AuthUser>> => {
                    set({ loading: true })

                    try {
                        const { data: authData, error } = await supabase.auth.updateUser({
                            password: data.password
                        })

                        if (error) {
                            set({ loading: false })
                            return createAuthResponse<AuthUser>(null, error)
                        }

                        const user = authData.user as AuthUser
                        set({ user, loading: false })
                        return createAuthResponse(user)
                    } catch (error) {
                        set({ loading: false })
                        return createAuthResponse<AuthUser>(null, error)
                    }
                },

                updateProfile: async (data: UpdateProfileData): Promise<AuthResponse<AuthUser>> => {
                    set({ loading: true })

                    try {
                        const updateData: any = {}

                        if (data.fullName !== undefined) {
                            updateData.data = { full_name: data.fullName }
                        }

                        const { data: authData, error } = await supabase.auth.updateUser(updateData)

                        if (error) {
                            set({ loading: false })
                            return createAuthResponse<AuthUser>(null, error)
                        }

                        // Also update user profile in database if timezone is provided
                        if (data.timezone && authData.user) {
                            const { error: profileError } = await supabase
                                .from('user_profiles')
                                .upsert({
                                    id: authData.user.id,
                                    timezone: data.timezone,
                                    updated_at: new Date().toISOString()
                                })

                            if (profileError) {
                                console.warn('Failed to update user profile:', profileError)
                            }
                        }

                        const user = authData.user as AuthUser
                        set({ user, loading: false })
                        return createAuthResponse(user)
                    } catch (error) {
                        set({ loading: false })
                        return createAuthResponse<AuthUser>(null, error)
                    }
                },

                refreshSession: async (): Promise<AuthResponse<AuthUser>> => {
                    try {
                        const { data: { session }, error } = await supabase.auth.refreshSession()

                        if (error) {
                            return createAuthResponse<AuthUser>(null, error)
                        }

                        const user = session?.user as AuthUser
                        set({ user })
                        return createAuthResponse(user)
                    } catch (error) {
                        return createAuthResponse<AuthUser>(null, error)
                    }
                },

                // Internal actions
                setUser: (user: AuthUser | null) => set({ user }),
                setLoading: (loading: boolean) => set({ loading }),
                setInitialized: (initialized: boolean) => set({ initialized }),

                initialize: async () => {
                    if (get().initialized) return

                    set({ loading: true })

                    try {
                        // Get initial session
                        const { data: { session }, error } = await supabase.auth.getSession()

                        if (error) {
                            console.error('Error getting session:', error)
                            set({ user: null, loading: false, initialized: true })
                            return
                        }

                        const user = session?.user as AuthUser | null
                        set({ user, loading: false, initialized: true })

                        // Listen for auth changes
                        supabase.auth.onAuthStateChange(async (event: string, session: any) => {
                            const user = session?.user as AuthUser | null

                            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                                set({ user, loading: false })
                            } else if (event === 'SIGNED_OUT') {
                                set({ user: null, loading: false })
                            }
                        })
                    } catch (error) {
                        console.error('Error initializing auth:', error)
                        set({ user: null, loading: false, initialized: true })
                    }
                }
            }),
            {
                name: 'auth-store',
                partialize: (state) => ({
                    // Only persist user data, not loading states
                    user: state.user
                })
            }
        ),
        { name: 'auth-store' }
    )
)
