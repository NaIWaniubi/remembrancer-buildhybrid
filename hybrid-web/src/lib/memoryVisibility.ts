export interface VisibleMemory {
  id?: string
  visibleTo?: string[]
}

export function filterMemoriesByMembers<T extends VisibleMemory>(
  memories: readonly T[],
  activeMemberIds: readonly string[]
): T[] {
  if (activeMemberIds.length === 0) return []
  return memories.filter(
    (memory) => !memory.visibleTo?.length || memory.visibleTo.some((id) => activeMemberIds.includes(id))
  )
}
