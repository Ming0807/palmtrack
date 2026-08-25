import { openDB } from "idb";

const databaseName = "palmtrack-prototype";
const storeName = "field-drafts";

export type PrototypeDraft = {
  assignmentId: string;
  checkpoint: "instrument-pending";
  synthetic: true;
  updatedAt: string;
};

function database() {
  return openDB(databaseName, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "assignmentId" });
      }
    },
  });
}

export async function savePrototypeDraft(
  assignmentId: string,
): Promise<PrototypeDraft> {
  const draft: PrototypeDraft = {
    assignmentId,
    checkpoint: "instrument-pending",
    synthetic: true,
    updatedAt: new Date().toISOString(),
  };
  const db = await database();
  await db.put(storeName, draft);
  return draft;
}
