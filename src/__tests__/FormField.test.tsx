import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormField } from '@/components/FormField'

describe('FormField', () => {
  const defaultProps = {
    label: 'Test Field',
    name: 'test',
    value: '',
    onChange: vi.fn()
  }

  it('should render basic form field', () => {
    render(<FormField {...defaultProps} />)
    
    expect(screen.getByLabelText('Test Field')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should show required indicator', () => {
    render(<FormField {...defaultProps} required />)
    
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('should show error message', () => {
    render(<FormField {...defaultProps} error="This field is required" />)
    
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('should show help text', () => {
    render(<FormField {...defaultProps} helpText="Enter your name" />)
    
    expect(screen.getByText('Enter your name')).toBeInTheDocument()
  })

  it('should show character count', () => {
    render(
      <FormField 
        {...defaultProps} 
        value="Hello" 
        showCharacterCount 
        maxLength={10} 
      />
    )
    
    expect(screen.getByText('5/10')).toBeInTheDocument()
  })

  it('should render textarea', () => {
    render(<FormField {...defaultProps} type="textarea" />)
    
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA')
  })

  it('should render select', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' }
    ]
    
    render(<FormField {...defaultProps} type="select" options={options} />)
    
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
  })

  it('should handle focus and blur events', () => {
    const onBlur = vi.fn()
    render(<FormField {...defaultProps} onBlur={onBlur} />)
    
    const input = screen.getByRole('textbox')
    
    fireEvent.focus(input)
    fireEvent.blur(input)
    
    expect(onBlur).toHaveBeenCalled()
  })

  it('should apply error styling', () => {
    render(<FormField {...defaultProps} error="Error message" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('ring-red-300')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<FormField {...defaultProps} disabled />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
    expect(input).toHaveClass('bg-gray-50')
  })

  it('should have proper accessibility attributes', () => {
    render(
      <FormField 
        {...defaultProps} 
        error="Error message"
        helpText="Help text"
        aria-describedby="custom-description"
      />
    )
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby')
    
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toContain('error')
    expect(describedBy).toContain('help')
    expect(describedBy).toContain('custom-description')
  })
})