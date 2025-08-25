import { User } from '../../types'

export interface UserFactoryOptions {
  id?: string
  email?: string
  timezone?: string
  createdAt?: Date
}

export const createMockUser = (options: UserFactoryOptions = {}): User => {
  const defaultUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    timezone: 'UTC',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  }

  return {
    ...defaultUser,
    ...options,
  }
}

export const createMockUsers = (count: number, baseOptions: UserFactoryOptions = {}): User[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockUser({
      ...baseOptions,
      id: `user-${index + 1}`,
      email: `user${index + 1}@example.com`,
    })
  )
}

export const createMockAuthUser = (options: UserFactoryOptions = {}) => {
  const user = createMockUser(options)
  
  return {
    user: {
      id: user.id,
      email: user.email,
      created_at: user.createdAt.toISOString(),
      updated_at: user.createdAt.toISOString(),
    },
    session: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
    },
  }
}