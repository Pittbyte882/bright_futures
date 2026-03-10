import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// NO export config here — we need the default body parser ON for JSON

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { name, rating, text, ageGroup, mediaUrls } = body;

    if (!name || !rating || !text) {
      return res.status(400).json({ error: 'Name, rating, and review text are required.' });
    }

    const { error } = await supabase.from('testimonials').insert([{
      reviewer_name: name,
      rating: parseInt(rating),
      review_text: text,
      age_group: ageGroup || 'ages-3-6',
      media_urls: mediaUrls || [],
      status: 'pending'
    }]);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('submit-testimonial error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}