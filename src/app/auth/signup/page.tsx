import { SignUpForm } from '@/components/auth/SignUpForm'
import { AuthGuard } from '@/components/auth/ProtectedRoute'

export default function SignUpPage() {
  return (
    <AuthGuard requireAuth={false}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <SignUpForm />
      </div>
    </AuthGuard>
  )
}