import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function normalizeDate(input: string): string | null {
  // Accept formats like 2025-08-31, 2025.08.31, 2025/08/31, 20250831
  const clean = input.replace(/[^0-9]/g, '')
  if (clean.length === 8) {
    const y = clean.slice(0, 4)
    const m = clean.slice(4, 6)
    const d = clean.slice(6, 8)
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`
    }
  }
  return null
}

function extractFields(text: string) {
  let amount: number | undefined
  let due_date: string | undefined
  let station_name: string | undefined

  // Amount: look for the largest number followed by 원 or a standalone large number
  const amountMatches = [...text.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})\s*원?/g)]
  if (amountMatches.length > 0) {
    const nums = amountMatches.map(m => Number(m[1].replace(/,/g, '')))
    const max = Math.max(...nums)
    if (Number.isFinite(max)) amount = max
  }

  // Due date: look for common date tokens possibly near words like 납부, 기한
  const dateMatches = [...text.matchAll(/([12][0-9]{3}[.\/-][01]?[0-9][.\/-][0-3]?[0-9]|[12][0-9]{7})/g)]
  for (const m of dateMatches) {
    const norm = normalizeDate(m[1])
    if (norm) { due_date = norm; break }
  }

  // Station: simple heuristic - line containing '충전소' or the first long line near top
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const stationLine = lines.find(l => /충전소/.test(l))
  if (stationLine) {
    station_name = stationLine.replace(/.*충전소\s*[:：-]?\s*/,'') || stationLine
  } else {
    station_name = lines[0]?.slice(0, 30)
  }

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