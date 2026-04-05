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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PATTERN_A = [
  'present','present','present','present','absent','present',
  'present','present','present','absent','present','present',
  'absent','present','present','present','present','absent',
  'present','present','present','present','present','absent',
];

const PATTERN_B = [
  'present','present','present','absent','absent','present',
  'present','present','present','absent','present','absent',
  'present','present','absent','present','present','absent',
  'present','present','absent','present','present','absent',
];

const BATCHES = [
  {
    studentId: 'STD005', academicYear: '2024/2025', semester: 'Semester 1',
    sessionTypes: ['Lecture', 'Tutorial'], recordedBy: 'Test Faculty Business',
    pattern: PATTERN_A,
    dates: ['2024-09-09','2024-09-16','2024-09-23','2024-09-30','2024-10-07','2024-10-14','2024-10-21','2024-10-28','2024-11-04','2024-11-11','2024-11-18','2024-11-25'],
    moduleCodes: ['AF201','AF203','AF206'],
  },
  {
    studentId: 'STD005', academicYear: '2024/2025', semester: 'Semester 2',
    sessionTypes: ['Lecture', 'Tutorial'], recordedBy: 'Test Faculty Business',
    pattern: PATTERN_A,
    dates: ['2025-01-14','2025-01-21','2025-01-28','2025-02-04','2025-02-11','2025-02-18','2025-02-25','2025-03-04','2025-03-11','2025-03-18','2025-03-25','2025-04-01'],
    moduleCodes: ['AF202','AF204','AF205'],
  },
  {
    studentId: 'STD005', academicYear: '2025/2026', semester: 'Semester 1',
    sessionTypes: ['Lecture', 'Tutorial'], recordedBy: 'Test Faculty Business',
    pattern: PATTERN_B,
    dates: ['2025-09-09','2025-09-16','2025-09-23','2025-09-30','2025-10-07','2025-10-14','2025-10-21','2025-10-28','2025-11-04','2025-11-11','2025-11-18','2025-11-25'],
    moduleCodes: ['AF301','AF303','AF304'],
  },
  {
    studentId: 'STD005', academicYear: '2025/2026', semester: 'Semester 2',
    sessionTypes: ['Lecture', 'Tutorial'], recordedBy: 'Test Faculty Business',
    pattern: PATTERN_B,
    dates: ['2026-01-13','2026-01-20','2026-01-27','2026-02-03','2026-02-10','2026-02-17','2026-02-24','2026-03-03','2026-03-10','2026-03-17','2026-03-24','2026-03-31'],
    moduleCodes: ['AF302','AF305','AF306'],
  },
  {
    studentId: 'STD011', academicYear: '2025/2026', semester: 'Semester 2',
    sessionTypes: ['Lecture', 'Lab'], recordedBy: 'Test Faculty Engineering',
    pattern: PATTERN_A,
    dates: ['2026-01-13','2026-01-20','2026-01-27','2026-02-03','2026-02-10','2026-02-17','2026-02-24','2026-03-03','2026-03-10','2026-03-17','2026-03-24','2026-03-31'],
    moduleCodes: ['EE106'],
  },
];

async function run() {
  // ── Step 1: Look up all module IDs ─────────────────────────────────────────
  const allCodes = [...new Set(BATCHES.flatMap((b) => b.moduleCodes))];
  console.log(`Looking up ${allCodes.length} modules: ${allCodes.join(', ')}\n`);

  const modulesSnap = await db.collection('modules').get();
  const moduleMap = new Map();
  modulesSnap.forEach((d) => {
    const code = (d.data().moduleCode ?? '').trim().toUpperCase();
    if (code) moduleMap.set(code, { id: d.id, moduleName: d.data().moduleName ?? '' });
  });

  const missing = allCodes.filter((c) => !moduleMap.has(c));
  if (missing.length > 0) {
    console.error(`ERROR: Modules not found: ${missing.join(', ')}`);
    process.exit(1);
  }

  allCodes.forEach((c) => {
    const m = moduleMap.get(c);
    console.log(`  ${c} → ${m.id}  "${m.moduleName}"`);
  });

  // ── Step 2: Build all records ──────────────────────────────────────────────
  const records = [];
  for (const batch of BATCHES) {
    const { studentId, academicYear, semester, sessionTypes, recordedBy, pattern, dates, moduleCodes } = batch;
    for (const moduleCode of moduleCodes) {
      const mod = moduleMap.get(moduleCode);
      let idx = 0;
      for (const date of dates) {
        for (const sessionType of sessionTypes) {
          const status = pattern[idx++];
          const docId = `${studentId}_${mod.id}_${date}_${sessionType}`;
          records.push({
            docId,
            data: {
              studentId, moduleId: mod.id, moduleCode,
              moduleName: mod.moduleName, academicYear, semester,
              date, sessionType, status, recordedBy,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          });
        }
      }
    }
  }

  console.log(`\nTotal records to write: ${records.length}`);

  // ── Step 3: Write in batches of 400 ───────────────────────────────────────
  const BATCH_SIZE = 400;
  let totalWritten = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(({ docId, data }) => {
      batch.set(db.collection('attendance').doc(docId), data);
    });
    await batch.commit();
    totalWritten += chunk.length;
    console.log(`  Committed batch: ${totalWritten}/${records.length}`);
    if (i + BATCH_SIZE < records.length) await sleep(1000);
  }

  console.log(`\nDone. Total documents written: ${totalWritten}`);
  process.exit(0);
}

run().catch((err) => { console.error('Error:', err.message); process.exit(1); });
