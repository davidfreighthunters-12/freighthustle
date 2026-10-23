const nodemailer = require('nodemailer');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LABELS = {
  legalName: 'Legal company name', dba: 'DBA', ein: 'EIN', mc: 'MC number', dot: 'DOT number',
  ownerName: 'Owner name', ownerPhone: 'Owner phone', ownerEmail: 'Owner email',
  equip: 'Equipment', trucks: 'Number of trucks', lanes: 'Preferred lanes',
  signature: 'Signature', signDate: 'Signed on'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: bots fill this in
  if (!b.legalName || !b.mc || !b.ownerEmail || !b.signature) return res.status(400).json({ error: 'Missing required fields' });

  const rows = Object.entries(LABELS)
    .map(([k, label]) => `<tr><td style="padding:4px 12px 4px 0"><b>${label}</b></td><td>${esc(b[k])}</td></tr>`)
    .join('');

  const attachments = (Array.isArray(b.files) ? b.files : []).slice(0, 6).map(f => ({
    filename: `${f.field}-${String(f.name).replace(/[^\w.\-]/g, '_')}`,
    content: Buffer.from(f.data, 'base64'),
    contentType: f.type || undefined
  }));

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.TO_EMAIL || process.env.SMTP_USER,
      replyTo: b.ownerEmail,
      subject: `Carrier packet: ${b.legalName} (MC ${b.mc})`,
      html: `<table>${rows}</table>`,
      attachments
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Send failed' });
  }
};
