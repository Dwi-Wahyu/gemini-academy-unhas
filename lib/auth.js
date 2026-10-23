import {cookies} from 'next/headers';
import {createHash,randomBytes} from 'node:crypto';
import {db} from './db.js';
export const digest=t=>createHash('sha256').update(t).digest('hex');
export async function admin(){const t=(await cookies()).get('academy_admin')?.value;if(!t)return null;const [r]=await db.execute('SELECT u.id,u.name FROM admin_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.is_admin=1',[digest(t)]);return r[0]||null;}
export async function signIn(id){const token=randomBytes(32).toString('hex');await db.execute('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[digest(token),id]);(await cookies()).set('academy_admin',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:28800});}
