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

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const STUDENT_ID = 'STD007';
const MODULE_CODE = 'BIS101';
const ACADEMIC_YEAR = '2022/2023';
const SEMESTER = 'Semester 1';
const STATUS = 'present';

const DATES = [
  '2022-09-05','2022-09-12','2022-09-19','2022-09-26',
  '2022-10-03','2022-10-10','2022-10-17','2022-10-24',
  '2022-10-31','2022-11-07','2022-11-14','2022-11-21',
];

const SESSION_TYPES = ['Lecture', 'Tutorial'];

async function run() {
  // Step 1: Look up BIS101 module document
  console.log(`Looking up module ${MODULE_CODE}...\n`);

  const modulesSnap = await db.collection('modules').get();
  let moduleId = null;
  let moduleName = '';

  modulesSnap.forEach((d) => {
    const code = (d.data().moduleCode ?? '').trim().toUpperCase();
    if (code === MODULE_CODE) {
      moduleId = d.id;
      moduleName = d.data().moduleName ?? '';
    }
  });

  if (!moduleId) {
    console.error(`ERROR: Module ${MODULE_CODE} not found in Firestore.`);
    process.exit(1);
  }

  console.log(`  ${MODULE_CODE} → ${moduleId}  "${moduleName}"\n`);

  // Step 2: Build 24 records (12 dates × 2 session types)
  const records = [];
  for (const date of DATES) {
    for (const sessionType of SESSION_TYPES) {
      const docId = `${STUDENT_ID}_${moduleId}_${date}_${sessionType}`;
      records.push({
        docId,
        data: {
          studentId: STUDENT_ID,
          moduleId,
          moduleCode: MODULE_CODE,
          moduleName,
          academicYear: ACADEMIC_YEAR,
          semester: SEMESTER,
          date,
          sessionType,
          status: STATUS,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    }
  }

  console.log(`Total records to write: ${records.length}\n`);

  // Step 3: Write in a single batch
  const batch = db.batch();
  records.forEach(({ docId, data }) => {
    batch.set(db.collection('attendance').doc(docId), data);
  });

  await batch.commit();
  console.log(`  Committed batch: ${records.length}/${records.length}`);
  console.log(`\nDone. Total documents written: ${records.length}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
