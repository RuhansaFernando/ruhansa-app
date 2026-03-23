import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export default function AdminDataCheckPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'students'))
      .then((snap) => {
        setRows(
          snap.docs.map((d) => ({
            docId: d.id,
            studentId: d.data().studentId ?? '—',
            name: d.data().name ?? '—',
            programme: d.data().programme ?? '—',
            level: d.data().level ?? '—',
            yearOfStudy: d.data().yearOfStudy ?? '—',
          }))
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>;

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13 }}>
      <h2 style={{ marginBottom: 16 }}>Student Data Check ({rows.length} records)</h2>
      <table border={1} cellPadding={6} cellSpacing={0} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead style={{ background: '#f0f0f0' }}>
          <tr>
            <th>studentId</th>
            <th>name</th>
            <th>programme</th>
            <th>level</th>
            <th>yearOfStudy</th>
            <th>docId</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.docId}>
              <td>{r.studentId}</td>
              <td>{r.name}</td>
              <td>{r.programme}</td>
              <td style={{ background: r.level === '—' ? '#ffe0e0' : undefined }}>{r.level}</td>
              <td style={{ background: r.yearOfStudy === '—' ? '#ffe0e0' : undefined }}>{r.yearOfStudy}</td>
              <td style={{ color: '#999', fontSize: 11 }}>{r.docId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
