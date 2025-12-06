import type { InstanceColor } from '../types'

/**
 * Available instance colors with their display properties
 */
export const INSTANCE_COLORS: {
  value: InstanceColor
  label: string
  bgClass: string
  borderClass: string
  textClass: string
}[] = [
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

