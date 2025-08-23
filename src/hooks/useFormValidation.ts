import { useState, useCallback, useMemo } from 'react'

export interface ValidationRule<T = any> {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: T) => string | null
  message?: string
}

export interface ValidationRules {
  [key: string]: ValidationRule
}

export interface FormErrors {
  [key: string]: string | null
}

export interface FormTouched {
  [key: string]: boolean
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: ValidationRules
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<FormTouched>({})

  const validateField = useCallback((name: string, value: any): string | null => {
    const rule = validationRules[name]
    if (!rule) return null

    // Required validation
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return rule.message || `${name} is required`
    }

    // Skip other validations if value is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null
    }

    // Custom validation first (before other validations)
    if (rule.custom) {
      const customError = rule.custom(value)
      if (customError) return customError
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return rule.message || `${name} must be at least ${rule.minLength} characters`
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        return rule.message || `${name} must be no more than ${rule.maxLength} characters`
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        return rule.message || `${name} format is invalid`
      }
    }

    return null
  }, [validationRules])

  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {}
    
    Object.keys(validationRules).forEach(name => {
      const error = validateField(name, values[name])
      newErrors[name] = error
    })

    return newErrors
  }, [values, validateField])

  const setValue = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
    
    // Validate field if it has been touched
    if (touched[name]) {
      const error = validateField(name, value)
      setErrors(prev => ({ ...prev, [name]: error }))
    }
  }, [touched, validateField])

  const setFieldTouched = useCallback((name: string, isTouched: boolean = true) => {
    setTouched(prev => ({ ...prev, [name]: isTouched }))
    
    if (isTouched) {
      const error = validateField(name, values[name])
      setErrors(prev => ({ ...prev, [name]: error }))
    }
  }, [values, validateField])

  const handleChange = useCallback((name: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setValue(name, event.target.value)
  }, [setValue])

  const handleBlur = useCallback((name: string) => () => {
    setFieldTouched(name, true)
  }, [setFieldTouched])

  const reset = useCallback((newValues?: Partial<T>) => {
    setValues(newValues ? { ...initialValues, ...newValues } : initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const isValid = useMemo(() => {
    const formErrors = validateForm()
    return Object.values(formErrors).every(error => !error)
  }, [validateForm])

  const hasErrors = useMemo(() => {
    return Object.values(errors).some(error => error !== null)
  }, [errors])

  const getFieldProps = useCallback((name: string) => ({
    value: values[name] || '',
    onChange: handleChange(name),
    onBlur: handleBlur(name),
    error: touched[name] ? errors[name] : null
  }), [values, errors, touched, handleChange, handleBlur])

  return {
    values,
    errors,
    touched,
    isValid,
    hasErrors,
    setValue,
    setFieldTouched,
    validateField,
    validateForm,
    handleChange,
    handleBlur,
    getFieldProps,
    reset
  }
}

// Common validation rules
export const commonValidationRules = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address'
  },
  password: {
    minLength: 8,
    message: 'Password must be at least 8 characters long'
  },
  url: {
    pattern: /^https?:\/\/.+/,
    message: 'Please enter a valid URL'
  },
  required: {
    required: true
  }
}