import ExcelJS from 'exceljs';

export async function participantWorkbook(participants) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gemini Academy';
  const sheet = workbook.addWorksheet('Peserta', {views: [{state: 'frozen', ySplit: 1}]});
  sheet.columns = [
    {header: 'No.', key: 'no', width: 7},
    {header: 'Nama Lengkap', key: 'name', width: 32},
    {header: 'NIP', key: 'nip', width: 24},
    {header: 'Unit Kerja', key: 'unit', width: 38},
    {header: 'WhatsApp', key: 'phone', width: 22},
    {header: 'Email Unhas', key: 'email', width: 36},
    {header: 'Sesi', key: 'session', width: 14},
    {header: 'Waktu (WITA)', key: 'time', width: 22},
    {header: 'Tanggal Daftar (WITA)', key: 'registered', width: 26},
    {header: 'Kode Pendaftaran', key: 'code', width: 40},
    {header: 'Kategori Profesi', key: 'profession', width: 20},
    {header: 'Status Kepegawaian', key: 'employment_status', width: 22},
    {header: 'Surat Usulan', key: 'letter', width: 18},
    {header: 'Jadwal / Program', key: 'schedule_title', width: 35},
    {header: 'Tanggal Kegiatan', key: 'event_date', width: 20},
    {header: 'Lokasi', key: 'location', width: 30},
  ];
  for (const [index, p] of participants.entries()) {
    // Excel uses timezone-free date serials: shift UTC by eight hours for WITA.
    const utc = p.created_at instanceof Date ? p.created_at : new Date(p.created_at.replace(' ', 'T') + 'Z');
    sheet.addRow({no: index + 1, name: String(p.name), nip: String(p.nip),
      unit: String(p.unit), phone: String(p.phone), email: p.email ? String(p.email) : '',
      session: String(p.session), time: p.starts_at + '–' + p.ends_at,
      registered: new Date(utc.getTime() + 8 * 3600000), code: String(p.registration_code),
      profession: p.profession ? String(p.profession) : '',
      employment_status: p.employment_status ? String(p.employment_status) : '',
      letter: p.letter_file ? 'Ada' : 'Tidak Ada',
      schedule_title: p.schedule_title || '',
      event_date: p.event_date || '',
      location: p.location || ''});
  }
  for (const key of ['nip', 'phone', 'code']) sheet.getColumn(key).numFmt = '@';
  sheet.getColumn('registered').numFmt = 'dd/mm/yyyy hh:mm:ss';
  sheet.autoFilter = {from: 'A1', to: 'P' + Math.max(1, sheet.rowCount)};
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell(cell => {
    cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF284478'}};
    cell.font = {bold: true, color: {argb: 'FFFFFFFF'}};
    cell.alignment = {vertical: 'middle', wrapText: true};
  });
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    row.alignment = {vertical: 'top', wrapText: true};
    if (i % 2 === 0) row.eachCell(cell => {cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF0F4FB'}};});
  });
  return workbook.xlsx.writeBuffer();
}
