import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// NO export config — need default body parser ON

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { name, caption, category, mediaItems } = body;

    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!mediaItems || !mediaItems.length) return res.status(400).json({ error: 'At least one file is required.' });

    for (const item of mediaItems) {
      await supabase.from('gallery').insert([{
        url: item.url,
        type: item.type,
        caption: caption || '',
        category: category || 'other',
        source: 'parent',
        submitted_by: name,
        status: 'pending'
      }]);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('gallery-submit error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}