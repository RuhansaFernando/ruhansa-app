import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export type NotificationType = 'risk_alert' | 'appointment' | 'intervention' | 'mentor';

export async function createNotification(params: {
  studentId: string;
  uid: string;
  type: NotificationType;
  title: string;
  message: string;
}) {
  if (!params.uid && !params.studentId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      studentId: params.studentId,
      uid:       params.uid,
      type:      params.type,
      title:     params.title,
      message:   params.message,
      read:      false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-critical — silently ignore
    console.error('createNotification failed:', err);
  }
}
