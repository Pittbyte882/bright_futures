import { serialize } from 'cookie';
import crypto from 'crypto';

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { password } = req.body;
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== ADMIN_PASSWORD_HASH) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const cookieStr = serialize('admin_token', token, {
      httpOnly: true, secure: true, sameSite: 'strict',
      maxAge: 60 * 60 * 8, path: '/'
    });
    res.setHeader('Set-Cookie', cookieStr);
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', serialize('admin_token', '', { maxAge: 0, path: '/' }));
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}