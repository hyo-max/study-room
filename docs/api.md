# API

기본 경로: `http://127.0.0.1:3000/api`.

데모 요청 헤더:

```http
x-role: teacher
```

```http
x-role: student
x-student-id: 1
```

실제 인증 토큰이 아닙니다. 로그인 생략 조건에 맞춘 화면 선택용 신원입니다.

| Method | Path              | 역할      | 설명                                      |
| ------ | ----------------- | --------- | ----------------------------------------- |
| GET    | /health           | 없음      | 상태 확인                                 |
| GET    | /rooms            | 강사/학생 | 미삭제 자습실과 활성 인원                 |
| POST   | /rooms            | 강사      | 등록                                      |
| GET    | /rooms/:id        | 강사/학생 | 상세. 이력/학생별 신청은 강사에게만 제공  |
| PATCH  | /rooms/:id        | 강사      | 전체 편집 필드 제출                       |
| DELETE | /rooms/:id        | 강사      | Soft Delete + 활성 신청 자동 취소         |
| GET    | /students         | 강사/학생 | 미삭제 학생. 학생 역할 선택에 사용        |
| POST   | /students         | 강사      | 학생 등록                                 |
| PATCH  | /students/:id     | 강사      | 이름/전화번호 수정                        |
| DELETE | /students/:id     | 강사      | 활성 신청이 없는 학생 Soft Delete         |
| POST   | /rooms/:id/visits | 학생      | 신청/취소 후 재신청                       |
| GET    | /visits/mine      | 학생      | 본인 신청과 취소 상태, 삭제된 자습실 정보 |
| PATCH  | /visits/:id       | 학생      | 본인 방문 시각 수정                       |
| DELETE | /visits/:id       | 학생      | 본인 신청 취소                            |

### 자습실 생성·수정 body

```json
{
  "name": "몰입의 공간",
  "maxPersonnel": 12,
  "startDate": "2026-12-01T09:00:00+09:00",
  "endDate": "2026-12-01T21:00:00+09:00"
}
```

수정은 name, maxPersonnel, startDate, endDate 전체를 제출합니다.

### 신청·시간 수정 body

```json
{ "visitAt": "2026-12-01T13:30:00+09:00" }
```

### 학생 생성·수정 body

```json
{ "name": "홍길동", "phone": "010-1234-5678" }
```

### 예시

```bash
curl http://127.0.0.1:3000/api/rooms -H 'x-role: teacher'

curl -X POST http://127.0.0.1:3000/api/rooms \
  -H 'Content-Type: application/json' -H 'x-role: teacher' \
  -d '{"name":"테스트","maxPersonnel":2,"startDate":"2026-12-01T09:00:00+09:00","endDate":"2026-12-01T21:00:00+09:00"}'
```

정상 GET/PATCH/DELETE는 200, POST는 201을 반환합니다. 오류 응답은 Nest 기본 형식입니다.

```json
{ "message": "정원이 가득 찼습니다.", "error": "Conflict", "statusCode": 409 }
```
