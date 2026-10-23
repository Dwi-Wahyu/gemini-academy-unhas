import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {participantWorkbook} from '../lib/excel.js';
test('Excel mempertahankan identifier, teks formula, tanggal WITA dan semua baris', async () => {
 const record={name:'=1+1',nip:'001234567890123456',phone:'081234567890',unit:'FMIPA',email:null,profession:'Dosen',employment_status:'PNS',letter_file:'surat.pdf',session:'Sesi 1',starts_at:'08:30',ends_at:'11:30',created_at:'2026-10-23 20:30:00',registration_code:'test-code'};
 const buffer=await participantWorkbook(Array.from({length:26},()=>record));
 const book=new ExcelJS.Workbook();await book.xlsx.load(buffer);
 const sheet=book.getWorksheet('Peserta');assert.equal(sheet.rowCount,27);
 assert.equal(sheet.getCell('C2').value,record.nip);assert.equal(sheet.getCell('E2').value,record.phone);
 assert.equal(sheet.getCell('B2').type,ExcelJS.ValueType.String);assert.equal(sheet.getCell('B2').value,'=1+1');
 assert.equal(sheet.getCell('I2').value.toISOString(),'2026-10-24T04:30:00.000Z');
 assert.equal(sheet.getCell('K2').value,'Dosen');
 assert.equal(sheet.getCell('L2').value,'PNS');
 assert.equal(sheet.getCell('M2').value,'Ada');
 assert.equal(sheet.views[0].ySplit,1);assert.ok(sheet.autoFilter);
});
test('Excel tanpa peserta tetap berisi header', async()=>{const b=new ExcelJS.Workbook();await b.xlsx.load(await participantWorkbook([]));assert.equal(b.getWorksheet('Peserta').rowCount,1);});
