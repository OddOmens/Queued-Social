'use client'

import React, { useCallback } from 'react'
import { useFormValidation, ValidationRules } from '@/hooks/useFormValidation'
import { useErrorHandling } from './ErrorHandlingProvider'
import { FormField } from './FormField'
import { ErrorRecovery } from './ErrorRecovery'
import { ClientError, ErrorCodes } from '@/utils/errorHandling'

interface ValidatedFormProps<T extends Record<string, any>> {
  initialValues: T
  validationRules: ValidationRules
  onSubmit: (values: T) => Promise<void> | void
  children?: (formProps: {
    values: T
    errors: Record<string, string | null>
    touched: Record<string, boolean>
    isValid: boolean
    hasErrors: boolean
    getFieldProps: (name: string) => any
    handleSubmit: (e: React.FormEvent) => void
    isSubmitting: boolean
  }) => React.ReactNode
  className?: string
  submitButtonText?: string
  showSubmitButton?: boolean
  resetOnSuccess?: boolean
}

export function ValidatedForm<T extends Record<string, any>>({
  initialValues,
  validationRules,
  onSubmit,
  children,
  className = '',
  submitButtonText = 'Submit',
  showSubmitButton = true,
  resetOnSuccess = false
}: ValidatedFormProps<T>) {
  const { reportError } = useErrorHandling()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<ClientError | null>(null)
  
  const {
    values,
    errors,
    touched,
    isValid,
    hasErrors,
    getFieldProps,
    reset,
    validateForm
  } = useFormValidation(initialValues, validationRules)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear previous submit error
    setSubmitError(null)
    
    // Validate all fields
    const formErrors = validateForm()
    const hasValidationErrors = Object.values(formErrors).some(error => error !== null)
    
    if (hasValidationErrors) {
      const validationError = new ClientError(
        ErrorCodes.VALIDATION_ERROR,
        'Please fix the validation errors before submitting',
        { errors: formErrors }
      )
      setSubmitError(validationError)
      return
    }

    setIsSubmitting(true)
    
    try {
      await onSubmit(values)
      
      if (resetOnSuccess) {
        reset()
      }
    } catch (error) {
      const submitError = error instanceof ClientError 
        ? error 
        : new ClientError(
            ErrorCodes.UNKNOWN_ERROR,
            error instanceof Error ? error.message : 'Submit failed'
          )
      
      setSubmitError(submitError)
      reportError(submitError, 'Form submission')
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validateForm, onSubmit, reset, resetOnSuccess, reportError])

  const formProps = {
    values,
    errors,
    touched,
    isValid,
    hasErrors,
    getFieldProps,
    handleSubmit,
    isSubmitting
  }

  if (children) {
    return (
      <form onSubmit={handleSubmit} className={className} noValidate>
        {submitError && (
          <div className="mb-4">
            <ErrorRecovery
              error={submitError}
              onDismiss={() => setSubmitError(null)}
            />
          </div>
        )}
        {children(formProps)}
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      {submitError && (
        <div className="mb-4">
          <ErrorRecovery
            error={submitError}
            onDismiss={() => setSubmitError(null)}
          />
        </div>
      )}
      
      {/* Render form fields automatically */}
      <div className="space-y-4">
        {Object.keys(validationRules).map(fieldName => (
          <FormField
            key={fieldName}
            label={fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
            name={fieldName}
            {...getFieldProps(fieldName)}
          />
        ))}
      </div>
      
      {showSubmitButton && (
        <div className="mt-6">
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              submitButtonText
            )}
          </button>
        </div>
      )}
    </form>
  )
}

// Convenience component for common form patterns
interface QuickFormProps {
  fields: Array<{
    name: string
    label: string
    type?: 'text' | 'email' | 'password' | 'textarea'
    required?: boolean
    validation?: any
  }>
  onSubmit: (values: Record<string, any>) => Promise<void> | void
  submitButtonText?: string
  className?: string
}

export function QuickForm({ fields, onSubmit, submitButtonText, className }: QuickFormProps) {
  const initialValues = fields.reduce((acc, field) => {
    acc[field.name] = ''
    return acc
  }, {} as Record<string, string>)

  const validationRules = fields.reduce((acc, field) => {
    acc[field.name] = {
      required: field.required,
      ...field.validation
    }
    return acc
  }, {} as ValidationRules)

  return (
    <ValidatedForm
      initialValues={initialValues}
      validationRules={validationRules}
      onSubmit={onSubmit}
      submitButtonText={submitButtonText}
      className={className}
    >
      {({ getFieldProps, handleSubmit, isSubmitting, isValid }) => (
        <>
          <div className="space-y-4">
            {fields.map(field => (
              <FormField
                key={field.name}
                label={field.label}
                name={field.name}
                type={field.type}
                {...getFieldProps(field.name)}
              />
            ))}
          </div>
          
          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting || !isValid}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : (submitButtonText || 'Submit')}
            </button>
          </div>
        </>
      )}
    </ValidatedForm>
  )
}