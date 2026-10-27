import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, csvCell } from '../lib/validation.js';

const good = {
  name: 'Farid',
  nip: '123456789012345678',
  unit: 'FMIPA',
  phone: '081234567890',
  email: '',
  academy_session_id: '1',
  profession: 'Dosen',
  employment_status: 'PNS',
};

test('normalisasi WhatsApp dan email subdomain Unhas', () => {
  const r = validate({
    ...good,
    phone: '+62 812-3456-7890',
    email: ' FARID@SCI.UNHAS.AC.ID ',
    profession: 'tendik',
    employment_status: 'npt',
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.data.email, 'farid@sci.unhas.ac.id');
  assert.equal(r.data.phone, '+6281234567890');
  assert.equal(r.data.profession, 'Tendik');
  assert.equal(r.data.employment_status, 'NPT');
});

test('dukungan kategori Pimpinan dan Mahasiswa', () => {
  const rPimpinan = validate({
    ...good,
    profession: 'pimpinan',
    employment_status: 'pns',
  });
  assert.deepEqual(rPimpinan.errors, []);
  assert.equal(rPimpinan.data.profession, 'Pimpinan');

  const rMhs = validate({
    ...good,
    nip: 'H071191001',
    profession: 'mahasiswa',
    employment_status: 'Mahasiswa',
    email: 'andi@student.unhas.ac.id',
  });
  assert.deepEqual(rMhs.errors, []);
  assert.equal(rMhs.data.profession, 'Mahasiswa');
  assert.equal(rMhs.data.nip, 'H071191001');
  assert.equal(rMhs.data.email, 'andi@student.unhas.ac.id');
});

test('aturan khusus email Unhas mahasiswa', () => {
  // Mahasiswa wajib isi email
  const rEmpty = validate({
    ...good,
    nip: 'H071191001',
    profession: 'Mahasiswa',
    email: '',
  });
  assert.ok(rEmpty.errors.includes('Mahasiswa wajib mengisi alamat email Unhas.'));

  // Mahasiswa harus menggunakan email domain Unhas
  const rNonUnhas = validate({
    ...good,
    nip: 'H071191001',
    profession: 'Mahasiswa',
    email: 'mahasiswa@gmail.com',
  });
  assert.ok(
    rNonUnhas.errors.some((err) => err.includes('Mahasiswa wajib menggunakan email resmi Unhas'))
  );

  // Mahasiswa valid dengan @unhas.ac.id atau @student.unhas.ac.id
  const rValidStudent = validate({
    ...good,
    nip: 'H071191001',
    profession: 'Mahasiswa',
    email: 'mahasiswa@student.unhas.ac.id',
  });
  assert.deepEqual(rValidStudent.errors, []);

  const rValidUnhas = validate({
    ...good,
    nip: 'H071191001',
    profession: 'Mahasiswa',
    email: 'mahasiswa@unhas.ac.id',
  });
  assert.deepEqual(rValidUnhas.errors, []);

  // Kategori non-mahasiswa (Dosen, Tendik, Pimpinan) email tetap opsional
  const rDosenNoEmail = validate({
    ...good,
    profession: 'Dosen',
    email: '',
  });
  assert.deepEqual(rDosenNoEmail.errors, []);

  const rPimpinanNoEmail = validate({
    ...good,
    profession: 'Pimpinan',
    email: '',
  });
  assert.deepEqual(rPimpinanNoEmail.errors, []);
});

test('tolak NIP, telepon, domain, sesi dan tipe yang salah', () => {
  for (const change of [
    { nip: '123' },
    { phone: '12345' },
    { email: 'x@unhas.ac.id.evil.test' },
    { academy_session_id: '1.5' },
    { name: [] },
    { unit: '' },
    { profession: 'Astronot' },
    { employment_status: 'Honorer' },
  ]) {
    assert.ok(validate({ ...good, ...change }).errors.length);
  }
});

test('CSV melindungi formula dan escape kutip', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
