import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.headers['x-admin'] !== '1') return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('registrations')
      .select('*, class_sessions(date, day_of_week, age_group)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'PATCH') {
    const { id, paid } = req.body;
    const { error } = await supabase.from('registrations').update({ paid }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id, releaseUnpaid } = req.body;

    // Release all unpaid spots older than 24hrs
    if (releaseUnpaid) {
      const { data, error } = await supabase.rpc('release_unpaid_spots');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, released: data });
    }

    // Delete single registration
    const { error } = await supabase.from('registrations').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}