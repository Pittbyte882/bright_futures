import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.headers['x-admin'] !== '1') return res.status(401).json({ error: 'Unauthorized' });
  if (req.method === 'POST') {
    const { day, spots } = req.body;
    const { error } = await supabase.from('class_spots').update({ spots_remaining: spots }).eq('class_day', day);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}