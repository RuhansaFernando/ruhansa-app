// ============================================================
// studentViewedService.ts  —  Novelty 3
// Records when a student has viewed their own Academic Health
// profile. The SSA can see this cross-portal signal.
// ============================================================

import { collection, addDoc, getDocs, query, where, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * Called from StudentDashboard when the student views their health profile.
 * Writes/updates a record in Firestore so the SSA knows the student
 * has engaged with their own risk data (Novelty 3 cross-portal signal).
 */
export async function markStudentProfileViewed(studentId: string): Promise<void> {
  if (!studentId) return;
  try {
    const existing = await getDocs(
      query(collection(db, 'studentProfileViews'), where('studentId', '==', studentId))
    );
    if (existing.empty) {
      await addDoc(collection(db, 'studentProfileViews'), {
        studentId,
        viewedAt: serverTimestamp(),
        viewCount: 1,
      });
    } else {
      const docRef = doc(db, 'studentProfileViews', existing.docs[0].id);
      await updateDoc(docRef, {
        viewedAt: serverTimestamp(),
        viewCount: (existing.docs[0].data().viewCount ?? 0) + 1,
      });
    }
  } catch {
    // Non-critical — silently ignore errors so the dashboard still loads
  }
}
