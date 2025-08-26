# EV 충전소 세금 관리 시스템

전기차 충전소 세금 납부 일정을 관리하는 시스템입니다.

## 시작하기

### 1. 설치
\`\`\`bash
npm install
\`\`\`

### 2. 환경변수 설정
`.env.local` 파일에 Supabase 정보를 입력하세요.

### 3. 개발 서버 실행
\`\`\`bash
npm run dev
\`\`\`

### 4. 빌드
\`\`\`bash
npm run build
\`\`\`

## 기능

- 세금 3단계 관리 (회계사검토 → 납부예정 → 납부완료)
- 취득세, 재산세, 기타세 구분
- D-Day 관리
- 반복 납부 설정

## 기술 스택

- Next.js 14
- TypeScript
- Supabase
- React 18