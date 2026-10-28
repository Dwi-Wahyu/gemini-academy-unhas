import test from 'node:test';
import assert from 'node:assert/strict';

test('Pendaftaran tidak bisa pada sesi jika kuota sudah mencukupi/penuh', () => {
  const fullSession = { id: 1, name: 'Sesi I (Pagi)', capacity: 230, reserved: 230, remaining: 0 };
  const availableSession = { id: 2, name: 'Sesi II (Siang)', capacity: 230, reserved: 150, remaining: 80 };

  // Logika pengecekan kuota
  const isFull = (s) => Number(s.reserved) >= Number(s.capacity) || Number(s.remaining) <= 0;

  assert.equal(isFull(fullSession), true, 'Sesi dengan reserved >= capacity harus dinyatakan penuh');
  assert.equal(isFull(availableSession), false, 'Sesi dengan remaining > 0 tidak boleh dinyatakan penuh');

  // Simulasi validasi submit
  function validateSessionRegistration(session) {
    if (isFull(session)) {
      throw new Error('Sesi pelatihan yang dipilih sudah penuh. Silakan pilih sesi lainnya.');
    }
    return true;
  }

  assert.throws(
    () => validateSessionRegistration(fullSession),
    /Sesi pelatihan yang dipilih sudah penuh/,
    'Harus menolak pendaftaran pada sesi yang sudah penuh'
  );
  assert.equal(validateSessionRegistration(availableSession), true);
});

test('Verifikasi ADMIN_PIN pada penghapusan jadwal yang memiliki peserta', () => {
  const envAdminPin = process.env.ADMIN_PIN || '1234';

  function verifyAdminPinForDelete(pin, hasParticipants) {
    if (!hasParticipants) return true;
    if (!pin || String(pin).trim() !== String(envAdminPin).trim()) {
      throw new Error('PIN Admin tidak valid. Masukkan PIN Admin yang sesuai untuk menghapus jadwal yang memiliki peserta.');
    }
    return true;
  }

  // Jika tidak ada peserta, PIN tidak wajib
  assert.equal(verifyAdminPinForDelete('', false), true);

  // Jika ada peserta, PIN salah ditolak
  assert.throws(
    () => verifyAdminPinForDelete('wrong_pin', true),
    /PIN Admin tidak valid/,
    'Harus menolak PIN yang salah'
  );

  // Jika ada peserta, PIN kosong ditolak
  assert.throws(
    () => verifyAdminPinForDelete('', true),
    /PIN Admin tidak valid/,
    'Harus menolak jika PIN kosong'
  );

  // Jika PIN benar sesuai env, diterima
  assert.equal(verifyAdminPinForDelete(envAdminPin, true), true);
});

test('Validasi kuota saat memindahkan peserta ke jadwal lain', () => {
  const participantsCount = 50;

  const targetScheduleSufficient = {
    id: 2,
    title: 'Jadwal 2',
    sessions: [
      { id: 3, capacity: 100, reserved: 40, remaining: 60 },
      { id: 4, capacity: 100, reserved: 80, remaining: 20 },
    ],
  };

  const targetScheduleInsufficient = {
    id: 3,
    title: 'Jadwal 3',
    sessions: [
      { id: 5, capacity: 100, reserved: 90, remaining: 10 },
      { id: 6, capacity: 100, reserved: 85, remaining: 15 },
    ],
  };

  function canMoveParticipants(targetSchedule, count) {
    const totalRemaining = (targetSchedule.sessions || []).reduce(
      (sum, s) => sum + Number(s.remaining ?? Math.max(0, s.capacity - s.reserved)),
      0
    );
    if (count > totalRemaining) {
      throw new Error(
        `Kuota pada jadwal tujuan tidak mencukupi. Diperlukan ${count} kursi, namun jadwal hanya memiliki ${totalRemaining} kursi tersisa.`
      );
    }
    return true;
  }

  // Cukup (60 + 20 = 80 >= 50)
  assert.equal(canMoveParticipants(targetScheduleSufficient, participantsCount), true);

  // Tidak cukup (10 + 15 = 25 < 50)
  assert.throws(
    () => canMoveParticipants(targetScheduleInsufficient, participantsCount),
    /Kuota pada jadwal tujuan tidak mencukupi/,
    'Harus menolak pemindahan jika total sisa kuota jadwal tujuan kurang dari jumlah peserta'
  );
});
