import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormValidation, commonValidationRules } from '@/hooks/useFormValidation'

describe('useFormValidation', () => {
  const initialValues = {
    email: '',
    password: '',
    name: ''
  }

  const validationRules = {
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email'
    },
    password: {
      required: true,
      minLength: 8,
      message: 'Password must be at least 8 characters'
    },
    name: {
      required: true,
      maxLength: 50,
      message: 'Name is required'
    }
  }

  it('should initialize with initial values', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    expect(result.current.values).toEqual(initialValues)
    expect(result.current.errors).toEqual({})
    expect(result.current.touched).toEqual({})
    expect(result.current.isValid).toBe(false) // Required fields are empty
  })

  it('should validate required fields', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    act(() => {
      result.current.setFieldTouched('email', true)
    })

    expect(result.current.errors.email).toBe('Please enter a valid email')
  })

  it('should validate email pattern', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    act(() => {
      result.current.setValue('email', 'invalid-email')
      result.current.setFieldTouched('email', true)
    })

    expect(result.current.errors.email).toBe('Please enter a valid email')
  })

  it('should validate minimum length', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    act(() => {
      result.current.setValue('password', '123')
      result.current.setFieldTouched('password', true)
    })

    expect(result.current.errors.password).toBe('Password must be at least 8 characters')
  })

  it('should validate maximum length', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    const longName = 'a'.repeat(51)
    
    act(() => {
      result.current.setValue('name', longName)
      result.current.setFieldTouched('name', true)
    })

    expect(result.current.errors.name).toBe('Name is required')
  })

  it('should validate custom validation function', () => {
    const customRules = {
      username: {
        required: true,
        custom: (value: string) => {
          if (value && value.includes(' ')) {
            return 'Username cannot contain spaces'
          }
          return null
        },
        message: 'Username is required'
      }
    }

    const { result } = renderHook(() => 
      useFormValidation({ username: 'user name' }, customRules)
    )

    act(() => {
      result.current.setFieldTouched('username', true)
    })

    expect(result.current.errors.username).toBe('Username cannot contain spaces')
  })

  it('should handle change events', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    const mockEvent = {
      target: { value: 'test@example.com' }
    } as React.ChangeEvent<HTMLInputElement>

    act(() => {
      result.current.handleChange('email')(mockEvent)
    })

    expect(result.current.values.email).toBe('test@example.com')
  })

  it('should handle blur events', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    act(() => {
      result.current.handleBlur('email')()
    })

    expect(result.current.touched.email).toBe(true)
    expect(result.current.errors.email).toBe('Please enter a valid email')
  })

  it('should provide field props', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    const fieldProps = result.current.getFieldProps('email')

    expect(fieldProps.value).toBe('')
    expect(fieldProps.error).toBeNull()
    expect(typeof fieldProps.onChange).toBe('function')
    expect(typeof fieldProps.onBlur).toBe('function')
  })

  it('should reset form', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    act(() => {
      result.current.setValue('email', 'test@example.com')
      result.current.setFieldTouched('email', true)
    })

    expect(result.current.values.email).toBe('test@example.com')
    expect(result.current.touched.email).toBe(true)

    act(() => {
      result.current.reset()
    })

    expect(result.current.values).toEqual(initialValues)
    expect(result.current.touched).toEqual({})
    expect(result.current.errors).toEqual({})
  })

  it('should reset with new values', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    const newValues = { email: 'new@example.com' }

    act(() => {
      result.current.reset(newValues)
    })

    expect(result.current.values.email).toBe('new@example.com')
    expect(result.current.values.password).toBe('')
    expect(result.current.values.name).toBe('')
  })

  it('should validate entire form', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    let formErrors: any = {}

    act(() => {
      formErrors = result.current.validateForm()
    })

    expect(formErrors.email).toBe('Please enter a valid email')
    expect(formErrors.password).toBe('Password must be at least 8 characters')
    expect(formErrors.name).toBe('Name is required')
  })

  it('should report form validity correctly', () => {
    const { result } = renderHook(() => 
      useFormValidation(initialValues, validationRules)
    )

    expect(result.current.isValid).toBe(false)

    act(() => {
      result.current.setValue('email', 'test@example.com')
      result.current.setValue('password', 'password123')
      result.current.setValue('name', 'John Doe')
    })

    expect(result.current.isValid).toBe(true)
  })
})

describe('commonValidationRules', () => {
  it('should have email validation rule', () => {
    expect(commonValidationRules.email.pattern).toBeDefined()
    expect(commonValidationRules.email.message).toBe('Please enter a valid email address')
  })

  it('should have password validation rule', () => {
    expect(commonValidationRules.password.minLength).toBe(8)
    expect(commonValidationRules.password.message).toBe('Password must be at least 8 characters long')
  })

  it('should have URL validation rule', () => {
    expect(commonValidationRules.url.pattern).toBeDefined()
    expect(commonValidationRules.url.message).toBe('Please enter a valid URL')
  })

  it('should have required validation rule', () => {
    expect(commonValidationRules.required.required).toBe(true)
  })
})