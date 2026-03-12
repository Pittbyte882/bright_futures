import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { action } = req.query;

  // ── GET sessions (public calendar) ──
  if (req.method === 'GET' && !action) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('session_availability')
      .select('*')
      .eq('is_active', true)
      .gte('date', today)
      .order('date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── GET storage token for browser uploads ──
  if (req.method === 'GET' && action === 'storage-token') {
    return res.status(200).json({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY
    });
  }

  // ── POST rsvp for playdate ──
  if (req.method === 'POST' && action === 'rsvp') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { sessionId, name, email, children } = body;
    if (!sessionId || !name || !email) {
      return res.status(400).json({ error: 'Session, name, and email are required.' });
    }
    const { error } = await supabase.from('playdate_rsvps').insert([{
      session_id: sessionId, parent_name: name, email, children: children || 1
    }]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}