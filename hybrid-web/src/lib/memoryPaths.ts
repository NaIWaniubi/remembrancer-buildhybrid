export function memoryCollectionSegments(familyId: string): readonly [string, string, string] {
  return ['families', familyId, 'memories']
}

export function memoryDocumentSegments(familyId: string, id: string): readonly [string, string, string, string] {
  return ['families', familyId, 'memories', id]
}

export function memoryCollectionPath(familyId: string): string {
  return memoryCollectionSegments(familyId).join('/')
}

export function memoryDocumentPath(familyId: string, id: string): string {
  return memoryDocumentSegments(familyId, id).join('/')
}
