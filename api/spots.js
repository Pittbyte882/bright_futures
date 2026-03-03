// api/spots.js
// GET /api/spots — returns remaining spots per day from Supabase

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabase
      .from('class_spots')
      .select('class_day, spots_remaining');

    if (error) throw error;

    // Convert array to object: { monday: 8, wednesday: 10, friday: 5 }
    const spotsMap = { monday: 10, wednesday: 10, friday: 10 };
    if (data) {
      data.forEach(row => {
        spotsMap[row.class_day] = row.spots_remaining;
      });
    }

    return res.status(200).json(spotsMap);
  } catch (err) {
    console.error('Error fetching spots:', err);
    return res.status(500).json({ error: 'Failed to fetch spots' });
  }
}
