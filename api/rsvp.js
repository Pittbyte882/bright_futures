import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { sessionId, name, email, children } = body;

    if (!sessionId || !name || !email) {
      return res.status(400).json({ error: 'Session, name, and email are required.' });
    }

    const { error } = await supabase.from('playdate_rsvps').insert([{
      session_id: sessionId,
      parent_name: name,
      email,
      children: children || 1
    }]);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'RSVP failed.' });
  }
}
