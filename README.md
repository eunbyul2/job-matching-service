# 구직·채용 매칭 서비스

대화형으로 지원자의 경험을 수집하고 AI가 요약/매칭을 수행하는 채용 추천 서비스입니다.

## Directory Layout

```
apps/
	backend/        # FastAPI 서비스
	frontend/       # React(Vite) 웹 앱
data/
	schema/         # PostgreSQL 스키마 및 Seed SQL
infra/
	database/       # RDS (PostgreSQL) 관련 IaC/운영 문서
	storage/        # MinIO/Ceph 오브젝트 스토리지 설정 자료
```

## Setup (Local Dev)

- Python 3.11 (권장)
- [uv](https://docs.astral.sh/uv/)로 가상환경 및 패키지 관리 권장 (선택)

### 1. PostgreSQL

```bash
createdb job_matching
psql job_matching < data/schema/database_schema.sql
cd apps/backend
python insert_dummy_data.py  # optional seed
```

### 2. Backend

#### uv 사용

```bash
cd apps/backend
uv venv --python 3.11
source .venv/bin/activate
uv pip install -r requirements.txt
uv run python main.py
```

### 3. Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

### 4. Endpoints

- Web App: http://localhost:5173
- API: http://localhost:8000

## Production Notes

- **Database**: Amazon RDS for PostgreSQL (prod/stage/dev 분리 권장). 스키마는 `data/schema/` 기준으로 관리합니다.
- **Object Storage**: MinIO/Ceph에 채용 공고 원문, 사용자 업로드 자료, 장기 백업을 저장합니다.
- **CI/CD & Infra**: `infra/` 디렉터리에 Terraform/Helm 등 IaC 정의와 운영 문서를 추가해 관리하세요.

## AI 연동

LLM 엔진은 `AI_SERVER_URL` 환경변수로 연결됩니다. 기본값은 `http://localhost:5000`이며 `apps/backend/ai_client.py`에서 호출합니다.
