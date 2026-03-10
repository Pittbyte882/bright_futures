import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { default: formidable } = await import('formidable');
    const fs = await import('fs');

    const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const name = fields.name?.[0]?.trim();
    const caption = fields.caption?.[0]?.trim() || '';
    const category = fields.category?.[0] || 'other';

    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const uploadedFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
    if (!uploadedFiles.length) return res.status(400).json({ error: 'At least one file is required.' });

    for (const file of uploadedFiles) {
      try {
        const buf = fs.readFileSync(file.filepath);
        const ext = (file.originalFilename || 'file').split('.').pop();
        const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('media')
          .upload(path, buf, { contentType: file.mimetype || 'application/octet-stream' });
        if (upErr) continue;
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
        const type = (file.mimetype || '').startsWith('video') ? 'video' : 'image';
        await supabase.from('gallery').insert([{
          url: urlData.publicUrl, type, caption, category,
          source: 'parent', submitted_by: name, status: 'pending'
        }]);
      } catch (fileErr) {
        console.error('File upload error:', fileErr);
      }
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('gallery-submit error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}