import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs,
         updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDoNXALcDqWf68M6zeNf24xNu3fDWhEDmQ",
  authDomain: "ruhansa-testapp.firebaseapp.com",
  projectId: "ruhansa-testapp",
  storageBucket: "ruhansa-testapp.firebasestorage.app",
  messagingSenderId: "52270647708",
  appId: "1:52270647708:web:cd743e2957cf42d7336059"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearOldFlags() {
  const snap = await getDocs(collection(db, 'students'));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.flagged === true &&
        data.flagReason !== 'ML model: high dropout risk' &&
        data.flagReason !== 'ML model: risk increased significantly') {
      await updateDoc(doc(db, 'students', d.id), {
        flagged: false,
        resolvedAt: new Date().toISOString(),
      });
      count++;
      console.log(`Cleared flag for ${data.name}`);
    }
  }
  console.log(`Done. Cleared ${count} old flags.`);
}

clearOldFlags();
