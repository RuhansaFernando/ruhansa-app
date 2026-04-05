import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dir, '..', 'src', 'scripts', 'serviceAccount.json.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function run() {
  const studentIds = ['STD007', 'STD018'];
  let totalDeleted = 0;

  for (const studentId of studentIds) {
    const snap = await db.collection('attendance')
      .where('moduleCode', '==', 'BIS101')
      .where('academicYear', '==', '2024/2025')
      .where('semester', '==', 'Semester 1')
      .where('studentId', '==', studentId)
      .get();

    console.log(`\n[${studentId}] Found ${snap.size} matching document(s):`);

    for (const d of snap.docs) {
      const data = d.data();
      console.log(`  → ${d.id}  |  date: ${data.date}  |  sessionType: ${data.sessionType}  |  status: ${data.status}`);
      await d.ref.delete();
      totalDeleted++;
    }
  }

  console.log(`\nDone. Total deleted: ${totalDeleted}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
