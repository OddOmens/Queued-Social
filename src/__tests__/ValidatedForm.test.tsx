import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ValidatedForm, QuickForm } from '@/components/ValidatedForm'
import { ErrorHandlingProvider } from '@/components/ErrorHandlingProvider'
import { commonValidationRules } from '@/hooks/useFormValidation'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'

// Mock dependencies
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
  useOfflineDetection: () => ({ isOnline: true, wasOffline: false, justCameOnline: false })
}))

vi.mock('@/hooks/useRetryableAction', () => ({
  useRetryableAction: (action: any) => ({
    execute: action,
    isLoading: false,
    error: null,
    canRetry: true
  })
}))

function renderWithProvider(component: React.ReactElement) {
  return render(
    <ErrorHandlingProvider>
      {component}
    </ErrorHandlingProvider>
  )
}

describe('ValidatedForm', () => {
  const mockOnSubmit = vi.fn()
  
  const initialValues = {
    email: '',
    password: '',
    name: ''
  }

  const validationRules = {
    email: {
      required: true,
      ...commonValidationRules.email
    },
    password: {
      required: true,
      ...commonValidationRules.password
    },
    name: {
      required: true
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render form with custom children', () => {
    renderWithProvider(
      <ValidatedForm
        initialValues={initialValues}
        validationRules={validationRules}
        onSubmit={mockOnSubmit}
      >
        {({ getFieldProps, handleSubmit, isSubmitting }) => (
          <>
            <input {...getFieldProps('email')} placeholder="Email" />
            <input {...getFieldProps('password')} placeholder="Password" type="password" />
            <button type="submit" disabled={isSubmitting}>Submit</button>
          </>
        )}
      </ValidatedForm>
    )

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })

  it('should render form with automatic field generation', () => {
    renderWithProvider(
      <ValidatedForm
        initialValues={initialValues}
        validationRules={validationRules}
        onSubmit={mockOnSubmit}
      />
    )

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })

  it('should validate fields on submit', async () => {
    renderWithProvider(
      <ValidatedForm
        initialValues={initialValues}
        validationRules={validationRules}
        onSubmit={mockOnSubmit}
      />
    )

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    
    // Button should be disabled when form is invalid
    expect(submitButton).toBeDisabled()
    
    fireEvent.click(submitButton)

    // onSubmit should not be called for invalid form
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should submit valid form', async () => {
    mockOnSubmit.mockResolvedValue(undefined)

    renderWithProvider(
      <ValidatedForm
        initialValues={initialValues}
        validationRules={validationRules}
        onSubmit={mockOnSubmit}
      />
    )

    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    })
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John Doe' }
    })

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        name: 'John Doe'
      })
    })
  })

  it('should handle submit errors', async () => {
    const error = new ClientError(ErrorCodes.SERVER_ERROR, 'Server error')
    mockOnSubmit.mockRejectedValue(error)

    renderWithProvider(
      <ValidatedForm
        initialValues={initialValues}
        validationRules={validationRules}
        onSubmit={mockOnSubmit}
      />
    )

    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    })
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John Doe' }
    })

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getAllByText('Server Error')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Server error')[0]).toBeInTheDocument()
    })
  })

  it('should show loading state during submission', async () => {
    let resolveSubmit: () => void
    const submitPromise = new Promise<void>(resolve => {
      resolveSubmit = resolve
    })
    mockOnSubmit.mockReturnValue(submitPromise)

    renderWithProvider(
      <ValidatedForm
        initialValues={initialValues}
        validationRules={validationRules}
        onSubmit={mockOnSubmit}
      />
    )

    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    })
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John Doe' }
    })

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitButton)

    expect(screen.getByText('Submitting...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    resolveSubmit!()
    await waitFor(() => {
      expect(screen.queryByText('Submitting...')).not.toBeInTheDocument()
    })
  })

  it('should reset form on success when enabled', async () => {
    mockOnSubmit.mockResolvedValue(undefined)

    renderWithProvider(
      <ValidatedForm
        initialValues={initialValues}
        validationRules={validationRules}
        onSubmit={mockOnSubmit}
        resetOnSuccess={true}
      />
    )

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement

    // Fill in data
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.change(nameInput, { target: { value: 'John Doe' } })

    expect(emailInput.value).toBe('test@example.com')

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(emailInput.value).toBe('')
      expect(passwordInput.value).toBe('')
      expect(nameInput.value).toBe('')
    })
  })
})

describe('QuickForm', () => {
  const mockOnSubmit = vi.fn()

  const fields = [
    {
      name: 'email',
      label: 'Email Address',
      type: 'email' as const,
      required: true,
      validation: commonValidationRules.email
    },
    {
      name: 'message',
      label: 'Message',
      type: 'textarea' as const,
      required: true
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render quick form with specified fields', () => {
    renderWithProvider(
      <QuickForm
        fields={fields}
        onSubmit={mockOnSubmit}
        submitButtonText="Send Message"
      />
    )

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument()
  })

  it('should submit quick form with field values', async () => {
    mockOnSubmit.mockResolvedValue(undefined)

    renderWithProvider(
      <QuickForm
        fields={fields}
        onSubmit={mockOnSubmit}
      />
    )

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'test@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Hello world' }
    })

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        message: 'Hello world'
      })
    })
  })
})