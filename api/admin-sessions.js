import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.headers['x-admin'] !== '1') return res.status(401).json({ error: 'Unauthorized' });

  // GET all sessions with availability
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('session_availability')
      .select('*')
      .order('date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — generate sessions for a month or add a playdate
  if (req.method === 'POST') {
    const { action, year, month, capacity, date, theme, session_type } = req.body;

    if (action === 'generate') {
      const { error } = await supabase.rpc('generate_monthly_sessions', {
        year, month, cap: capacity || 10
      });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'add_playdate') {
      const { error } = await supabase.from('class_sessions').insert([{
        date,
        day_of_week: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
        age_group: 'all',
        capacity: capacity || 30,
        session_type: 'playdate',
        theme: theme || ''
      }]);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  // PATCH — update capacity or toggle active
  if (req.method === 'PATCH') {
    const { id, capacity, is_active } = req.body;
    const updates = {};
    if (capacity !== undefined) updates.capacity = capacity;
    if (is_active !== undefined) updates.is_active = is_active;
    const { error } = await supabase.from('class_sessions').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  // DELETE — remove a session
  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await supabase.from('class_sessions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}