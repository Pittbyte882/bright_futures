import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { serialize } from 'cookie';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

export default async function handler(req, res) {
  const { action } = req.query;

  // ── AUTH: POST /api/admin?action=login ──
  if (action === 'login') {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const hash = crypto.createHash('sha256').update(body.password || '').digest('hex');
      console.log('INCOMING HASH:', hash);
      console.log('STORED HASH:', ADMIN_PASSWORD_HASH);
      console.log('MATCH:', hash === ADMIN_PASSWORD_HASH);
      if (hash !== ADMIN_PASSWORD_HASH) return res.status(401).json({ error: 'Invalid password', incoming: hash, stored: ADMIN_PASSWORD_HASH ? 'exists' : 'MISSING' });
      const token = crypto.randomBytes(32).toString('hex');
      res.setHeader('Set-Cookie', serialize('admin_token', token, {
        httpOnly: true, secure: true, sameSite: 'strict', maxAge: 60 * 60 * 8, path: '/'
      }));
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', serialize('admin_token', '', { maxAge: 0, path: '/' }));
      return res.status(200).json({ ok: true });
    }
  }

  // ── All other actions require x-admin header ──
  if (req.headers['x-admin'] !== '1') return res.status(401).json({ error: 'Unauthorized' });

  // ── SESSIONS: /api/admin?action=sessions ──
  if (action === 'sessions') {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('session_availability').select('*').order('date', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { action: act, year, month, capacity, date, theme } = body;
      if (act === 'generate') {
        const { error } = await supabase.rpc('generate_monthly_sessions', { year, month, cap: capacity || 10 });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }
      if (act === 'add_playdate') {
        const dow = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const { error } = await supabase.from('class_sessions').insert([{
          date, day_of_week: dow, age_group: 'all',
          capacity: capacity || 30, session_type: 'playdate', theme: theme || ''
        }]);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }
    }
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, capacity, is_active } = body;
      const updates = {};
      if (capacity !== undefined) updates.capacity = capacity;
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await supabase.from('class_sessions').update(updates).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { error } = await supabase.from('class_sessions').delete().eq('id', body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  // ── REGISTRATIONS: /api/admin?action=registrations ──
  if (action === 'registrations') {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('registrations')
        .select('*, class_sessions(date, day_of_week, age_group)')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { error } = await supabase.from('registrations').update({ paid: body.paid }).eq('id', body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body.releaseUnpaid) {
        const { data, error } = await supabase.rpc('release_unpaid_spots');
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, released: data });
      }
      const { data: reg } = await supabase.from('registrations').select('session_id').eq('id', body.id).single();
      if (reg) await supabase.rpc('release_unpaid_spots');
      const { error } = await supabase.from('registrations').delete().eq('id', body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  // ── TESTIMONIALS: /api/admin?action=testimonials ──
  if (action === 'testimonials') {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('testimonials').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { error } = await supabase.from('testimonials').update({ status: body.status }).eq('id', body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  // ── GALLERY: /api/admin?action=gallery ──
  if (action === 'gallery') {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('gallery').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { url, type, caption, category, source } = body;
      const { data, error } = await supabase.from('gallery').insert([{
        url, type: type || 'image', caption: caption || '',
        category: category || 'other', source: source || 'owner',
        submitted_by: source === 'owner' ? 'Owner' : body.submitted_by,
        status: source === 'owner' ? 'approved' : 'pending'
      }]).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, data });
    }
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { error } = await supabase.from('gallery').update({ status: body.status }).eq('id', body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { error } = await supabase.from('gallery').delete().eq('id', body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(400).json({ error: 'Invalid action' });
}