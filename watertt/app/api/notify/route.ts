import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
  if (!SENDGRID_API_KEY) {
    return NextResponse.json({ error: 'Missing SENDGRID_API_KEY' }, { status: 500 })
  }

  try {
    const payload = await req.json()
    const to = payload?.to as string | undefined
    const subject = payload?.subject as string | undefined
    const html = payload?.html as string | undefined

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'to, subject, html required' }, { status: 400 })
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'no-reply@watercharging.com', name: 'EV Tax Management' },
        subject,
        content: [{ type: 'text/html', value: html }]
      })
    })

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: 'SendGrid error', details: txt }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}