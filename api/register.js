import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionIds, parentFirst, parentLast, email, phone, childFirst, childAge, package: pkg } = req.body;

  if (!sessionIds || !sessionIds.length || !parentFirst || !email || !childFirst) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Check all sessions still have availability
    const { data: sessions } = await supabase
      .from('session_availability')
      .select('*')
      .in('id', sessionIds);

    const full = sessions.filter(s => s.spots_remaining <= 0);
    if (full.length > 0) {
      const fullDates = full.map(s => s.date).join(', ');
      return res.status(409).json({ error: `Sorry, the following dates are now full: ${fullDates}` });
    }

    // Insert one registration per session
    const registrations = sessionIds.map(sid => ({
      session_id: sid,
      parent_first: parentFirst,
      parent_last: parentLast,
      email,
      phone,
      child_first: childFirst,
      child_age: childAge,
      package: pkg,
      paid: false
    }));

    const { error: insertError } = await supabase.from('registrations').insert(registrations);
    if (insertError) return res.status(500).json({ error: insertError.message });

    // Format dates for email
    const dateList = sessions
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(s => new Date(s.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))
      .join('<br/>');

    const pkgPrices = { single: '$40', '3class': '$80', '4class': '$140' };
    const price = pkgPrices[pkg] || '';

    // Send confirmation email to parent
    await resend.emails.send({
      from: 'Bright Futures Growing Minds <noreply@brightfuturesgrowingminds.com>',
      to: email,
      subject: '🌟 Your Spot is Reserved! — Bright Futures Growing Minds',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#FF6B6B">Hi ${parentFirst}! 🌟</h2>
          <p>You've successfully reserved spots for <strong>${childFirst}</strong>!</p>
          <h3 style="color:#1A1A2E">Your Reserved Dates:</h3>
          <p style="background:#FFF0E6;padding:16px;border-radius:12px;line-height:2">${dateList}</p>
          <h3 style="color:#1A1A2E">Package: ${pkg} — ${price}</h3>
          <div style="background:#FFE8E8;border-left:4px solid #FF6B6B;padding:16px;border-radius:8px;margin:20px 0">
            <strong>⚠️ Payment Required Within 24 Hours</strong><br/>
            Your spot will be released if payment is not received within 24 hours of booking.
            Please send payment via Venmo: <strong>@${process.env.VENMO_HANDLE}</strong>
          </div>
          <p>Questions? Reply to this email or contact us at 
            <a href="mailto:Brightfuturesgrowingmindsllc@gmail.com">Brightfuturesgrowingmindsllc@gmail.com</a>
          </p>
          <p style="color:#888;font-size:0.85rem">Bright Futures Growing Minds LLC — Enrichment Classes for Kids Ages 3–8</p>
        </div>
      `
    });

    // Notify owner
    await resend.emails.send({
      from: 'Bright Futures Growing Minds <noreply@brightfuturesgrowingminds.com>',
      to: 'Brightfuturesgrowingmindsllc@gmail.com',
      subject: `New Registration — ${parentFirst} ${parentLast}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#FF6B6B">New Registration 🎉</h2>
          <p><strong>Parent:</strong> ${parentFirst} ${parentLast}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Child:</strong> ${childFirst}, age ${childAge}</p>
          <p><strong>Package:</strong> ${pkg} — ${price}</p>
          <h3>Dates Booked:</h3>
          <p style="background:#FFF0E6;padding:16px;border-radius:12px;line-height:2">${dateList}</p>
          <p style="color:#FF6B6B"><strong>⚠️ Payment due within 24 hours or spots will be released.</strong></p>
        </div>
      `
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
}