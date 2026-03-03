// api/register.js
// POST /api/register — saves signup to Supabase, sends emails via Resend

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const OWNER_EMAIL = 'Brightfuturesgrowingmindsllc@gmail.com';
const VENMO_HANDLE = process.env.VENMO_HANDLE || '@BrightFuturesGrowingMinds'; // Set in Vercel env

const PACKAGE_LABELS = {
  single:  { label: 'Single Class',     price: '$40'  },
  '3class': { label: '3-Class Package', price: '$80'  },
  '4class': { label: '4-Class Package', price: '$140' },
};

const DAY_LABELS = {
  monday:    'Monday (Ages 3–6)',
  wednesday: 'Wednesday (Ages 3–6)',
  friday:    'Friday (Ages 7–8)',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { parentFirst, parentLast, email, phone, childFirst, childAge, classDay, package: pkg } = req.body;

  // ── Validate required fields ──
  if (!parentFirst || !parentLast || !email || !childFirst || !childAge || !classDay || !pkg) {
    return res.status(400).json({ error: 'All required fields must be filled in.' });
  }

  // ── Validate age matches day ──
  const age = parseInt(childAge, 10);
  if ((classDay === 'monday' || classDay === 'wednesday') && (age < 3 || age > 6)) {
    return res.status(400).json({ error: 'Monday & Wednesday classes are for ages 3–6 only.' });
  }
  if (classDay === 'friday' && (age < 7 || age > 8)) {
    return res.status(400).json({ error: 'Friday classes are for ages 7–8 only.' });
  }

  // ── Check & decrement spots (atomic via RPC) ──
  const { data: spotsData, error: spotsError } = await supabase
    .rpc('decrement_spot', { day: classDay });

  if (spotsError || !spotsData) {
    console.error('Spots RPC error:', spotsError);
    return res.status(500).json({ error: 'Could not check spot availability. Please try again.' });
  }

  if (spotsData === -1) {
    return res.status(409).json({ error: 'Sorry — this class is now full! Please choose a different day.' });
  }

  // ── Save registration to Supabase ──
  const { error: insertError } = await supabase
    .from('registrations')
    .insert([{
      parent_first: parentFirst,
      parent_last:  parentLast,
      email,
      phone: phone || null,
      child_first:  childFirst,
      child_age:    age,
      class_day:    classDay,
      package:      pkg,
      created_at:   new Date().toISOString(),
    }]);

  if (insertError) {
    console.error('Insert error:', insertError);
    // Still send emails — don't block parent on DB issues
  }

  const pkgInfo  = PACKAGE_LABELS[pkg]  || { label: pkg,      price: '' };
  const dayLabel = DAY_LABELS[classDay] || classDay;

  // ── Send parent confirmation email ──
  try {
    await resend.emails.send({
      from:    'Bright Futures Growing Minds LLC <no-reply@brightfuturesgrowingminds.com>',
      to:      email,
      subject: `🌟 Spot Reserved! — Bright Futures Growing Minds`,
      html: `
        <div style="font-family:'Nunito',Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;background:#FFFBF2;border-radius:20px;overflow:hidden;border:2px solid #FFD23F">
          <div style="background:linear-gradient(135deg,#FF6B6B,#FF9A6C);padding:36px 40px;text-align:center">
            <h1 style="color:#fff;font-size:2rem;margin:0">🌟 You're Almost In!</h1>
            <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:1.1rem">Complete payment to secure ${childFirst}'s spot</p>
          </div>
          <div style="padding:36px 40px">
            <p style="font-size:1.05rem;color:#3D3D5C">Hi ${parentFirst}! 👋</p>
            <p style="color:#555;line-height:1.7">Thank you for registering ${childFirst} for Bright Futures Growing Minds enrichment classes. Here's a summary of your reservation:</p>

            <div style="background:#fff;border-radius:14px;padding:24px;margin:24px 0;border:2px solid #FFE0B2">
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Child</td>    <td style="padding:8px 0;font-weight:700;color:#1A1A2E">${childFirst} (Age ${age})</td></tr>
                <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Class Day</td><td style="padding:8px 0;font-weight:700;color:#1A1A2E">${dayLabel}</td></tr>
                <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Time</td>     <td style="padding:8px 0;font-weight:700;color:#1A1A2E">10:30 AM – 1:30 PM</td></tr>
                <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Package</td>  <td style="padding:8px 0;font-weight:700;color:#1A1A2E">${pkgInfo.label}</td></tr>
                <tr style="border-top:2px solid #FFD23F"><td style="padding:12px 0 0;color:#FF6B6B;font-weight:800;font-size:1rem">Amount Due</td><td style="padding:12px 0 0;color:#FF6B6B;font-weight:800;font-size:1.2rem">${pkgInfo.price}</td></tr>
              </table>
            </div>

            <div style="background:#FFF0E6;border-radius:14px;padding:24px;margin:0 0 24px;border-left:5px solid #FF6B6B">
              <h3 style="color:#1A1A2E;margin:0 0 8px">💳 How to Pay</h3>
              <p style="color:#555;margin:0;line-height:1.7">Please send <strong>${pkgInfo.price}</strong> via Venmo to <strong>${VENMO_HANDLE}</strong> to officially secure ${childFirst}'s spot. Please include your child's name and class day in the Venmo note.</p>
            </div>

            <div style="background:#F4F9F8;border-radius:14px;padding:20px;margin:0 0 24px">
              <h3 style="color:#1A1A2E;margin:0 0 8px">🍎 Don't Forget</h3>
              <ul style="color:#555;line-height:1.9;margin:0;padding-left:20px">
                <li>Please pack a <strong>snack and/or a small lunch</strong> for ${childFirst} — there is a lunch break during class</li>
                <li>Classes run <strong>10:30 AM to 1:30 PM</strong> — please arrive on time and pick up promptly</li>
                <li>Spots are limited to 10 children per class</li>
              </ul>
            </div>

            <p style="color:#555;line-height:1.7">Questions? Reply to this email or reach us at <a href="mailto:${OWNER_EMAIL}" style="color:#FF6B6B">${OWNER_EMAIL}</a></p>
            <p style="color:#555">We're so excited to meet ${childFirst}! 🎨🔬🎵</p>
            <p style="font-weight:800;color:#1A1A2E">— The Bright Futures Growing Minds Team 🌟</p>
          </div>
          <div style="background:#1A1A2E;padding:16px 40px;text-align:center">
            <p style="color:rgba(255,255,255,0.5);font-size:.8rem;margin:0">Bright Futures Growing Minds LLC · ${OWNER_EMAIL}</p>
          </div>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('Parent email error:', emailErr);
    // Don't fail the whole request for email errors
  }

  // ── Send owner notification email ──
  try {
    await resend.emails.send({
      from:    'Bright Futures Growing Minds Registrations <no-reply@brightfuturesgrowingminds.com>',
      to:      OWNER_EMAIL,
      subject: `🎉 New Registration — ${childFirst} (${dayLabel})`,
      html: `
        <div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden">
          <div style="background:#1A1A2E;padding:24px 32px">
            <h2 style="color:#FFD23F;margin:0;font-size:1.4rem">🎉 New Class Registration</h2>
          </div>
          <div style="padding:28px 32px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#888;font-size:.9rem;width:140px">Parent Name</td>  <td style="font-weight:700;color:#1A1A2E">${parentFirst} ${parentLast}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Parent Email</td> <td style="font-weight:700;color:#1A1A2E"><a href="mailto:${email}" style="color:#FF6B6B">${email}</a></td></tr>
              ${phone ? `<tr><td style="padding:8px 0;color:#888;font-size:.9rem">Phone</td><td style="font-weight:700;color:#1A1A2E">${phone}</td></tr>` : ''}
              <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Child</td>         <td style="font-weight:700;color:#1A1A2E">${childFirst}, Age ${age}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Class Day</td>    <td style="font-weight:700;color:#1A1A2E">${dayLabel}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Package</td>      <td style="font-weight:700;color:#1A1A2E">${pkgInfo.label} — ${pkgInfo.price}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Spots Left</td>  <td style="font-weight:700;color:#FF6B6B">${spotsData} remaining on ${dayLabel}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:.9rem">Registered At</td><td style="font-weight:700;color:#1A1A2E">${new Date().toLocaleString('en-US', {timeZone:'America/New_York'})}</td></tr>
            </table>
          </div>
        </div>
      `,
    });
  } catch (ownerEmailErr) {
    console.error('Owner email error:', ownerEmailErr);
  }

  return res.status(200).json({ success: true, spotsRemaining: spotsData });
}
