import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Get all active sessions from today forward
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