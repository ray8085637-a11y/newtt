'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Station = {
  id: string
  name: string
  address?: string
  is_active: boolean
  created_at?: string
}

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')

  async function fetchStations() {
    const { data } = await supabase
      .from('stations')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })
    if (data) setStations(data as any)
    setLoading(false)
  }

  useEffect(() => {
    fetchStations()
  }, [])

  return (
    <>
      <style jsx global>{`
        body { background: #fafafa; }
        .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
        .header { background: white; border: 1px solid #e5e5e5; border-radius: 4px; padding: 16px; margin-bottom: 16px; display:flex; justify-content:space-between; align-items:center; }
        .btn { padding: 8px 12px; border: 1px solid #e5e5e5; background: white; border-radius: 4px; font-size: 13px; cursor: pointer; }
        .btn-primary { background: #000; color: white; border-color: #000; }
        .row { background: white; border: 1px solid #e5e5e5; border-radius: 4px; padding: 16px; margin-bottom: 16px; }
        .list-header, .list-row { display:grid; grid-template-columns: 2fr 3fr 120px 160px; gap: 12px; align-items:center; }
        .list-header { font-size: 12px; color:#666; padding-bottom:8px; border-bottom:1px solid #f0f0f0; }
        .list-row { padding: 10px 0; border-bottom:1px solid #f7f7f7; }
        .badge { font-size:11px; padding:2px 6px; border-radius: 3px; background:#eee; }
        .search { display:flex; gap:8px; }
        .input { width:100%; padding: 10px 12px; border:1px solid #e5e5e5; border-radius:4px; font-size:13px; }
      `}</style>

      <div className="container">
        <div className="header">
          <div>
            <h2 style={{margin:0, fontSize:'18px'}}>충전소 관리</h2>
            <div style={{fontSize:'12px', color:'#666'}}>충전소 등록/수정/비활성화</div>
          </div>
          <div style={{display:'flex', gap:'8px'}}>
            <a href="/" className="btn">← 목록으로</a>
            <a href="/" className="btn">세금 페이지</a>
          </div>
        </div>

        <div className="row">
          <div className="search">
            <input className="input" placeholder="이름으로 검색" value={query} onChange={e=>setQuery(e.target.value)} />
          </div>
        </div>

        <div className="row" style={{display:'grid', gridTemplateColumns:'1fr 2fr 120px'}}>
          <input className="input" placeholder="새 충전소 이름" value={newName} onChange={e=>setNewName(e.target.value)} />
          <input className="input" placeholder="주소 (선택)" value={newAddress} onChange={e=>setNewAddress(e.target.value)} />
          <button className="btn btn-primary" onClick={async ()=>{
            if (!newName.trim()) return
            const { error } = await supabase.from('stations').insert([{ name: newName.trim(), address: newAddress || null, is_active: true }])
            if (!error) { setNewName(''); setNewAddress(''); fetchStations() }
          }}>추가</button>
        </div>

        <div className="row">
          <div className="list-header">
            <div>이름</div>
            <div>주소</div>
            <div>상태</div>
            <div>작업</div>
          </div>
          {loading ? <div style={{padding:'20px'}}>불러오는 중...</div> : stations
            .filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
            .map(s => (
              <div className="list-row" key={s.id}>
                <div style={{fontWeight:600}}>{s.name}</div>
                <div style={{fontSize:'12px', color:'#666'}}>{s.address || '-'}</div>
                <div><span className="badge" style={{background: s.is_active ? '#e8f4ff' : '#f0f0f0', color: s.is_active ? '#0066ff' : '#666'}}>{s.is_active ? '활성' : '비활성'}</span></div>
                <div style={{display:'flex', gap:'8px'}}>
                  <button className="btn" onClick={async ()=>{
                    const name = prompt('새 이름 입력', s.name);
                    if (!name) return;
                    const { error } = await supabase.from('stations').update({ name }).eq('id', s.id)
                    if (!error) fetchStations()
                  }}>이름수정</button>
                  {s.is_active ? (
                    <button className="btn" onClick={async ()=>{
                      const ok = confirm('비활성화 하시겠습니까?')
                      if (!ok) return
                      const { error } = await supabase.from('stations').update({ is_active: false }).eq('id', s.id)
                      if (!error) fetchStations()
                    }}>비활성화</button>
                  ) : (
                    <button className="btn" onClick={async ()=>{
                      const { error } = await supabase.from('stations').update({ is_active: true }).eq('id', s.id)
                      if (!error) fetchStations()
                    }}>활성화</button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  )
}