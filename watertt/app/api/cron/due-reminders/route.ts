import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function formatDate(d: Date) {
  const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate()
  return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

export async function GET(req: Request) {
  try {
    // Allow only Vercel Cron (x-vercel-cron) or secret query param
    const url = new URL(req.url)
    const hasCronHeader = req.headers.get('x-vercel-cron') !== null
    const secret = url.searchParams.get('secret')
    const expected = process.env.CRON_BYPASS_TOKEN
    if (!hasCronHeader && (!expected || secret !== expected)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const urlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!urlEnv || !serviceRole) {
      return NextResponse.json({ error: 'Missing Supabase env' }, { status: 500 })
    }

    const supa = createClient(urlEnv, serviceRole)

    const today = new Date()
    const soon = new Date()
    soon.setDate(today.getDate()+3)

    const { data: taxes, error: taxErr } = await supa
      .from('taxes')
      .select('*')
      .gte('due_date', formatDate(today))
      .lte('due_date', formatDate(soon))
      .neq('status', '납부완료')
      .order('due_date', { ascending: true })

    if (taxErr) return NextResponse.json({ error: taxErr.message }, { status: 500 })

    const { data: users, error: userErr } = await supa
      .from('app_users')
      .select('email')
      .eq('is_active', true)

    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

    if (!taxes || taxes.length === 0 || !users || users.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const grouped = taxes.reduce((acc: Record<string, any[]>, t: any) => {
      const k = (t.due_date as string).slice(0,10)
      acc[k] = acc[k] || []
      acc[k].push(t)
      return acc
    }, {})

    let sent = 0
    for (const user of users as { email: string }[]) {
      const parts: string[] = []
      for (const [date, items] of Object.entries(grouped) as [string, any[]][]) {
        parts.push(`<h3>${date}</h3>`)
        parts.push('<ul>')
        for (const it of items) {
          parts.push(`<li>${it.station_name} · ${it.tax_type} · ${Number(it.amount).toLocaleString()}원</li>`)  
        }
        parts.push('</ul>')
      }
      const html = `<div><p>다음 납부 예정(3일 이내)의 세금 내역입니다.</p>${parts.join('\n')}</div>`
      await fetch(`${url.origin}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: user.email, subject: '[EV Tax] 납부 예정 알림', html })
      })
      sent++
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}