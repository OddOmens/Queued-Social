import { SignInForm } from '@/components/auth/SignInForm'
import { AuthGuard } from '@/components/auth/ProtectedRoute'

export default function SignInPage() {
  return (
    <AuthGuard requireAuth={false}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <SignInForm />
      </div>
    </AuthGuard>
  )
}