import { useState, useCallback, useMemo } from 'react'

export interface SelectionState<T extends { id: string }> {
  /** Set of selected item IDs */
  selectedIds: Set<string>
  /** Number of selected items */
  count: number
  /** Check if an item is selected */
  isSelected: (id: string) => boolean
  /** Toggle selection of an item */
  toggle: (id: string) => void
  /** Select a single item (clearing others) */
  selectOne: (id: string) => void
  /** Select multiple items by ID */
  selectMany: (ids: string[]) => void
  /** Select all items from a list */
  selectAll: (items: T[]) => void
  /** Deselect all items */
  deselectAll: () => void
  /** Clear selection (alias for deselectAll) */
  clear: () => void
  /** Get selected items from a list */
  getSelectedItems: (items: T[]) => T[]
  /** Check if all items are selected */
  isAllSelected: (items: T[]) => boolean
  /** Check if some (but not all) items are selected */
  isSomeSelected: (items: T[]) => boolean
}

/**
 * Generic selection hook for managing multi-select state
 * @template T - Item type with required `id` field
 */
export function useSelection<T extends { id: string }>(): SelectionState<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const count = useMemo(() => selectedIds.size, [selectedIds])

  const isSelected = useCallback(
    (id: string): boolean => selectedIds.has(id),
    [selectedIds]
  )

  const toggle = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectOne = useCallback((id: string): void => {
    setSelectedIds(new Set([id]))
  }, [])

  const selectMany = useCallback((ids: string[]): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((items: T[]): void => {
    setSelectedIds(new Set(items.map((item) => item.id)))
  }, [])

  const deselectAll = useCallback((): void => {
    setSelectedIds(new Set())
  }, [])

  const clear = deselectAll

  const getSelectedItems = useCallback(
    (items: T[]): T[] => items.filter((item) => selectedIds.has(item.id)),
    [selectedIds]
  )

  const isAllSelected = useCallback(
    (items: T[]): boolean => {
      if (items.length === 0) return false
      return items.every((item) => selectedIds.has(item.id))
    },
    [selectedIds]
  )

  const isSomeSelected = useCallback(
    (items: T[]): boolean => {
      if (items.length === 0) return false
      const selectedCount = items.filter((item) => selectedIds.has(item.id)).length
      return selectedCount > 0 && selectedCount < items.length
    },
    [selectedIds]
  )

  return {
    selectedIds,
    count,
    isSelected,
    toggle,
    selectOne,
    selectMany,
    selectAll,
    deselectAll,
    clear,
    getSelectedItems,
    isAllSelected,
    isSomeSelected,
  }
}

