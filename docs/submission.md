# 제출 체크리스트

- [ ] Node.js 22 이상인 깨끗한 환경에서 `npm ci`, `npm run check`, `npm start` 확인
- [ ] 문서의 설계 정책과 코드를 직접 읽고 설명할 수 있는지 확인
- [ ] 저장소에 node_modules, dist, data, 실제 개인정보, 비밀 키가 없는지 확인
- [ ] GitHub 저장소 업로드 및 채용 담당자가 접근할 수 있는지 확인
- [ ] 아래 메일 초안의 이름/저장소 링크를 실제 값으로 변경
- [ ] 과제 수신일 +4일 23:59:59까지 메일 발송 후 문자 안내

## 저장소 업로드 예시

GitHub에서 빈 저장소를 만든 다음 프로젝트 루트에서 실행합니다. `YOUR_ACCOUNT`를 본인 계정으로 바꾸세요.

```bash
git init
git add .
git commit -m "feat: implement study room reservation MVP"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/study-room.git
git push -u origin main
```

## 제출 메일 초안

받는 사람: kitoram3@hiconsy.com

제목: 지정 주제 - {이름}

안녕하세요, 김병수 담당자님.

지정 주제 1 자습실 예약 관리 과제를 제출합니다.

- GitHub 저장소: {저장소 링크}
- 실행 방법: Node.js 22 이상에서 `npm ci` 후 `npm run dev`
- 구현 범위: 자습실/학생 관리, 방문 신청·변경·취소, 이력, 기존 신청 보호 정책
- README에 실행 방법, 기술 선택 이유, 아키텍처, 데이터 모델, 테스트와 개선점을 정리했습니다.

확인 부탁드립니다. 감사합니다.

{이름} 드림

## 문자 초안

수신: 01092445161

안녕하세요, 지정 주제 과제 지원자 {이름}입니다. 자습실 예약 관리 과제의 GitHub 저장소 링크를 메일로 제출했습니다. 확인 부탁드립니다. 감사합니다.

---

이 파일은 초안이며 실제 메일/문자를 전송하지 않습니다.
