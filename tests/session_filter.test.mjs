import test from 'node:test';
import assert from 'node:assert/strict';

function isSessionAllowed(session, prof) {
  if (!session || !session.allowed_professions || session.allowed_professions === 'ALL') return true;
  if (!prof) return true;
  const allowed = session.allowed_professions.split(',').map((s) => s.trim().toLowerCase());
  return allowed.includes(prof.toLowerCase());
}

test('Filtering profesi pada sesi jadwal', () => {
  // Tanggal 30: Hanya Pimpinan dan Dosen
  const sJumatPagi = { id: 1, name: 'Sesi I (Pagi)', allowed_professions: 'Dosen,Pimpinan' };
  const sJumatSiang = { id: 2, name: 'Sesi II (Siang)', allowed_professions: 'Dosen,Pimpinan' };

  // Tanggal 31: Khusus Tendik dan Mahasiswa
  const sSabtuPagi = { id: 3, name: 'Sesi I (Pagi)', allowed_professions: 'Tendik,Mahasiswa' };
  const sSabtuSiang = { id: 4, name: 'Sesi II (Siang)', allowed_professions: 'Tendik,Mahasiswa' };

  // Tanggal 30: Dosen & Pimpinan Boleh
  assert.equal(isSessionAllowed(sJumatPagi, 'Dosen'), true);
  assert.equal(isSessionAllowed(sJumatPagi, 'Pimpinan'), true);
  assert.equal(isSessionAllowed(sJumatSiang, 'Dosen'), true);
  assert.equal(isSessionAllowed(sJumatSiang, 'Pimpinan'), true);

  // Tanggal 30: Tendik & Mahasiswa Tidak Boleh
  assert.equal(isSessionAllowed(sJumatPagi, 'Tendik'), false);
  assert.equal(isSessionAllowed(sJumatPagi, 'Mahasiswa'), false);
  assert.equal(isSessionAllowed(sJumatSiang, 'Tendik'), false);
  assert.equal(isSessionAllowed(sJumatSiang, 'Mahasiswa'), false);

  // Tanggal 31: Tendik & Mahasiswa Boleh
  assert.equal(isSessionAllowed(sSabtuPagi, 'Tendik'), true);
  assert.equal(isSessionAllowed(sSabtuPagi, 'Mahasiswa'), true);
  assert.equal(isSessionAllowed(sSabtuSiang, 'Tendik'), true);
  assert.equal(isSessionAllowed(sSabtuSiang, 'Mahasiswa'), true);

  // Tanggal 31: Dosen & Pimpinan Tidak Boleh
  assert.equal(isSessionAllowed(sSabtuPagi, 'Dosen'), false);
  assert.equal(isSessionAllowed(sSabtuPagi, 'Pimpinan'), false);
  assert.equal(isSessionAllowed(sSabtuSiang, 'Dosen'), false);
  assert.equal(isSessionAllowed(sSabtuSiang, 'Pimpinan'), false);
});

test('Hilangkan sesi tidak diizinkan sama sekali dari daftar form', () => {
  const schedules = [
    {
      id: 1,
      title: 'Jadwal 30 Okt (Dosen & Pimpinan)',
      is_active: 1,
      sessions: [
        { id: 1, name: 'Sesi I (Pagi)', allowed_professions: 'Dosen,Pimpinan' },
        { id: 2, name: 'Sesi II (Siang)', allowed_professions: 'Dosen,Pimpinan' },
      ],
    },
    {
      id: 2,
      title: 'Jadwal 31 Okt (Tendik & Mahasiswa)',
      is_active: 1,
      sessions: [
        { id: 3, name: 'Sesi I (Pagi)', allowed_professions: 'Tendik,Mahasiswa' },
        { id: 4, name: 'Sesi II (Siang)', allowed_professions: 'Tendik,Mahasiswa' },
      ],
    },
  ];

  function getFormSessions(role) {
    const validSchedules = schedules
      .filter((sc) => sc.is_active)
      .map((sc) => ({
        ...sc,
        validSessions: (sc.sessions || []).filter((s) => isSessionAllowed(s, role)),
      }))
      .filter((sc) => sc.validSessions.length > 0);

    return validSchedules.flatMap((sc) => sc.validSessions);
  }

  // Dosen hanya melihat sesi 1 dan 2
  const dosenSessions = getFormSessions('Dosen');
  assert.deepEqual(dosenSessions.map((s) => s.id), [1, 2]);
  assert.equal(dosenSessions.some((s) => s.id === 3 || s.id === 4), false);

  // Mahasiswa hanya melihat sesi 3 dan 4
  const mhsSessions = getFormSessions('Mahasiswa');
  assert.deepEqual(mhsSessions.map((s) => s.id), [3, 4]);
  assert.equal(mhsSessions.some((s) => s.id === 1 || s.id === 2), false);
});

test('Aturan bebas kuota fakultas khusus mahasiswa pada sesi/jadwal tertentu', () => {
  function checkStudentQuotaExemption(profession, session, schedule) {
    if (profession !== 'Mahasiswa') return false;
    return Boolean(session?.exempt_student_quota || schedule?.exempt_student_quota);
  }

  const sNormal = { id: 1, exempt_student_quota: 0 };
  const sExemptSession = { id: 2, exempt_student_quota: 1 };
  const scNormal = { id: 1, exempt_student_quota: 0 };
  const scExemptSchedule = { id: 2, exempt_student_quota: 1 };

  // Dosen tidak pernah bebas kuota fakultas
  assert.equal(checkStudentQuotaExemption('Dosen', sExemptSession, scNormal), false);
  assert.equal(checkStudentQuotaExemption('Tendik', sNormal, scExemptSchedule), false);

  // Mahasiswa pada sesi biasa: tidak bebas kuota
  assert.equal(checkStudentQuotaExemption('Mahasiswa', sNormal, scNormal), false);

  // Mahasiswa pada sesi dengan exempt_student_quota = 1: BEBAS KUOTA
  assert.equal(checkStudentQuotaExemption('Mahasiswa', sExemptSession, scNormal), true);

  // Mahasiswa pada jadwal dengan exempt_student_quota = 1: BEBAS KUOTA
  assert.equal(checkStudentQuotaExemption('Mahasiswa', sNormal, scExemptSchedule), true);
});
