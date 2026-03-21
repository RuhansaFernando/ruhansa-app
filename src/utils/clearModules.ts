import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export async function clearAllModules(): Promise<number> {
  const snap = await getDocs(collection(db, 'modules'));
  if (snap.empty) return 0;

  // Firestore batches are limited to 500 ops each
  const batches: ReturnType<typeof writeBatch>[] = [];
  let current = writeBatch(db);
  let count = 0;

  snap.docs.forEach((d, i) => {
    current.delete(d.ref);
    count++;
    if ((i + 1) % 500 === 0) {
      batches.push(current);
      current = writeBatch(db);
    }
  });
  batches.push(current);

  await Promise.all(batches.map((b) => b.commit()));
  return count;
}
