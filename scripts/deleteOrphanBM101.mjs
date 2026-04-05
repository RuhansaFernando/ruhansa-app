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
  // Fetch all BM101 docs for STD002
  const snap = await db.collection('attendance')
    .where('studentId', '==', 'STD002')
    .where('moduleCode', '==', 'BM101')
    .get();

  console.log(`Total BM101 docs found for STD002: ${snap.size}`);

  // Filter client-side: academicYear is null, undefined, missing, or empty string
  const toDelete = snap.docs.filter((d) => {
    const ay = d.data().academicYear;
    return ay === null || ay === undefined || ay === '';
  });

  console.log(`Docs with missing/null/empty academicYear: ${toDelete.length}\n`);

  for (const d of toDelete) {
    const data = d.data();
    console.log(`  Deleting → ${d.id}  |  date: ${data.date}  |  sessionType: ${data.sessionType}  |  status: ${data.status}  |  academicYear: "${data.academicYear ?? 'MISSING'}"`);
    await d.ref.delete();
  }

  console.log(`\nDone. Deleted: ${toDelete.length}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
