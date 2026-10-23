import {readFile} from 'node:fs/promises';
import {db} from '../lib/db.js';
try{const sql=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');for(const statement of sql.split(';').filter(s=>s.trim()))await db.query(statement);console.log('Database siap.');}finally{await db.end();}
