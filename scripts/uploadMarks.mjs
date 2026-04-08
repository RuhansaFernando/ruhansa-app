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

// ── Marks data ────────────────────────────────────────────────────────────────
// Each entry: [studentId, moduleCode, academicYear, semester, CW, EX]
const RAW_MARKS = [
  // STD001 — BIS Year 1 — 2025/2026
  ['STD001','BIS101','2025/2026','Semester 1',72,68],
  ['STD001','BIS102','2025/2026','Semester 2',75,70],
  ['STD001','BIS103','2025/2026','Semester 1',70,65],
  ['STD001','BIS104','2025/2026','Semester 1',68,72],
  ['STD001','BIS105','2025/2026','Semester 2',74,69],
  ['STD001','BIS106','2025/2026','Semester 2',71,67],

  // STD002 — BM Year 1 — 2025/2026
  ['STD002','BM101','2025/2026','Semester 1',73,69],
  ['STD002','BM102','2025/2026','Semester 2',70,65],
  ['STD002','BM103','2025/2026','Semester 1',68,71],
  ['STD002','BM104','2025/2026','Semester 1',72,68],
  ['STD002','BM105','2025/2026','Semester 2',69,74],
  ['STD002','BM106','2025/2026','Semester 2',71,66],

  // STD003 — CS Year 2
  ['STD003','CS101','2024/2025','Semester 1',55,50],
  ['STD003','CS102','2024/2025','Semester 2',52,48],
  ['STD003','CS103','2024/2025','Semester 1',58,53],
  ['STD003','CS104','2024/2025','Semester 1',50,45],
  ['STD003','CS105','2024/2025','Semester 2',54,49],
  ['STD003','CS106','2024/2025','Semester 2',51,47],
  ['STD003','CS201','2025/2026','Semester 1',53,48],
  ['STD003','CS202','2025/2026','Semester 2',56,51],
  ['STD003','CS203','2025/2026','Semester 1',49,44],
  ['STD003','CS204','2025/2026','Semester 1',55,50],
  ['STD003','CS205','2025/2026','Semester 2',52,46],
  ['STD003','CS206','2025/2026','Semester 2',50,45],

  // STD004 — SE Year 2
  ['STD004','SE101','2024/2025','Semester 1',56,51],
  ['STD004','SE102','2024/2025','Semester 2',53,48],
  ['STD004','SE103','2024/2025','Semester 1',57,52],
  ['STD004','SE104','2024/2025','Semester 1',51,46],
  ['STD004','SE105','2024/2025','Semester 2',54,49],
  ['STD004','SE106','2024/2025','Semester 2',52,47],
  ['STD004','SE201','2025/2026','Semester 1',55,50],
  ['STD004','SE202','2025/2026','Semester 2',53,48],
  ['STD004','SE203','2025/2026','Semester 1',50,45],
  ['STD004','SE204','2025/2026','Semester 1',54,49],
  ['STD004','SE205','2025/2026','Semester 2',51,46],
  ['STD004','SE206','2025/2026','Semester 2',52,47],

  // STD005 — AF Year 3
  ['STD005','AF101','2023/2024','Semester 1',38,32],
  ['STD005','AF102','2023/2024','Semester 1',41,35],
  ['STD005','AF103','2023/2024','Semester 1',36,30],
  ['STD005','AF104','2023/2024','Semester 2',39,33],
  ['STD005','AF105','2023/2024','Semester 2',37,31],
  ['STD005','AF106','2023/2024','Semester 2',40,34],
  ['STD005','AF201','2024/2025','Semester 1',42,36],
  ['STD005','AF202','2024/2025','Semester 2',38,32],
  ['STD005','AF203','2024/2025','Semester 1',40,34],
  ['STD005','AF204','2024/2025','Semester 2',37,31],
  ['STD005','AF205','2024/2025','Semester 2',39,33],
  ['STD005','AF206','2024/2025','Semester 1',41,35],
  ['STD005','AF301','2025/2026','Semester 1',43,37],
  ['STD005','AF302','2025/2026','Semester 2',39,33],
  ['STD005','AF303','2025/2026','Semester 1',41,35],
  ['STD005','AF304','2025/2026','Semester 1',38,32],
  ['STD005','AF305','2025/2026','Semester 2',40,34],
  ['STD005','AF306','2025/2026','Semester 2',37,31],

  // STD006 — IT Year 3
  ['STD006','IT101','2023/2024','Semester 1',40,34],
  ['STD006','IT102','2023/2024','Semester 2',38,32],
  ['STD006','IT103','2023/2024','Semester 1',42,36],
  ['STD006','IT104','2023/2024','Semester 1',37,31],
  ['STD006','IT105','2023/2024','Semester 2',39,33],
  ['STD006','IT106','2023/2024','Semester 2',41,35],
  ['STD006','IT201','2024/2025','Semester 1',43,37],
  ['STD006','IT202','2024/2025','Semester 1',40,34],
  ['STD006','IT203','2024/2025','Semester 1',38,32],
  ['STD006','IT204','2024/2025','Semester 2',41,35],
  ['STD006','IT205','2024/2025','Semester 2',39,33],
  ['STD006','IT206','2024/2025','Semester 2',37,31],
  ['STD006','IT301','2025/2026','Semester 1',42,36],
  ['STD006','IT302','2025/2026','Semester 2',38,32],
  ['STD006','IT303','2025/2026','Semester 1',40,34],
  ['STD006','IT304','2025/2026','Semester 1',37,31],
  ['STD006','IT305','2025/2026','Semester 2',39,33],
  ['STD006','IT306','2025/2026','Semester 2',41,35],

  // STD007 — BIS Year 4
  ['STD007','BIS101','2022/2023','Semester 1',32,28],
  ['STD007','BIS102','2022/2023','Semester 2',35,29],
  ['STD007','BIS103','2022/2023','Semester 1',30,25],
  ['STD007','BIS104','2022/2023','Semester 1',33,27],
  ['STD007','BIS105','2022/2023','Semester 2',31,26],
  ['STD007','BIS106','2022/2023','Semester 2',34,28],
  ['STD007','BIS201','2023/2024','Semester 1',36,30],
  ['STD007','BIS202','2023/2024','Semester 2',33,27],
  ['STD007','BIS203','2023/2024','Semester 1',35,29],
  ['STD007','BIS204','2023/2024','Semester 1',31,26],
  ['STD007','BIS205','2023/2024','Semester 2',34,28],
  ['STD007','BIS206','2023/2024','Semester 2',32,27],
  ['STD007','BIS301','2024/2025','Semester 1',37,31],
  ['STD007','BIS302','2024/2025','Semester 2',34,28],
  ['STD007','BIS303','2024/2025','Semester 1',36,30],
  ['STD007','BIS304','2024/2025','Semester 1',33,27],
  ['STD007','BIS305','2024/2025','Semester 2',35,29],
  ['STD007','BIS306','2024/2025','Semester 2',32,26],
  ['STD007','BIS401','2025/2026','Semester 1',38,32],
  ['STD007','BIS402','2025/2026','Semester 1',35,29],
  ['STD007','BIS403','2025/2026','Semester 1',37,31],
  ['STD007','BIS404','2025/2026','Semester 2',34,28],
  ['STD007','BIS405','2025/2026','Semester 2',36,30],

  // STD008 — CY Year 2
  ['STD008','CY101','2024/2025','Semester 1',57,52],
  ['STD008','CY102','2024/2025','Semester 2',54,49],
  ['STD008','CY103','2024/2025','Semester 1',56,51],
  ['STD008','CY104','2024/2025','Semester 1',52,47],
  ['STD008','CY105','2024/2025','Semester 2',55,50],
  ['STD008','CY106','2024/2025','Semester 2',53,48],
  ['STD008','CY201','2025/2026','Semester 1',55,50],
  ['STD008','CY202','2025/2026','Semester 1',52,47],
  ['STD008','CY203','2025/2026','Semester 1',54,49],
  ['STD008','CY204','2025/2026','Semester 2',56,51],
  ['STD008','CY205','2025/2026','Semester 2',53,48],
  ['STD008','CY206','2025/2026','Semester 2',51,46],

  // STD009 — DS Year 1 — 2025/2026
  ['STD009','DS101','2025/2026','Semester 1',74,70],
  ['STD009','DS102','2025/2026','Semester 2',71,67],
  ['STD009','DS103','2025/2026','Semester 1',73,69],
  ['STD009','DS104','2025/2026','Semester 1',70,66],
  ['STD009','DS105','2025/2026','Semester 2',72,68],
  ['STD009','DS106','2025/2026','Semester 2',75,71],

  // STD010 — CE Year 4
  ['STD010','CE101','2022/2023','Semester 1',31,26],
  ['STD010','CE102','2022/2023','Semester 2',34,28],
  ['STD010','CE103','2022/2023','Semester 1',29,24],
  ['STD010','CE104','2022/2023','Semester 1',32,27],
  ['STD010','CE105','2022/2023','Semester 2',30,25],
  ['STD010','CE106','2022/2023','Semester 2',33,27],
  ['STD010','CE201','2023/2024','Semester 1',35,29],
  ['STD010','CE202','2023/2024','Semester 2',32,27],
  ['STD010','CE203','2023/2024','Semester 1',34,28],
  ['STD010','CE204','2023/2024','Semester 1',30,25],
  ['STD010','CE205','2023/2024','Semester 2',33,27],
  ['STD010','CE206','2023/2024','Semester 2',31,26],
  ['STD010','CE301','2024/2025','Semester 1',36,30],
  ['STD010','CE302','2024/2025','Semester 2',33,27],
  ['STD010','CE303','2024/2025','Semester 1',35,29],
  ['STD010','CE304','2024/2025','Semester 1',32,26],
  ['STD010','CE305','2024/2025','Semester 2',34,28],
  ['STD010','CE306','2024/2025','Semester 2',31,25],
  ['STD010','CE401','2025/2026','Semester 1',37,31],
  ['STD010','CE402','2025/2026','Semester 1',34,28],
  ['STD010','CE403','2025/2026','Semester 1',36,30],
  ['STD010','CE404','2025/2026','Semester 2',33,27],
  ['STD010','CE405','2025/2026','Semester 2',35,29],

  // STD011 — EE Year 1 — 2025/2026
  ['STD011','EE101','2025/2026','Semester 1',76,72],
  ['STD011','EE102','2025/2026','Semester 2',73,69],
  ['STD011','EE103','2025/2026','Semester 1',75,71],
  ['STD011','EE104','2025/2026','Semester 1',72,68],
  ['STD011','EE105','2025/2026','Semester 2',74,70],
  ['STD011','EE106','2025/2026','Semester 2',77,73],

  // STD012 — BM Year 2
  ['STD012','BM101','2024/2025','Semester 1',55,50],
  ['STD012','BM102','2024/2025','Semester 2',52,47],
  ['STD012','BM103','2024/2025','Semester 1',54,49],
  ['STD012','BM104','2024/2025','Semester 1',51,46],
  ['STD012','BM105','2024/2025','Semester 2',53,48],
  ['STD012','BM106','2024/2025','Semester 2',50,45],
  ['STD012','BM201','2025/2026','Semester 1',56,51],
  ['STD012','BM202','2025/2026','Semester 2',53,48],
  ['STD012','BM203','2025/2026','Semester 1',51,46],
  ['STD012','BM204','2025/2026','Semester 1',54,49],
  ['STD012','BM205','2025/2026','Semester 2',52,47],
  ['STD012','BM206','2025/2026','Semester 2',50,45],

  // STD013 — CS Year 3
  ['STD013','CS101','2023/2024','Semester 1',41,35],
  ['STD013','CS102','2023/2024','Semester 2',38,32],
  ['STD013','CS103','2023/2024','Semester 1',40,34],
  ['STD013','CS104','2023/2024','Semester 1',37,31],
  ['STD013','CS105','2023/2024','Semester 2',39,33],
  ['STD013','CS106','2023/2024','Semester 2',36,30],
  ['STD013','CS201','2024/2025','Semester 1',42,36],
  ['STD013','CS202','2024/2025','Semester 2',39,33],
  ['STD013','CS203','2024/2025','Semester 1',41,35],
  ['STD013','CS204','2024/2025','Semester 1',38,32],
  ['STD013','CS205','2024/2025','Semester 2',40,34],
  ['STD013','CS206','2024/2025','Semester 2',37,31],
  ['STD013','CS301','2025/2026','Semester 1',43,37],
  ['STD013','CS302','2025/2026','Semester 2',40,34],
  ['STD013','CS303','2025/2026','Semester 1',42,36],
  ['STD013','CS304','2025/2026','Semester 1',39,33],
  ['STD013','CS305','2025/2026','Semester 2',41,35],
  ['STD013','CS306','2025/2026','Semester 2',38,32],

  // STD014 — AF Year 4
  ['STD014','AF101','2022/2023','Semester 1',30,25],
  ['STD014','AF102','2022/2023','Semester 1',33,27],
  ['STD014','AF103','2022/2023','Semester 1',28,23],
  ['STD014','AF104','2022/2023','Semester 2',31,26],
  ['STD014','AF105','2022/2023','Semester 2',29,24],
  ['STD014','AF106','2022/2023','Semester 2',32,26],
  ['STD014','AF201','2023/2024','Semester 1',34,28],
  ['STD014','AF202','2023/2024','Semester 2',31,25],
  ['STD014','AF203','2023/2024','Semester 1',33,27],
  ['STD014','AF204','2023/2024','Semester 2',30,24],
  ['STD014','AF205','2023/2024','Semester 2',32,26],
  ['STD014','AF206','2023/2024','Semester 1',29,23],
  ['STD014','AF301','2024/2025','Semester 1',35,29],
  ['STD014','AF302','2023/2024','Semester 2',32,26],
  ['STD014','AF303','2024/2025','Semester 1',34,28],
  ['STD014','AF304','2024/2025','Semester 1',31,25],
  ['STD014','AF305','2024/2025','Semester 2',33,27],
  ['STD014','AF306','2024/2025','Semester 2',30,24],
  ['STD014','AF401','2025/2026','Semester 1',36,30],
  ['STD014','AF402','2025/2026','Semester 1',33,27],
  ['STD014','AF403','2025/2026','Semester 1',35,29],
  ['STD014','AF404','2025/2026','Semester 2',32,26],
  ['STD014','AF405','2025/2026','Semester 2',34,28],

  // STD015 — SE Year 3
  ['STD015','SE101','2023/2024','Semester 1',54,49],
  ['STD015','SE102','2023/2024','Semester 2',51,46],
  ['STD015','SE103','2023/2024','Semester 1',53,48],
  ['STD015','SE104','2023/2024','Semester 1',50,45],
  ['STD015','SE105','2023/2024','Semester 2',52,47],
  ['STD015','SE106','2023/2024','Semester 2',49,44],
  ['STD015','SE201','2024/2025','Semester 1',55,50],
  ['STD015','SE202','2024/2025','Semester 2',52,47],
  ['STD015','SE203','2024/2025','Semester 1',54,49],
  ['STD015','SE204','2024/2025','Semester 1',51,46],
  ['STD015','SE205','2024/2025','Semester 2',53,48],
  ['STD015','SE206','2024/2025','Semester 2',50,45],
  ['STD015','SE301','2025/2026','Semester 1',56,51],
  ['STD015','SE302','2025/2026','Semester 2',53,48],
  ['STD015','SE303','2025/2026','Semester 1',55,50],
  ['STD015','SE304','2025/2026','Semester 1',52,47],
  ['STD015','SE305','2025/2026','Semester 2',54,49],
  ['STD015','SE306','2025/2026','Semester 2',51,46],

  // STD016 — CE Year 1 — 2025/2026
  ['STD016','CE101','2025/2026','Semester 1',75,71],
  ['STD016','CE102','2025/2026','Semester 2',72,68],
  ['STD016','CE103','2025/2026','Semester 1',74,70],
  ['STD016','CE104','2025/2026','Semester 1',71,67],
  ['STD016','CE105','2025/2026','Semester 2',73,69],
  ['STD016','CE106','2025/2026','Semester 2',76,72],

  // STD017 — DS Year 2
  ['STD017','DS101','2024/2025','Semester 1',56,51],
  ['STD017','DS102','2024/2025','Semester 2',53,48],
  ['STD017','DS103','2024/2025','Semester 1',55,50],
  ['STD017','DS104','2024/2025','Semester 1',52,47],
  ['STD017','DS105','2024/2025','Semester 2',54,49],
  ['STD017','DS106','2024/2025','Semester 2',51,46],
  ['STD017','DS201','2025/2026','Semester 1',57,52],
  ['STD017','DS202','2025/2026','Semester 2',54,49],
  ['STD017','DS203','2025/2026','Semester 1',56,51],
  ['STD017','DS204','2025/2026','Semester 1',53,48],
  ['STD017','DS205','2025/2026','Semester 2',55,50],

  // STD018 — BIS Year 3
  ['STD018','BIS101','2023/2024','Semester 1',40,34],
  ['STD018','BIS102','2023/2024','Semester 2',37,31],
  ['STD018','BIS103','2023/2024','Semester 1',39,33],
  ['STD018','BIS104','2023/2024','Semester 1',36,30],
  ['STD018','BIS105','2023/2024','Semester 2',38,32],
  ['STD018','BIS106','2023/2024','Semester 2',41,35],
  ['STD018','BIS201','2024/2025','Semester 1',42,36],
  ['STD018','BIS202','2024/2025','Semester 2',39,33],
  ['STD018','BIS203','2024/2025','Semester 1',41,35],
  ['STD018','BIS204','2024/2025','Semester 1',38,32],
  ['STD018','BIS205','2024/2025','Semester 2',40,34],
  ['STD018','BIS206','2024/2025','Semester 2',37,31],
  ['STD018','BIS301','2025/2026','Semester 1',43,37],
  ['STD018','BIS302','2025/2026','Semester 2',40,34],
  ['STD018','BIS303','2025/2026','Semester 1',42,36],
  ['STD018','BIS304','2025/2026','Semester 1',39,33],
  ['STD018','BIS305','2025/2026','Semester 2',41,35],
  ['STD018','BIS306','2025/2026','Semester 2',38,32],

  // STD019 — EE Year 4
  ['STD019','EE101','2022/2023','Semester 1',32,27],
  ['STD019','EE102','2022/2023','Semester 2',29,24],
  ['STD019','EE103','2022/2023','Semester 1',31,26],
  ['STD019','EE104','2022/2023','Semester 1',28,23],
  ['STD019','EE105','2022/2023','Semester 2',30,25],
  ['STD019','EE106','2022/2023','Semester 2',33,27],
  ['STD019','EE201','2023/2024','Semester 1',35,29],
  ['STD019','EE202','2023/2024','Semester 1',32,26],
  ['STD019','EE203','2023/2024','Semester 1',34,28],
  ['STD019','EE204','2023/2024','Semester 2',31,25],
  ['STD019','EE205','2023/2024','Semester 2',33,27],
  ['STD019','EE206','2023/2024','Semester 2',30,24],
  ['STD019','EE301','2024/2025','Semester 1',36,30],
  ['STD019','EE302','2024/2025','Semester 2',33,27],
  ['STD019','EE303','2024/2025','Semester 1',35,29],
  ['STD019','EE304','2024/2025','Semester 1',32,26],
  ['STD019','EE305','2024/2025','Semester 2',34,28],
  ['STD019','EE306','2024/2025','Semester 2',31,25],
  ['STD019','EE401','2025/2026','Semester 1',37,31],
  ['STD019','EE402','2025/2026','Semester 1',34,28],
  ['STD019','EE403','2025/2026','Semester 1',36,30],
  ['STD019','EE404','2025/2026','Semester 2',33,27],
  ['STD019','EE405','2025/2026','Semester 2',35,29],

  // STD020 — CY Year 1 — 2025/2026
  ['STD020','CY101','2025/2026','Semester 1',77,73],
  ['STD020','CY102','2025/2026','Semester 2',74,70],
  ['STD020','CY103','2025/2026','Semester 1',76,72],
  ['STD020','CY104','2025/2026','Semester 1',73,69],
  ['STD020','CY105','2025/2026','Semester 2',75,71],
  ['STD020','CY106','2025/2026','Semester 2',78,74],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcFinalMark(cw, ex) {
  return Math.round(((cw * 0.4) + (ex * 0.6)) * 10) / 10;
}

function calcGrade(mark) {
  if (mark >= 70) return 'A';
  if (mark >= 60) return 'B';
  if (mark >= 50) return 'C';
  if (mark >= 40) return 'D';
  return 'F';
}

function makeDocId(studentId, moduleCode, academicYear, semester) {
  return `${studentId}_${moduleCode}_${academicYear.replace(/\//g, '_')}_${semester.replace(/ /g, '_')}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  // Step 1: Look up all unique module codes
  const allCodes = [...new Set(RAW_MARKS.map(([, code]) => code))];
  console.log(`Looking up ${allCodes.length} unique module codes...\n`);

  const modulesSnap = await db.collection('modules').get();
  const moduleMap = new Map();
  modulesSnap.forEach((d) => {
    const code = (d.data().moduleCode ?? '').trim().toUpperCase();
    if (code) moduleMap.set(code, { id: d.id, moduleName: d.data().moduleName ?? '' });
  });

  const missing = allCodes.filter((c) => !moduleMap.has(c));
  if (missing.length > 0) {
    console.error(`ERROR: Modules not found in Firestore: ${missing.join(', ')}`);
    process.exit(1);
  }

  allCodes.forEach((c) => {
    const m = moduleMap.get(c);
    console.log(`  ${c} → ${m.id}  "${m.moduleName}"`);
  });

  // Step 2: Build result records and accumulate GPA per student
  const records = [];
  const studentMarks = new Map(); // studentId → array of finalMarks

  for (const [studentId, moduleCode, academicYear, semester, cw, ex] of RAW_MARKS) {
    const mod = moduleMap.get(moduleCode);
    const finalMark = calcFinalMark(cw, ex);
    const grade = calcGrade(finalMark);
    const status = finalMark >= 40 ? 'pass' : 'fail';
    const docId = makeDocId(studentId, moduleCode, academicYear, semester);

    records.push({
      docId,
      data: {
        studentId,
        moduleId: mod.id,
        moduleCode,
        moduleName: mod.moduleName,
        academicYear,
        semester,
        courseworkMark: cw,
        examMark: ex,
        finalMark,
        grade,
        status,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    if (!studentMarks.has(studentId)) studentMarks.set(studentId, []);
    studentMarks.get(studentId).push(finalMark);
  }

  console.log(`\nTotal result records to write: ${records.length}`);

  // Step 3: Write results in batches of 400
  const BATCH_SIZE = 400;
  let totalWritten = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(({ docId, data }) => {
      batch.set(db.collection('results').doc(docId), data);
    });
    await batch.commit();
    totalWritten += chunk.length;
    console.log(`  Committed results batch: ${totalWritten}/${records.length}`);
    if (i + BATCH_SIZE < records.length) await sleep(1000);
  }

  // Step 4: Look up student Firestore doc IDs and update GPAs
  console.log('\nLooking up student documents for GPA update...');
  const studentsSnap = await db.collection('students').get();
  const studentDocMap = new Map(); // studentId → Firestore doc id
  studentsSnap.forEach((d) => {
    const sid = d.data().studentId ?? '';
    if (sid) studentDocMap.set(sid, d.id);
  });

  console.log('\nUpdating student GPAs...');
  const gpaBatch = db.batch();
  let gpaUpdates = 0;

  for (const [studentId, marks] of studentMarks.entries()) {
    const docId = studentDocMap.get(studentId);
    if (!docId) {
      console.warn(`  WARNING: No student doc found for ${studentId}, skipping GPA update`);
      continue;
    }
    const avgMark = marks.reduce((a, b) => a + b, 0) / marks.length;
    const gpa = Math.round((avgMark / 25) * 100) / 100;
    gpaBatch.update(db.collection('students').doc(docId), { gpa });
    console.log(`  ${studentId}: avg mark=${avgMark.toFixed(1)}, GPA=${gpa.toFixed(2)}`);
    gpaUpdates++;
  }

  await gpaBatch.commit();
  console.log(`\nGPA update committed for ${gpaUpdates} students.`);
  console.log(`\nDone. Total result documents written: ${totalWritten}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
