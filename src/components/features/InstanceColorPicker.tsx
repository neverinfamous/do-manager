import { useState } from 'react'
import { Palette, X, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import type { InstanceColor } from '../../types'

/**
 * Available instance colors with their display properties
 */
export const INSTANCE_COLORS: Array<{
  value: InstanceColor
  label: string
  bgClass: string
  borderClass: string
  textClass: string
}> = [
  { value: 'red', label: 'Red', bgClass: 'bg-red-500', borderClass: 'border-red-500', textClass: 'text-red-500' },
  { value: 'orange', label: 'Orange', bgClass: 'bg-orange-500', borderClass: 'border-orange-500', textClass: 'text-orange-500' },
  { value: 'yellow', label: 'Yellow', bgClass: 'bg-yellow-500', borderClass: 'border-yellow-500', textClass: 'text-yellow-500' },
  { value: 'green', label: 'Green', bgClass: 'bg-green-500', borderClass: 'border-green-500', textClass: 'text-green-500' },
  { value: 'teal', label: 'Teal', bgClass: 'bg-teal-500', borderClass: 'border-teal-500', textClass: 'text-teal-500' },
  { value: 'blue', label: 'Blue', bgClass: 'bg-blue-500', borderClass: 'border-blue-500', textClass: 'text-blue-500' },
  { value: 'purple', label: 'Purple', bgClass: 'bg-purple-500', borderClass: 'border-purple-500', textClass: 'text-purple-500' },
  { value: 'pink', label: 'Pink', bgClass: 'bg-pink-500', borderClass: 'border-pink-500', textClass: 'text-pink-500' },
  { value: 'gray', label: 'Gray', bgClass: 'bg-gray-500', borderClass: 'border-gray-500', textClass: 'text-gray-500' },
]

/**
 * Get color config by value
 */
export function getColorConfig(color: InstanceColor): typeof INSTANCE_COLORS[0] | undefined {
  return INSTANCE_COLORS.find((c) => c.value === color)
}

interface InstanceColorPickerProps {
  /** Current color value */
  value: InstanceColor
  /** Callback when color changes */
  onChange: (color: InstanceColor) => Promise<void> | void
  /** Disable the picker */
  disabled?: boolean
  /** Show as small inline picker */
  variant?: 'dropdown' | 'inline'
}

/**
 * Color picker for instance visual organization
 */
export function InstanceColorPicker({
  value,
  onChange,
  disabled = false,
  variant = 'dropdown',
}: InstanceColorPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleColorSelect = async (color: InstanceColor): Promise<void> => {
    setLoading(true)
    try {
      await onChange(color)
      setIsOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const currentColor = getColorConfig(value)

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1">
        {INSTANCE_COLORS.map((color) => (
          <button
            key={color.value ?? 'none'}
            onClick={() => void handleColorSelect(color.value)}
            disabled={disabled || loading}
            className={`w-5 h-5 rounded-full transition-all ${color.bgClass} ${
              value === color.value ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : 'hover:scale-110'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={color.label}
            aria-label={`Set color to ${color.label}`}
          />
        ))}
        {value && (
          <button
            onClick={() => void handleColorSelect(null)}
            disabled={disabled || loading}
            className={`w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center hover:border-destructive hover:text-destructive transition-colors ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="Remove color"
            aria-label="Remove color"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  // Dropdown variant
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className="h-8 w-8 p-0"
        title={currentColor ? `Color: ${currentColor.label}` : 'Set color'}
        aria-label={currentColor ? `Color: ${currentColor.label}` : 'Set color'}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : currentColor ? (
          <div className={`w-4 h-4 rounded-full ${currentColor.bgClass}`} />
        ) : (
          <Palette className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2">
            <div className="grid grid-cols-5 gap-1.5">
              {INSTANCE_COLORS.map((color) => (
                <button
                  key={color.value ?? 'none'}
                  onClick={() => void handleColorSelect(color.value)}
                  disabled={loading}
                  className={`w-6 h-6 rounded-full transition-all ${color.bgClass} ${
                    value === color.value ? 'ring-2 ring-offset-1 ring-offset-background ring-primary' : 'hover:scale-110'
                  }`}
                  title={color.label}
                  aria-label={`Set color to ${color.label}`}
                />
              ))}
            </div>
            {value && (
              <button
                onClick={() => void handleColorSelect(null)}
                disabled={loading}
                className="w-full mt-2 text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1 py-1"
              >
                <X className="h-3 w-3" />
                Remove color
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

