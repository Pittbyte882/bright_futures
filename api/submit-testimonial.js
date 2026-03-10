import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Dynamically import formidable to avoid bundling issues
    const { default: formidable } = await import('formidable');
    const fs = await import('fs');

    const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const name = fields.name?.[0]?.trim();
    const rating = parseInt(fields.rating?.[0] || '0');
    const text = fields.text?.[0]?.trim();
    const ageGroup = fields.ageGroup?.[0] || 'ages-3-6';

    if (!name || !rating || !text) {
      return res.status(400).json({ error: 'Name, rating, and review text are required.' });
    }

    const mediaUrls = [];
    const uploadedFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];

    for (const file of uploadedFiles) {
      try {
        const buf = fs.readFileSync(file.filepath);
        const ext = (file.originalFilename || 'file').split('.').pop();
        const path = `testimonials/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('media')
          .upload(path, buf, { contentType: file.mimetype || 'application/octet-stream' });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
          mediaUrls.push(urlData.publicUrl);
        }
      } catch (fileErr) {
        console.error('File upload error:', fileErr);
        // Continue without the file rather than failing the whole request
      }
    }

    const { error } = await supabase.from('testimonials').insert([{
      reviewer_name: name,
      rating,
      review_text: text,
      age_group: ageGroup,
      media_urls: mediaUrls,
      status: 'pending'
    }]);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('submit-testimonial error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}