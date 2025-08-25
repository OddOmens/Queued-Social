# Authentication System

This directory contains the complete authentication system for the Social Media Scheduler application, built with Supabase Auth and Zustand for state management.

## Components

### Core Components

- **`AuthProvider`** - Root provider that initializes authentication state
- **`SignInForm`** - Login form with email/password authentication
- **`SignUpForm`** - Registration form with enhanced validation
- **`ProtectedRoute`** - Wrapper for routes that require authentication
- **`AuthGuard`** - Conditional rendering based on auth state
- **`UserMenu`** - User dropdown menu with profile and logout options

### Authentication Pages

- **`/auth/signin`** - Sign in page
- **`/auth/signup`** - Sign up page  
- **`/auth/forgot-password`** - Password reset request page
- **`/auth/reset-password`** - Password reset form page

## State Management

The authentication state is managed using Zustand with the following features:

- **Persistent state** - User session persists across browser sessions
- **Automatic initialization** - Auth state is initialized on app load
- **Real-time updates** - Listens to Supabase auth state changes
- **Loading states** - Proper loading indicators during auth operations

### Auth Store Actions

```typescript
// Sign up new user
const { data, error } = await signUp({
  email: 'user@example.com',
  password: 'securePassword123!',
  fullName: 'John Doe'
})

// Sign in existing user
const { data, error } = await signIn({
  email: 'user@example.com',
  password: 'securePassword123!'
})

// Sign out current user
const { error } = await signOut()

// Reset password
const { error } = await resetPassword({
  email: 'user@example.com'
})

// Update password
const { data, error } = await updatePassword({
  password: 'newSecurePassword123!'
})

// Update user profile
const { data, error } = await updateProfile({
  fullName: 'Jane Doe',
  timezone: 'America/New_York'
})
```

## API Routes

### Authentication Endpoints

- **`GET /api/auth/me`** - Get current user information
- **`PUT /api/auth/profile`** - Update user profile
- **`POST /api/auth/logout`** - Server-side logout
- **`POST /api/auth/refresh`** - Refresh authentication session

### Middleware Protection

API routes are protected using the authentication middleware:

```typescript
import { requireAuth } from '@/middleware/auth'

export const GET = requireAuth(async (request, user) => {
  // User is guaranteed to be authenticated
  // Access user data via the user parameter
})
```

## Route Protection

### Client-Side Protection

```typescript
// Protect entire pages
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>Protected content</div>
    </ProtectedRoute>
  )
}

// Conditional rendering
export default function HomePage() {
  return (
    <AuthGuard requireAuth={false}>
      <div>Public content</div>
    </AuthGuard>
  )
}
```

### Server-Side Protection

The Next.js middleware automatically handles route protection:

- **Public routes**: `/`, `/auth/*`
- **Protected routes**: `/dashboard/*`, `/settings/*`, `/profile/*`
- **Auth routes**: Redirect authenticated users away from login/signup

## Validation & Security

### Password Validation

Strong password requirements enforced:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- At least one special character

### Email Validation

Standard email format validation with regex pattern matching.

### Error Handling

User-friendly error messages for common authentication scenarios:
- Invalid credentials
- Email not verified
- Password too weak
- Account already exists
- Rate limiting

## Utilities

### Auth Utilities (`/utils/auth.ts`)

```typescript
// Check user roles
const isUserAdmin = isAdmin(user)
const hasModeratorRole = hasRole(user, 'moderator')

// Get display information
const displayName = getUserDisplayName(user)
const initials = getUserInitials(user)

// Validation helpers
const { isValid, errors } = validatePassword('password123')
const isValidEmail = validateEmail('user@example.com')

// Error formatting
const friendlyMessage = formatAuthError(supabaseError)
```

### Custom Hooks (`/hooks/useAuth.ts`)

```typescript
// Main auth hook
const { user, loading, signIn, signOut } = useAuth()

// Specific hooks
const user = useUser()
const isAuthenticated = useIsAuthenticated()
const loading = useAuthLoading()
const initialized = useAuthInitialized()
```

## Testing

Comprehensive test coverage includes:

- **Unit tests** - Auth store logic and utilities
- **Integration tests** - Component authentication flows
- **Mocked Supabase** - Tests run without external dependencies

Run tests with:
```bash
npm test
```

## Environment Variables

Required environment variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Database Schema

The authentication system uses these Supabase tables:

- **`auth.users`** - Built-in Supabase auth users table
- **`user_profiles`** - Extended user profile information
- **`platform_credentials`** - Encrypted social media platform credentials

## Security Features

- **Row Level Security (RLS)** - Database-level access control
- **JWT tokens** - Secure session management
- **Encrypted credentials** - Platform API keys stored securely
- **Rate limiting** - Protection against brute force attacks
- **CSRF protection** - Built-in Next.js security features

## Usage Examples

### Basic Authentication Flow

```typescript
// 1. Initialize auth in root layout
<AuthProvider>
  <App />
</AuthProvider>

// 2. Protect routes
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// 3. Use auth state in components
const { user, signOut } = useAuth()

if (user) {
  return <UserDashboard user={user} onSignOut={signOut} />
}
```

### Advanced Usage

```typescript
// Custom auth guard with redirect
<AuthGuard 
  requireAuth={true}
  redirectTo="/custom-login"
  fallback={<CustomLoader />}
>
  <ProtectedContent />
</AuthGuard>

// Role-based access control
const AdminPanel = () => {
  const user = useUser()
  
  if (!isAdmin(user)) {
    return <AccessDenied />
  }
  
  return <AdminDashboard />
}
```

This authentication system provides a complete, secure, and user-friendly authentication experience that integrates seamlessly with the rest of the Social Media Scheduler application.