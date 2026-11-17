import { db } from '../db.ts';
import type { Sheet } from './model.ts';

/** A score opened from someone's share link: kept on this device so it opens offline. */
export type SharedSheetRecord = { id: string; ownerUid: string; ownerName: string; sheet: Sheet; updatedAt: string; openedAt: string };

export const listSheets = (): Promise<Sheet[]> => db.sheets.orderBy('updatedAt').reverse().toArray();
export const getSheet = (id: string): Promise<Sheet | undefined> => db.sheets.get(id);
export const saveSheet = async (sheet: Sheet): Promise<void> => { await db.sheets.put(sheet); };
export const deleteSheet = async (id: string): Promise<void> => { await db.sheets.delete(id); };

export const listSharedSheets = (): Promise<SharedSheetRecord[]> => db.sharedSheets.orderBy('openedAt').reverse().toArray();
export const getSharedSheet = (id: string): Promise<SharedSheetRecord | undefined> => db.sharedSheets.get(id);
export const keepSharedSheet = async (record: SharedSheetRecord): Promise<void> => { await db.sharedSheets.put(record); };
export const forgetSharedSheet = async (id: string): Promise<void> => { await db.sharedSheets.delete(id); };

/** A copy of a shared score in the musician's own library, editable and independent. */
export const copySharedSheet = async (record: SharedSheetRecord): Promise<Sheet> => {
  const stamp = new Date().toISOString();
  const { shared: _shared, ...rest } = record.sheet;
  const copy: Sheet = { ...rest, id: crypto.randomUUID(), sharedFrom: { id: record.id, ownerName: record.ownerName }, createdAt: stamp, updatedAt: stamp };
  await saveSheet(copy);
  return copy;
};
