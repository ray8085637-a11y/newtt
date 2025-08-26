import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function normalizeDate(input: string): string | null {
  // Accept formats like 2025-08-31, 2025.08.31, 2025/08/31, 20250831, 2025년 8월 31일
  const ymd = input
    .replace(/년|월|일/g, (m) => (m === '년' ? '-' : m === '월' ? '-' : ''))
    .replace(/\s+/g, '')
  const clean = ymd.replace(/[^0-9]/g, '')
  if (clean.length === 8) {
    const y = clean.slice(0, 4)
    const m = clean.slice(4, 6).padStart(2, '0')
    const d = clean.slice(6, 8).padStart(2, '0')
    const mi = Number(m), di = Number(d)
    if (mi >= 1 && mi <= 12 && di >= 1 && di <= 31) {
      return `${y}-${m}-${d}`
    }
  }
  return null
}

function extractFields(text: string) {
  let amount: number | undefined
  let due_date: string | undefined
  let station_name: string | undefined

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const joined = lines.join('\n')

  // Prefer amounts on lines with keywords
  const amountKeywordLine = lines.find(l => /(금액|납부액|청구금액|합계|총금액)/.test(l))
  const amountLinePool = [amountKeywordLine, ...lines].filter(Boolean) as string[]
  for (const line of amountLinePool) {
    const m = line.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})\s*(원|KRW)?/)
    if (m) { amount = Number(m[1].replace(/,/g, '')); break }
  }
  if (amount === undefined) {
    const ms = [...joined.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})\s*(원|KRW)?/g)]
    if (ms.length) {
      const nums = ms.map(m => Number(m[1].replace(/,/g, '')))
      amount = Math.max(...nums)
    }
  }

  // Prefer due date on lines containing 납부기한/기한/마감
  const dueKeywordLine = lines.find(l => /(납부기한|기한|마감|납부일)/.test(l))
  const datePatterns = [
    /([12][0-9]{3}[.\/-][01]?[0-9][.\/-][0-3]?[0-9])/g,
    /([12][0-9]{3})\s*년\s*([0-1]?[0-9])\s*월\s*([0-3]?[0-9])\s*일?/g,
    /([12][0-9]{7})/g,
  ]
  function findDateIn(str: string): string | null {
    for (const re of datePatterns) {
      const it = re.exec(str)
      if (it) {
        if (re === datePatterns[1]) {
          // 년 월 일 분해 케이스
          const y = it[1];
          const m = String(it[2]).padStart(2, '0')
          const d = String(it[3]).padStart(2, '0')
          return normalizeDate(`${y}-${m}-${d}`)
        }
        const norm = normalizeDate(it[1])
        if (norm) return norm
      }
    }
    return null
  }
  if (dueKeywordLine) {
    const found = findDateIn(dueKeywordLine)
    if (found) due_date = found
  }
  if (!due_date) {
    for (const ln of lines) {
      const found = findDateIn(ln)
      if (found) { due_date = found; break }
    }
  }

  // Station name heuristic
  const stationLine = lines.find(l => /충전소/.test(l))
  station_name = stationLine ? stationLine.replace(/.*충전소\s*[:：-]?\s*/, '') || stationLine : lines[0]?.slice(0, 30)

  return { amount, due_date, station_name }
}

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GOOGLE_VISION_API_KEY' }, { status: 500 })
  }

  const contentType = req.headers.get('content-type') || ''
  let base64: string | null = null

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 })
      }
      const arrayBuffer = await file.arrayBuffer()
      base64 = Buffer.from(arrayBuffer).toString('base64')
    } else {
      const json = await req.json().catch(() => ({}))
      const b64 = json?.base64 as string | undefined
      if (!b64) {
        return NextResponse.json({ error: 'Provide multipart file or { base64 }' }, { status: 400 })
      }
      base64 = b64
    }

    const body = {
      requests: [
        {
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          image: { content: base64 },
        },
      ],
    }

    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}` , {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: 'Vision API error', details: errText }, { status: 502 })
    }

    const data = await res.json()
    const text = data?.responses?.[0]?.fullTextAnnotation?.text || ''
    const fields = extractFields(text || '')

    return NextResponse.json({ text, ...fields })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}