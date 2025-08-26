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
    block w-full rounded-lg border-0 py-3 px-4 text-gray-100 shadow-sm ring-1 ring-inset 
    placeholder:text-gray-400 focus:ring-2 focus:ring-inset text-sm leading-6 transition-colors
    ${error 
      ? 'ring-red-500 focus:ring-red-500 bg-red-900/20' 
      : isFocused 
        ? 'ring-blue-500 bg-gray-800' 
        : 'ring-gray-700 focus:ring-blue-500 bg-gray-900'
    }
    ${disabled ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : ''}
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
        <label htmlFor={fieldId} className="block text-sm font-medium leading-6 text-gray-300">
          {label}
          {required && <span className="text-red-400 ml-1" aria-label="required">*</span>}
        </label>
        {showCharacterCount && maxLength && (
          <span 
            id={countId}
            className={`text-xs ${
              value.length > maxLength * 0.9 
                ? value.length >= maxLength 
                  ? 'text-red-400' 
                  : 'text-yellow-400'
                : 'text-gray-400'
            }`}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <div className="mt-2">
        {renderInput()}
        {helpText && (
          <p id={helpId} className="mt-1 text-sm text-gray-400">
            {helpText}
          </p>
        )}
        <InlineError error={error ?? null} />
      </div>
    </div>
  )
}