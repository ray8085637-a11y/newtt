'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Tax = {
  id: string
  station_name: string
  tax_type: string
  amount: number
  due_date: string
  status: '회계사검토' | '납부예정' | '납부완료'
  memo?: string
  is_recurring: boolean
  recurring_period?: string
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [formData, setFormData] = useState({
    station_name: '',
    tax_type: '재산세',
    amount: '',
    due_date: '',
    memo: '',
    is_recurring: false,
    recurring_period: ''
  })
  const [userRole, setUserRole] = useState<string>('viewer')

  useEffect(() => {
    const savedLogin = localStorage.getItem('isLoggedIn')
    const savedRole = localStorage.getItem('userRole')
    if (savedLogin === 'true') {
      setUserRole(savedRole || 'viewer')
      setIsLoggedIn(true)
      fetchTaxes()
    } else {
      setLoading(false)
    }
  }, [])

  // 로그인 처리
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
  
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', loginForm.email)
      .eq('password', loginForm.password)
      .eq('is_active', true)
      .single()
  
    if (data) {
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('userEmail', loginForm.email)
      localStorage.setItem('userRole', data.role)
      setUserRole(data.role)
      setIsLoggedIn(true)
      fetchTaxes()
    } else {
      setLoginError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  // 로그아웃
  function handleLogout() {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userRole')
    setIsLoggedIn(false)
    setUserRole('viewer')
    setLoginForm({ email: '', password: '' })
  }

  async function fetchTaxes() {
    const { data, error } = await supabase
      .from('taxes')
      .select('*')
      .order('due_date', { ascending: true })
    
    if (data) setTaxes(data)
    setLoading(false)
  }

  async function updateStatus(id: string, currentStatus: string, taxType: string) {
    let newStatus: string
    
    if (taxType === '취득세') {
      if (currentStatus === '회계사검토') newStatus = '납부예정'
      else if (currentStatus === '납부예정') newStatus = '납부완료'
      else newStatus = '회계사검토'
    } else {
      newStatus = currentStatus === '납부예정' ? '납부완료' : '납부예정'
    }
    
    const { error } = await supabase
      .from('taxes')
      .update({ status: newStatus })
      .eq('id', id)
    
    if (!error) {
      fetchTaxes()
      showToast(`상태 변경: ${newStatus}`)
    }
  }

  async function revertStatus(id: string, currentStatus: string, taxType: string) {
    let newStatus: string
    
    if (taxType === '취득세') {
      if (currentStatus === '납부완료') newStatus = '납부예정'
      else if (currentStatus === '납부예정') newStatus = '회계사검토'
      else return
    } else {
      if (currentStatus === '납부완료') newStatus = '납부예정'
      else return
    }
    
    const { error } = await supabase
      .from('taxes')
      .update({ status: newStatus })
      .eq('id', id)
    
    if (!error) {
      fetchTaxes()
      showToast(`상태 되돌림: ${newStatus}`)
    }
  }

  async function addTax(e: React.FormEvent) {
    e.preventDefault()
    
    const taxData: any = {
      ...formData,
      amount: parseInt(formData.amount),
      status: '납부예정'
    }
    
    if (formData.tax_type === '취득세') {
      taxData.status = '회계사검토'
      taxData.is_recurring = false
      taxData.recurring_period = null
    } else if (formData.tax_type === '재산세') {
      taxData.is_recurring = true
      taxData.recurring_period = '매년'
    }
    
    const { error } = await supabase
      .from('taxes')
      .insert([taxData])
    
    if (!error) {
      setShowForm(false)
      setFormData({
        station_name: '',
        tax_type: '재산세',
        amount: '',
        due_date: '',
        memo: '',
        is_recurring: false,
        recurring_period: ''
      })
      fetchTaxes()
      showToast('세금이 추가되었습니다')
    }
  }

  async function deleteTax(id: string) {
    if (confirm('정말 삭제하시겠습니까?')) {
      const { error } = await supabase
        .from('taxes')
        .delete()
        .eq('id', id)
      
      if (!error) {
        fetchTaxes()
        showToast('삭제되었습니다')
      }
    }
  }

  const filteredTaxes = taxes.filter(tax => {
    if (filter === 'review') return tax.status === '회계사검토'
    if (filter === 'pending') return tax.status === '납부예정'
    if (filter === 'paid') return tax.status === '납부완료'
    if (filter === 'acquisition') return tax.tax_type === '취득세'
    if (filter === 'property') return tax.tax_type === '재산세'
    if (filter === 'other') return tax.tax_type === '기타세'
    return true
  })

  const stats = {
    review: taxes.filter(t => t.status === '회계사검토').length,
    pending: taxes.filter(t => t.status === '납부예정').length,
    paid: taxes.filter(t => t.status === '납부완료').length,
    totalUnpaid: taxes.filter(t => t.status !== '납부완료').reduce((sum, t) => sum + t.amount, 0)
  }

  function showToast(message: string) {
    const toast = document.createElement('div')
    toast.className = 'toast'
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }

  function getDday(date: string) {
    const days = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    if (days < 0) return <span style={{color:'#ff4444'}}>D+{Math.abs(days)} 연체</span>
    if (days === 0) return <span style={{color:'#ff4444'}}>D-DAY</span>
    if (days <= 7) return <span style={{color:'#ff8800'}}>D-{days}</span>
    return `D-${days}`
  }

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <>
        <style jsx global>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #fafafa;
            color: #000;
          }
          .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .login-box {
            background: white;
            border: 1px solid #e5e5e5;
            border-radius: 4px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
          }
          .login-logo {
            text-align: center;
            margin-bottom: 32px;
          }
          .login-logo h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .login-logo p {
            font-size: 13px;
            color: #666;
          }
          .form-group {
            margin-bottom: 20px;
          }
          .form-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #333;
          }
          .form-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #e5e5e5;
            border-radius: 4px;
            font-size: 14px;
            transition: border-color 0.2s;
          }
          .form-input:focus {
            outline: none;
            border-color: #999;
          }
          .btn-login {
            width: 100%;
            background: #000;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          .btn-login:hover {
            opacity: 0.8;
          }
          .error-message {
            background: #ffebeb;
            color: #cc0000;
            padding: 10px;
            border-radius: 4px;
            font-size: 13px;
            margin-bottom: 16px;
          }
        `}</style>
        
        <div className="login-container">
          <div className="login-box">
            <div className="login-logo">
              <h1>⚡ water 세무 일정 관리 시스템</h1>
              <p>관리자 로그인</p>
            </div>
            
            {loginError && (
              <div className="error-message">{loginError}</div>
            )}
            
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  className="form-input"
                  value={loginForm.email}
                  onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                  placeholder="contact@watercharging.com"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input
                  type="password"
                  className="form-input"
                  value={loginForm.password}
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                  placeholder="비밀번호 입력"
                  required
                />
              </div>
              
              <button type="submit" className="btn-login">
                로그인
              </button>
            </form>
            
            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#f5f5f5',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#666'
            }}>
              <strong>테스트 계정:</strong><br/>
              <div style={{marginTop: '8px', lineHeight: '1.6'}}>
                <strong>관리자:</strong> contact@watercharging.com / watercontact!@<br/>
                <small style={{color: '#999'}}>→ 모든 기능 사용 가능</small><br/><br/>
                
                <strong>편집자:</strong> editor@watercharging.com / editor123!@<br/>
                <small style={{color: '#999'}}>→ 추가/수정 가능, 삭제 불가</small><br/><br/>
                
                <strong>뷰어:</strong> viewer@watercharging.com / viewer123!@<br/>
                <small style={{color: '#999'}}>→ 조회만 가능</small>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // 메인 화면 (로그인 후)
  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #fafafa;
          color: #000;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: white;
          border-bottom: 1px solid #e5e5e5;
          padding: 20px;
          margin: -20px -20px 20px -20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-left h1 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .header-left p {
          font-size: 12px;
          color: #666;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .user-info {
          font-size: 13px;
          color: #666;
        }
        .btn-logout {
          padding: 6px 12px;
          border: 1px solid #e5e5e5;
          background: white;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-logout:hover {
          border-color: #999;
          background: #fafafa;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: white;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          padding: 16px;
        }
        .stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #999;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 600;
        }
        .stat-sub {
          font-size: 13px;
          color: #666;
          margin-top: 4px;
        }
        .filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .filter-btn {
          padding: 8px 16px;
          border: 1px solid #e5e5e5;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .filter-btn:hover {
          border-color: #999;
        }
        .filter-btn.active {
          background: black;
          color: white;
          border-color: black;
        }
        .table-container {
          background: white;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          overflow: hidden;
        }
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e5e5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          background: #fafafa;
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
          border-bottom: 1px solid #e5e5e5;
        }
        td {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 13px;
        }
        tr:hover {
          background: #fafafa;
        }
        .status-badge {
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          display: inline-block;
        }
        .status-badge.review {
          background: #ffebeb;
          color: #ff4444;
        }
        .status-badge.pending {
          background: #e8f4ff;
          color: #0066ff;
        }
        .status-badge.paid {
          background: #f0f0f0;
          color: #666;
        }
        .action-btns {
          display: flex;
          gap: 4px;
        }
        .action-btn {
          padding: 4px 8px;
          font-size: 11px;
          border: 1px solid #e5e5e5;
          background: white;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-btn:hover {
          border-color: #999;
          background: #fafafa;
        }
        .action-btn.next {
          background: #000;
          color: white;
          border-color: #000;
        }
        .action-btn.next:hover {
          opacity: 0.8;
        }
        .action-btn.delete {
          color: #ff4444;
          border-color: #ffdddd;
        }
        .btn-primary {
          background: #000;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-primary:hover {
          opacity: 0.8;
        }
        .recurring {
          font-size: 10px;
          color: #666;
          margin-top: 2px;
        }
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          border-radius: 4px;
          padding: 24px;
          width: 90%;
          max-width: 440px;
        }
        .modal-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 24px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #333;
        }
        .form-input, .form-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          font-size: 13px;
          transition: border-color 0.2s;
        }
        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #999;
        }
        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 28px;
        }
        .btn-cancel {
          padding: 8px 16px;
          border: 1px solid #e5e5e5;
          background: white;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-cancel:hover {
          border-color: #999;
          background: #fafafa;
        }
        .toast {
          position: fixed;
          top: 24px;
          right: 24px;
          background: #000;
          color: white;
          padding: 12px 20px;
          border-radius: 4px;
          font-size: 13px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          animation: slideIn 0.3s ease;
          z-index: 2000;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div className="container">
        <div className="header">
          <div className="header-left">
            <h1>⚡ EV 충전소 세금 관리 시스템</h1>
            <p>전기차 충전소 세금 납부 일정 관리</p>
          </div>
          <div className="header-right">
            <span className="user-info">
              {localStorage.getItem('userEmail')}
              <span style={{
                marginLeft: '8px',
                padding: '2px 6px',
                background: userRole === 'admin' ? '#ff4444' : 
                            userRole === 'editor' ? '#0066ff' : '#999',
                color: 'white',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {userRole === 'admin' ? '관리자' : 
                 userRole === 'editor' ? '편집자' : '뷰어'}
              </span>
            </span>
            <button className="btn-logout" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </div>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-label">회계사 검토</div>
            <div className="stat-value" style={{color: '#ff4444'}}>{stats.review}</div>
            <div className="stat-sub">취득세만 해당</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">납부 예정</div>
            <div className="stat-value" style={{color: '#0066ff'}}>{stats.pending}</div>
            <div className="stat-sub">{stats.totalUnpaid.toLocaleString()}원</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">납부 완료</div>
            <div className="stat-value" style={{color: '#666'}}>{stats.paid}</div>
            <div className="stat-sub">처리 완료</div>
          </div>
        </div>

        <div className="filters">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            전체
          </button>
          <div style={{borderLeft: '1px solid #e5e5e5', margin: '0 4px'}}></div>
          <button className={`filter-btn ${filter === 'review' ? 'active' : ''}`} onClick={() => setFilter('review')}>
            회계사검토
          </button>
          <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
            납부예정
          </button>
          <button className={`filter-btn ${filter === 'paid' ? 'active' : ''}`} onClick={() => setFilter('paid')}>
            납부완료
          </button>
          <div style={{borderLeft: '1px solid #e5e5e5', margin: '0 4px'}}></div>
          <button className={`filter-btn ${filter === 'acquisition' ? 'active' : ''}`} onClick={() => setFilter('acquisition')}>
            취득세
          </button>
          <button className={`filter-btn ${filter === 'property' ? 'active' : ''}`} onClick={() => setFilter('property')}>
            재산세
          </button>
          <button className={`filter-btn ${filter === 'other' ? 'active' : ''}`} onClick={() => setFilter('other')}>
            기타세
          </button>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 style={{fontSize: '14px', fontWeight: '600', margin: 0}}>세금 목록</h3>
            {(userRole === 'admin' || userRole === 'editor') && (
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                + 세금 추가
              </button>
            )}
            {userRole === 'viewer' && (
              <span style={{fontSize: '12px', color: '#999'}}>조회 전용 계정</span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th>충전소</th>
                <th>세금종류</th>
                <th>금액</th>
                <th>납부기한</th>
                <th>D-DAY</th>
                <th>상태</th>
                <th>메모</th>
                <th style={{width: '140px'}}>작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{textAlign: 'center', padding: '40px'}}>
                    로딩중...
                  </td>
                </tr>
              ) : filteredTaxes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                    데이터가 없습니다
                  </td>
                </tr>
              ) : (
                filteredTaxes.map(tax => (
                  <tr key={tax.id}>
                    <td style={{fontWeight: '500'}}>{tax.station_name}</td>
                    <td>
                      {tax.tax_type}
                      {tax.is_recurring && (
                        <div className="recurring">🔄 {tax.recurring_period}</div>
                      )}
                    </td>
                    <td style={{fontWeight: '600'}}>{tax.amount.toLocaleString()}원</td>
                    <td>{new Date(tax.due_date).toLocaleDateString('ko-KR')}</td>
                    <td>{getDday(tax.due_date)}</td>
                    <td>
                      <span className={`status-badge ${
                        tax.status === '회계사검토' ? 'review' :
                        tax.status === '납부예정' ? 'pending' : 'paid'
                      }`}>
                        {tax.status}
                      </span>
                    </td>
                    <td style={{fontSize: '12px', color: '#666'}}>{tax.memo}</td>
                    <td>
                      <div className="action-btns">
                        {/* 상태 변경 버튼 - viewer는 비활성화 */}
                        {tax.status !== '납부완료' && (
                          <button 
                            className="action-btn next"
                            onClick={() => updateStatus(tax.id, tax.status, tax.tax_type)}
                            title={userRole === 'viewer' ? '조회 권한만 있습니다' : ''}
                            style={{opacity: userRole === 'viewer' ? 0.5 : 1}}
                            disabled={userRole === 'viewer'}
                          >
                            다음 →
                          </button>
                        )}
                        
                        {/* 이전 버튼 - viewer는 비활성화 */}
                        {((tax.tax_type === '취득세' && tax.status !== '회계사검토') || 
                          (tax.tax_type !== '취득세' && tax.status === '납부완료')) && (
                          <button 
                            className="action-btn"
                            onClick={() => revertStatus(tax.id, tax.status, tax.tax_type)}
                            title={userRole === 'viewer' ? '조회 권한만 있습니다' : ''}
                            style={{opacity: userRole === 'viewer' ? 0.5 : 1}}
                            disabled={userRole === 'viewer'}
                          >
                            ← 이전
                          </button>
                        )}
                        
                        {/* 삭제 버튼 - admin만 표시 */}
                        {userRole === 'admin' && (
                          <button 
                            className="action-btn delete"
                            onClick={() => deleteTax(tax.id)}
                          >
                            삭제
                          </button>
                        )}
                        
                        {/* viewer는 권한 없음 메시지 */}
                        {userRole === 'viewer' && (
                          <span style={{fontSize: '11px', color: '#999'}}>조회전용</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showForm && (
          <div className="modal" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2 className="modal-title">세금 추가</h2>
              <form onSubmit={addTax}>
                <div className="form-group">
                  <label className="form-label">충전소</label>
                  <input
                    className="form-input"
                    value={formData.station_name}
                    onChange={e => setFormData({...formData, station_name: e.target.value})}
                    placeholder="예: 서울역 충전소"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">세금 종류</label>
                  <select 
                    className="form-select"
                    value={formData.tax_type}
                    onChange={e => setFormData({...formData, tax_type: e.target.value})}
                  >
                    <option value="취득세">취득세 (회계사검토 필요)</option>
                    <option value="재산세">재산세 (매년 반복)</option>
                    <option value="기타세">기타세</option>
                  </select>
                </div>
                
                {formData.tax_type === '기타세' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">반복 여부</label>
                      <select 
                        className="form-select"
                        value={formData.is_recurring ? 'true' : 'false'}
                        onChange={e => setFormData({...formData, is_recurring: e.target.value === 'true'})}
                      >
                        <option value="false">1회성</option>
                        <option value="true">반복</option>
                      </select>
                    </div>
                    
                    {formData.is_recurring && (
                      <div className="form-group">
                        <label className="form-label">반복 주기</label>
                        <select 
                          className="form-select"
                          value={formData.recurring_period}
                          onChange={e => setFormData({...formData, recurring_period: e.target.value})}
                        >
                          <option value="">선택하세요</option>
                          <option value="매월">매월 (전기요금 등)</option>
                          <option value="연2회">연2회 (환경개선부담금 등)</option>
                          <option value="분기">분기별</option>
                        </select>
                      </div>
                    )}
                  </>
                )}
                
                <div className="form-group">
                  <label className="form-label">금액 (원)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    placeholder="0"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">납부기한</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.due_date}
                    onChange={e => setFormData({...formData, due_date: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">메모 (선택)</label>
                  <input
                    className="form-input"
                    value={formData.memo}
                    onChange={e => setFormData({...formData, memo: e.target.value})}
                    placeholder="예: 전기요금 1월분, 신규 부지 취득 등"
                  />
                </div>
                
                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                    취소
                  </button>
                  <button type="submit" className="btn-primary">
                    추가
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
