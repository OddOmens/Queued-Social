import React, { useState } from 'react'
import { InlineError } from './ErrorMessage'

interface FormFieldProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'textarea' | 'select'
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  error?: string | null
  placeholder?: string
  required?: boolean
  disabled?: boolean
  options?: { value: string; label: string }[]
  rows?: number
  className?: string
  helpText?: string
  showCharacterCount?: boolean
  maxLength?: number
  autoComplete?: string
  'aria-describedby'?: string
}

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required = false,
  disabled = false,
  options = [],
  rows = 3,
  className = '',
  helpText,
  showCharacterCount = false,
  maxLength,
  autoComplete,
  'aria-describedby': ariaDescribedBy
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const fieldId = `field-${name}`
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`
  const countId = `${fieldId}-count`

  const getAriaDescribedBy = () => {
    const ids = []
    if (error) ids.push(errorId)
    if (helpText) ids.push(helpId)
    if (showCharacterCount && maxLength) ids.push(countId)
    if (ariaDescribedBy) ids.push(ariaDescribedBy)
    return ids.length > 0 ? ids.join(' ') : undefined
  }

  const baseInputClasses = `
    block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset 
    placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition-colors
    ${error 
      ? 'ring-red-300 focus:ring-red-500' 
      : isFocused 
        ? 'ring-blue-600' 
        : 'ring-gray-300 focus:ring-blue-600'
    }
    ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}
  `.trim()

  const handleFocus = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setIsFocused(true)
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setIsFocused(false)
    onBlur?.(event)
  }

  const renderInput = () => {
    const commonProps = {
      id: fieldId,
      name,
      value,
      onChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      placeholder,
      required,
      disabled,
      className: baseInputClasses,
      'aria-invalid': (error ? 'true' : 'false') as 'true' | 'false',
      'aria-describedby': getAriaDescribedBy(),
      maxLength,
      autoComplete
    }

    switch (type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={rows}
          />
        )
      
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">{placeholder || 'Select an option'}</option>
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )
      
      default:
        return (
          <input
            {...commonProps}
            type={type}
          />
        )
    }
  }

  return (
    <div className={className}>
      <div className="flex justify-between items-center">
        <label htmlFor={fieldId} className="block text-sm font-medium leading-6 text-gray-900">
          {label}
          {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
        {showCharacterCount && maxLength && (
          <span 
            id={countId}
            className={`text-xs ${
              value.length > maxLength * 0.9 
                ? value.length >= maxLength 
                  ? 'text-red-600' 
                  : 'text-yellow-600'
                : 'text-gray-500'
            }`}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <div className="mt-2">
        {renderInput()}
        {helpText && (
          <p id={helpId} className="mt-1 text-sm text-gray-600">
            {helpText}
          </p>
        )}
        <InlineError error={error} />
      </div>
    </div>
  )
}