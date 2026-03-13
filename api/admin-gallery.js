import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.headers['x-admin'] !== '1') return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const caption = fields.caption?.[0] || '';
    const category = fields.category?.[0] || 'other';
    const source = fields.source?.[0] || 'owner';
    const uploadedFiles = Array.isArray(files.files) ? files.files : [files.files].filter(Boolean);
    const inserted = [];
    for (const file of uploadedFiles) {
      const buf = fs.readFileSync(file.filepath);
      const ext = file.originalFilename?.split('.').pop() || 'jpg';
      const path = `gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('media').upload(path, buf, { contentType: file.mimetype });
      if (upErr) continue;
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      const type = file.mimetype?.startsWith('video') ? 'video' : 'image';
      const { data } = await supabase.from('gallery').insert([{
        url: urlData.publicUrl, type, caption, category, source,
        submitted_by: source === 'owner' ? 'Owner' : null,
        status: source === 'owner' ? 'approved' : 'pending'
      }]).select().single();
      if (data) inserted.push(data);
    }
    return res.status(200).json({ ok: true, inserted });
  }
  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    const { error } = await supabase.from('gallery').update({ status }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}