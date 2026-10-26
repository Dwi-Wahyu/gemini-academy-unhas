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
