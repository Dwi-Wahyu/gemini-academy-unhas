export function validate(input){
 const d={}; for(const k of ['name','nip','unit','phone','email','profession','employment_status'])d[k]=typeof input[k]==='string'?input[k].trim():'';
 d.email=d.email.toLowerCase();d.phone=d.phone.replace(/[\s()\-]/g,'');d.academy_session_id=Number(input.academy_session_id);
 const errors=[];
 if(d.name.length<2||d.name.length>150)errors.push('Nama harus terdiri dari 2–150 karakter.');
 if(!/^\d{18}$/.test(d.nip))errors.push('NIP harus terdiri dari 18 digit.');
 if(!d.unit||d.unit.length>200)errors.push('Unit kerja wajib diisi, maksimal 200 karakter.');
 if(!/^(?:\+62|62|0)8\d{7,12}$/.test(d.phone)||d.phone.length>20)errors.push('Nomor WhatsApp Indonesia tidak valid.');
 if(d.email&&(!/^[^\s@]+@(?:[a-z0-9-]+\.)*unhas\.ac\.id$/i.test(d.email)||d.email.length>200))errors.push('Gunakan email Unhas atau kosongkan.');
 if(!Number.isSafeInteger(d.academy_session_id)||d.academy_session_id<1)errors.push('Silakan pilih sesi.');
 const prof=d.profession.toLowerCase();
 if(prof==='dosen')d.profession='Dosen';
 else if(prof==='tendik')d.profession='Tendik';
 if(!['Dosen','Tendik'].includes(d.profession))errors.push('Pilih kategori profesi (Dosen atau Tendik).');
 const emp=d.employment_status.toUpperCase();
 if(['PNS','NPT','NPTT'].includes(emp))d.employment_status=emp;
 if(!['PNS','NPT','NPTT'].includes(d.employment_status))errors.push('Pilih status kepegawaian (PNS, NPT, atau NPTT).');
 return {data:d,errors};
}
export function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
