/**
 * JSON autocomplete utilities for textarea elements
 * Provides IDE-like auto-pairing and smart indentation
 */

/** Matching pairs for auto-completion */
const PAIRS: Record<string, string> = {
  '{': '}',
  '[': ']',
  '"': '"',
}

/** Opening characters that trigger auto-pairing */
const OPENERS = new Set(Object.keys(PAIRS))

/** Closing characters */
const CLOSERS = new Set(Object.values(PAIRS))

/**
 * Result of handling a keydown event
 */
export interface AutocompleteResult {
  /** Whether the event was handled (should preventDefault) */
  handled: boolean
  /** New value for the textarea */
  newValue?: string
  /** New cursor position */
  newCursorPos?: number
}

/**
 * Get the current line's indentation
 */
function getLineIndent(text: string, cursorPos: number): string {
  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1
  const lineText = text.slice(lineStart, cursorPos)
  const match = /^(\s*)/.exec(lineText)
  return match?.[1] ?? ''
}

/**
 * Check if cursor is inside an empty pair like {} or []
 */
function isInsideEmptyPair(text: string, cursorPos: number): boolean {
  if (cursorPos === 0 || cursorPos >= text.length) return false
  const before = text[cursorPos - 1]
  const after = text[cursorPos]
  return (before === '{' && after === '}') || 
         (before === '[' && after === ']') ||
         (before === '"' && after === '"')
}

/**
 * Check if the next character is a closing character we should skip
 */
function shouldSkipCloser(text: string, cursorPos: number, char: string): boolean {
  if (cursorPos >= text.length) return false
  return text[cursorPos] === char && CLOSERS.has(char)
}

/**
 * Handle keydown event for JSON autocomplete
 */
export function handleJsonKeydown(
  key: string,
  text: string,
  selectionStart: number,
  selectionEnd: number,
  shiftKey: boolean
): AutocompleteResult {
  const hasSelection = selectionStart !== selectionEnd

  // Handle opening brackets/quotes - auto-pair
  if (OPENERS.has(key) && !hasSelection) {
    const closer = PAIRS[key]
    if (!closer) return { handled: false }
    
    // For quotes, check if we're already inside a string
    if (key === '"') {
      // Skip if the next char is already a quote
      if (shouldSkipCloser(text, selectionStart, '"')) {
        return {
          handled: true,
          newValue: text,
          newCursorPos: selectionStart + 1,
        }
      }
    }

    const newValue = 
      text.slice(0, selectionStart) + 
      key + closer + 
      text.slice(selectionEnd)
    
    return {
      handled: true,
      newValue,
      newCursorPos: selectionStart + 1,
    }
  }

  // Handle closing brackets - skip if already there
  if (CLOSERS.has(key) && !hasSelection) {
    if (shouldSkipCloser(text, selectionStart, key)) {
      return {
        handled: true,
        newValue: text,
        newCursorPos: selectionStart + 1,
      }
    }
  }

  // Handle Enter key - smart indentation
  if (key === 'Enter' && !hasSelection) {
    const currentIndent = getLineIndent(text, selectionStart)
    const charBefore = selectionStart > 0 ? text[selectionStart - 1] : ''
    const charAfter = selectionStart < text.length ? text[selectionStart] : ''
    
    // Inside empty brackets - add extra indentation and closing on new line
    if ((charBefore === '{' && charAfter === '}') || 
        (charBefore === '[' && charAfter === ']')) {
      const newIndent = currentIndent + '  '
      const newValue = 
        text.slice(0, selectionStart) + 
        '\n' + newIndent + '\n' + currentIndent +
        text.slice(selectionStart)
      
      return {
        handled: true,
        newValue,
        newCursorPos: selectionStart + 1 + newIndent.length,
      }
    }
    
    // After opening bracket - increase indent
    if (charBefore === '{' || charBefore === '[') {
      const newIndent = currentIndent + '  '
      const newValue = 
        text.slice(0, selectionStart) + 
        '\n' + newIndent +
        text.slice(selectionStart)
      
      return {
        handled: true,
        newValue,
        newCursorPos: selectionStart + 1 + newIndent.length,
      }
    }
    
    // Normal enter - maintain indentation
    const newValue = 
      text.slice(0, selectionStart) + 
      '\n' + currentIndent +
      text.slice(selectionStart)
    
    return {
      handled: true,
      newValue,
      newCursorPos: selectionStart + 1 + currentIndent.length,
    }
  }

  // Handle Backspace - delete matching pairs
  if (key === 'Backspace' && !hasSelection && selectionStart > 0) {
    if (isInsideEmptyPair(text, selectionStart)) {
      const newValue = 
        text.slice(0, selectionStart - 1) + 
        text.slice(selectionStart + 1)
      
      return {
        handled: true,
        newValue,
        newCursorPos: selectionStart - 1,
      }
    }
  }

  // Handle Tab - insert 2 spaces
  if (key === 'Tab' && !hasSelection && !shiftKey) {
    const newValue = 
      text.slice(0, selectionStart) + 
      '  ' +
      text.slice(selectionEnd)
    
    return {
      handled: true,
      newValue,
      newCursorPos: selectionStart + 2,
    }
  }

  // Handle colon after property name - add space
  if (key === ':' && !hasSelection) {
    // Check if we're likely after a property name (after a quote)
    const charBefore = selectionStart > 0 ? text[selectionStart - 1] : ''
    if (charBefore === '"') {
      const newValue = 
        text.slice(0, selectionStart) + 
        ': ' +
        text.slice(selectionEnd)
      
      return {
        handled: true,
        newValue,
        newCursorPos: selectionStart + 2,
      }
    }
  }

  return { handled: false }
}

/**
 * Format JSON with proper indentation (for "Format" button)
 */
export function formatJson(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as unknown
    return JSON.stringify(parsed, null, 2)
  } catch {
    return null
  }
}

