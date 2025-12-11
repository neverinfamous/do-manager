import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'

interface TagEditorProps {
    tags: string[]
    onChange: (tags: string[]) => void
    maxTags?: number
    maxTagLength?: number
    suggestions?: string[]
    disabled?: boolean
    placeholder?: string
}

/**
 * Tag editor component for managing instance tags
 * Supports adding, removing tags with keyboard navigation
 */
export function TagEditor({
    tags,
    onChange,
    maxTags = 20,
    maxTagLength = 50,
    suggestions = [],
    disabled = false,
    placeholder = 'Add a tag...',
}: TagEditorProps): React.ReactElement {
    const [inputValue, setInputValue] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Filter suggestions based on input
    const filteredSuggestions = suggestions.filter(
        (s) =>
            s.toLowerCase().includes(inputValue.toLowerCase()) &&
            !tags.includes(s) &&
            s !== inputValue
    ).slice(0, 5)

    // Add a new tag
    const addTag = useCallback((tag: string) => {
        const trimmed = tag.trim()
        if (!trimmed) return
        if (trimmed.length > maxTagLength) return
        if (tags.length >= maxTags) return
        if (tags.includes(trimmed)) return

        onChange([...tags, trimmed])
        setInputValue('')
        setShowSuggestions(false)
    }, [tags, onChange, maxTags, maxTagLength])

    // Remove a tag by index
    const removeTag = useCallback((index: number) => {
        const newTags = [...tags]
        newTags.splice(index, 1)
        onChange(newTags)
    }, [tags, onChange])

    // Handle input key events
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag(inputValue)
        } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            // Remove last tag on backspace when input is empty
            removeTag(tags.length - 1)
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
            inputRef.current?.blur()
        }
    }

    // Handle paste - split by common delimiters
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
        const pastedText = e.clipboardData.getData('text')
        if (pastedText.includes(',') || pastedText.includes('\n')) {
            e.preventDefault()
            const newTags = pastedText
                .split(/[,\n]/)
                .map((t) => t.trim())
                .filter((t) => t.length > 0 && t.length <= maxTagLength && !tags.includes(t))
                .slice(0, maxTags - tags.length)

            if (newTags.length > 0) {
                onChange([...tags, ...newTags])
            }
        }
    }

    // Handle click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent): void => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const canAddMore = tags.length < maxTags

    return (
        <div ref={containerRef} className="space-y-2">
            {/* Tag pills */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5" role="list" aria-label="Current tags">
                    {tags.map((tag, index) => {
                        // Style key:value tags differently
                        const isKeyValue = tag.includes(':')
                        const [key, value] = isKeyValue ? tag.split(':') : [tag, null]

                        return (
                            <Badge
                                key={`${tag}-${index}`}
                                variant="secondary"
                                className="flex items-center gap-1 pr-1"
                                role="listitem"
                            >
                                {isKeyValue ? (
                                    <>
                                        <span className="text-muted-foreground">{key}:</span>
                                        <span>{value}</span>
                                    </>
                                ) : (
                                    <span>{tag}</span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeTag(index)}
                                    disabled={disabled}
                                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                    aria-label={`Remove tag ${tag}`}
                                >
                                    <X className="h-3 w-3" aria-hidden="true" />
                                </button>
                            </Badge>
                        )
                    })}
                </div>
            )}

            {/* Input for adding tags */}
            <div className="relative">
                <label htmlFor="tag-input" className="sr-only">Add a tag</label>
                <div className="flex gap-2">
                    <Input
                        ref={inputRef}
                        id="tag-input"
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value)
                            setShowSuggestions(e.target.value.length > 0)
                        }}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onFocus={() => inputValue.length > 0 && setShowSuggestions(true)}
                        placeholder={canAddMore ? placeholder : `Maximum ${maxTags} tags reached`}
                        disabled={disabled || !canAddMore}
                        className="flex-1"
                        aria-describedby="tag-help"
                        autoComplete="off"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addTag(inputValue)}
                        disabled={disabled || !canAddMore || !inputValue.trim()}
                        aria-label="Add tag"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
                <p id="tag-help" className="sr-only">
                    Press Enter or comma to add a tag. Press Backspace to remove the last tag.
                </p>

                {/* Status message */}
                <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                    <span>{tags.length} / {maxTags} tags</span>
                    {inputValue.length > maxTagLength * 0.8 && (
                        <span className={inputValue.length > maxTagLength ? 'text-destructive' : ''}>
                            {inputValue.length} / {maxTagLength} characters
                        </span>
                    )}
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                    <div
                        className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md"
                        role="listbox"
                        aria-label="Tag suggestions"
                    >
                        {filteredSuggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => addTag(suggestion)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                                role="option"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
