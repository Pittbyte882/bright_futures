export default function handler(req, res) {
  // Returns the public anon key — safe to expose, it's already public
  return res.status(200).json({
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  });
}