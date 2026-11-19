/** Put the items in the list: the ones already there (same id) are replaced, new ones go first. Meant for Redux reducers (Immer drafts). */
export function upsertById<T extends { id: string }>(list: T[], items: T[]) {
  for (const item of items) {
    const index = list.findIndex(existingItem => existingItem.id === item.id);
    if (index >= 0) list[index] = item; else list.unshift(item);
  }
}
