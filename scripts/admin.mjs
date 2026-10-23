import {db} from '../lib/db.js';
import bcrypt from 'bcryptjs';
import {createInterface} from 'node:readline/promises';
const rl=createInterface({input:process.stdin,output:process.stdout});
try{const name=(await rl.question('Nama admin: ')).trim();const email=(await rl.question('Email admin: ')).trim().toLowerCase();console.log('Password dibaca dari ADMIN_PASSWORD (tidak ditampilkan).');const password=process.env.ADMIN_PASSWORD;if(!name||name.length>150||!/^\S+@\S+\.\S+$/.test(email)||!password||password.length<12||Buffer.byteLength(password)>72)throw Error('Isi nama, email valid, dan ADMIN_PASSWORD 12–72 byte.');await db.execute('INSERT INTO users(name,email,password,is_admin) VALUES(?,?,?,1)',[name,email,await bcrypt.hash(password,12)]);console.log('Admin berhasil dibuat.');}finally{rl.close();await db.end();}
