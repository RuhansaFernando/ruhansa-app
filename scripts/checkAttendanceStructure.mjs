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

async function run() {
  // Sample 3 docs from STD005 (AF) and 3 from STD011 (EE) to see full structure
  const snap1 = await db.collection('attendance')
    .where('studentId', '==', 'STD005')
    .limit(3)
    .get();

  const snap2 = await db.collection('attendance')
    .where('studentId', '==', 'STD011')
    .limit(3)
    .get();

  console.log('=== STD005 sample docs ===');
  snap1.docs.forEach((d) => {
    console.log(`\nDoc ID: ${d.id}`);
    console.log(JSON.stringify(d.data(), null, 2));
  });

  console.log('\n=== STD011 sample docs ===');
  snap2.docs.forEach((d) => {
    console.log(`\nDoc ID: ${d.id}`);
    console.log(JSON.stringify(d.data(), null, 2));
  });

  process.exit(0);
}

run().catch((err) => { console.error('Error:', err.message); process.exit(1); });
