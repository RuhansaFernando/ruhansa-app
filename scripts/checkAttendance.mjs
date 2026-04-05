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

const STUDENTS = [
  'STD001','STD002','STD003','STD004','STD005',
  'STD006','STD007','STD008','STD009','STD010',
  'STD011','STD012','STD013','STD014','STD015',
  'STD016','STD017','STD018','STD019','STD020',
];

async function run() {
  console.log('Fetching attendance records...\n');

  for (const studentId of STUDENTS) {
    const snap = await db.collection('attendance')
      .where('studentId', '==', studentId)
      .get();

    const total = snap.size;

    // Collect unique moduleCode + academicYear + semester combinations
    const combos = new Map();
    snap.docs.forEach((d) => {
      const { moduleCode, academicYear, semester } = d.data();
      const key = `${moduleCode ?? '—'} | ${academicYear ?? '—'} | ${semester ?? '—'}`;
      combos.set(key, (combos.get(key) ?? 0) + 1);
    });

    console.log(`─── ${studentId} ─── (${total} documents)`);
    if (combos.size === 0) {
      console.log('  No records found');
    } else {
      combos.forEach((count, key) => {
        console.log(`  ${key}  (${count} sessions)`);
      });
    }
    console.log();
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
