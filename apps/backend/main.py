import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import asyncpg
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_client import AIClient


AI_SERVER_URL = os.getenv("AI_SERVER_URL", "http://localhost:5000")
DATABASE_CONFIG = {
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "password"),
    "database": os.getenv("DB_NAME", "job_matching"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
}


app = FastAPI(title="AI Job Matching API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_client = AIClient(ai_server_url=AI_SERVER_URL)


class CreateSessionRequest(BaseModel):
    user_id: Optional[int] = None
    title: Optional[str] = None


class ChatMessagePayload(BaseModel):
    content: str = Field(..., min_length=1)


class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    created_at: datetime


class ChatSessionResponse(BaseModel):
    session_id: int
    title: str
    created_at: datetime
    messages: List[ChatMessageResponse]
    profile: Optional[Dict[str, Any]] = None


SYSTEM_PROMPT = (
    "당신은 경력 코치이자 채용 매칭 전문가입니다. "
    "사용자의 경험, 기술, 가치관을 자유로운 대화로 탐색하고 정리하세요. "
    "질문은 친근하게, 필요 시 구체적인 사례와 수치를 요청하며, 마지막에는 요약을 제공하세요."
)


def _row_to_message(row: asyncpg.Record) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=row["id"],
        session_id=row["session_id"],
        role=row["role"],
        content=row["content"],
        created_at=row["created_at"],
    )


async def _ensure_session(conn: asyncpg.Connection, session_id: int) -> asyncpg.Record:
    session = await conn.fetchrow("SELECT * FROM chat_sessions WHERE id = $1", session_id)
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "채팅 세션을 찾을 수 없습니다.")
    return session


async def _fetch_history(conn: asyncpg.Connection, session_id: int) -> List[Dict[str, str]]:
    rows = await conn.fetch(
        "SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC",
        session_id,
    )
    return [{"role": row["role"], "content": row["content"]} for row in rows]


async def _store_profile(conn: asyncpg.Connection, session_id: int, profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not profile:
        return None

    strengths = profile.get("strengths") or []
    if isinstance(strengths, str):
        strengths = [strengths]

    improvements = profile.get("improvements") or []
    if isinstance(improvements, str):
        improvements = [improvements]

    skills_json = json.dumps(profile.get("skills") or {})
    experiences_json = json.dumps(profile.get("experiences") or {})
    preferences_json = json.dumps(profile.get("preferences") or {})

    await conn.execute(
        """
        INSERT INTO candidate_profiles
            (session_id, headline, summary, strengths, improvements, skills, experiences, preferences,
             last_generated_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (session_id) DO UPDATE
        SET headline = EXCLUDED.headline,
            summary = EXCLUDED.summary,
            strengths = EXCLUDED.strengths,
            improvements = EXCLUDED.improvements,
            skills = EXCLUDED.skills,
            experiences = EXCLUDED.experiences,
            preferences = EXCLUDED.preferences,
            last_generated_at = NOW(),
            updated_at = NOW()
        """,
        session_id,
        profile.get("headline"),
        profile.get("summary"),
        strengths,
        improvements,
        skills_json,
        experiences_json,
        preferences_json,
    )

    await conn.execute(
        "UPDATE chat_sessions SET summary = $2, last_message_at = NOW(), updated_at = NOW() WHERE id = $1",
        session_id,
        profile.get("summary"),
    )

    return profile


def _profile_row_to_dict(row: Optional[asyncpg.Record]) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    def _load_json_field(value: Any) -> Dict[str, Any]:
        if not value:
            return {}
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return {}
        return value

    def _load_list_field(value: Any) -> List[str]:
        if not value:
            return []
        if isinstance(value, list):
            return [str(item) for item in value]
        return [str(value)]
    return {
        "headline": row["headline"],
        "summary": row["summary"],
        "strengths": _load_list_field(row["strengths"]),
        "improvements": _load_list_field(row["improvements"]),
        "skills": _load_json_field(row["skills"]),
        "experiences": _load_json_field(row["experiences"]),
        "preferences": _load_json_field(row["preferences"]),
        "last_generated_at": row["last_generated_at"].isoformat() if row["last_generated_at"] else None,
    }


async def get_db():
    conn = await asyncpg.connect(**DATABASE_CONFIG)
    try:
        yield conn
    finally:
        await conn.close()


@app.post("/api/chat/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    payload: CreateSessionRequest,
    conn: asyncpg.Connection = Depends(get_db),
):
    session = await conn.fetchrow(
        """
        INSERT INTO chat_sessions (user_id, title, status)
        VALUES ($1, $2, 'active')
        RETURNING id, title, created_at
        """,
        payload.user_id,
        payload.title or "AI 매칭 세션",
    )

    system_row = await conn.fetchrow(
        """
        INSERT INTO chat_messages (session_id, role, content)
        VALUES ($1, 'system', $2)
        RETURNING id, session_id, role, content, created_at
        """,
        session["id"],
        SYSTEM_PROMPT,
    )

    history = await _fetch_history(conn, session["id"])
    ai_reply = await ai_client.generate_reply(history)

    assistant_row = await conn.fetchrow(
        """
        INSERT INTO chat_messages (session_id, role, content, metadata)
        VALUES ($1, 'assistant', $2, $3)
        RETURNING id, session_id, role, content, created_at
        """,
        session["id"],
        ai_reply.get("content", "안녕하세요!"),
        json.dumps({"suggested_topics": ai_reply.get("suggested_topics", [])}),
    )

    await conn.execute(
        "UPDATE chat_sessions SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1",
        session["id"],
    )

    messages = [
        _row_to_message(system_row),
        _row_to_message(assistant_row),
    ]

    profile_row = await conn.fetchrow(
        "SELECT * FROM candidate_profiles WHERE session_id = $1",
        session["id"],
    )

    return ChatSessionResponse(
        session_id=session["id"],
        title=session["title"],
        created_at=session["created_at"],
        messages=messages,
        profile=_profile_row_to_dict(profile_row),
    )


@app.get("/api/chat/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_chat_messages(
    session_id: int,
    conn: asyncpg.Connection = Depends(get_db),
):
    await _ensure_session(conn, session_id)
    rows = await conn.fetch(
        "SELECT id, session_id, role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC",
        session_id,
    )
    return [_row_to_message(row) for row in rows]


@app.post("/api/chat/sessions/{session_id}/messages")
async def send_chat_message(
    session_id: int,
    payload: ChatMessagePayload,
    conn: asyncpg.Connection = Depends(get_db),
):
    await _ensure_session(conn, session_id)

    user_row = await conn.fetchrow(
        """
        INSERT INTO chat_messages (session_id, role, content)
        VALUES ($1, 'user', $2)
        RETURNING id, session_id, role, content, created_at
        """,
        session_id,
        payload.content,
    )

    history = await _fetch_history(conn, session_id)
    ai_reply = await ai_client.generate_reply(history)

    assistant_row = await conn.fetchrow(
        """
        INSERT INTO chat_messages (session_id, role, content, metadata)
        VALUES ($1, 'assistant', $2, $3)
        RETURNING id, session_id, role, content, created_at
        """,
        session_id,
        ai_reply.get("content", "공유해 주셔서 감사합니다!"),
        json.dumps({"suggested_topics": ai_reply.get("suggested_topics", [])}),
    )

    full_history = await _fetch_history(conn, session_id)
    profile_data = await ai_client.extract_profile(full_history)
    profile = await _store_profile(conn, session_id, profile_data)

    assistant_message = _row_to_message(assistant_row)

    return {
        "user_message": _row_to_message(user_row),
        "assistant_message": assistant_message.dict(),
        "profile": profile,
    }


@app.get("/api/chat/sessions/{session_id}/profile")
async def get_candidate_profile(
    session_id: int,
    conn: asyncpg.Connection = Depends(get_db),
):
    await _ensure_session(conn, session_id)
    profile_row = await conn.fetchrow(
        "SELECT * FROM candidate_profiles WHERE session_id = $1",
        session_id,
    )
    return {"profile": _profile_row_to_dict(profile_row)}


@app.get("/api/job-postings")
async def list_job_postings(
    position: Optional[str] = None,
    location: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    conn: asyncpg.Connection = Depends(get_db),
):
    query = "SELECT * FROM job_postings WHERE is_active = TRUE"
    params: List[Any] = []

    if position:
        params.append(position)
        query += f" AND position = ${len(params)}"

    if location:
        params.append(f"%{location}%")
        query += f" AND location ILIKE ${len(params)}"

    params.extend([limit, skip])
    query += f" ORDER BY posted_at DESC NULLS LAST LIMIT ${len(params) - 1} OFFSET ${len(params)}"

    rows = await conn.fetch(query, *params)
    return {"total": len(rows), "jobs": [dict(row) for row in rows]}


async def _ensure_profile(conn: asyncpg.Connection, session_id: int) -> Dict[str, Any]:
    profile_row = await conn.fetchrow(
        "SELECT * FROM candidate_profiles WHERE session_id = $1",
        session_id,
    )
    if profile_row:
        return _profile_row_to_dict(profile_row) or {}

    history = await _fetch_history(conn, session_id)
    profile_data = await ai_client.extract_profile(history)
    await _store_profile(conn, session_id, profile_data)
    refreshed = await conn.fetchrow(
        "SELECT * FROM candidate_profiles WHERE session_id = $1",
        session_id,
    )
    return _profile_row_to_dict(refreshed) or {}


@app.get("/api/chat/sessions/{session_id}/matches")
async def get_session_matches(
    session_id: int,
    refresh: bool = False,
    limit: int = 20,
    conn: asyncpg.Connection = Depends(get_db),
):
    await _ensure_session(conn, session_id)
    profile = await _ensure_profile(conn, session_id)

    if refresh or not await conn.fetchval(
        "SELECT 1 FROM job_matches WHERE session_id = $1",
        session_id,
    ):
        jobs = await conn.fetch(
            "SELECT * FROM job_postings WHERE is_active = TRUE ORDER BY posted_at DESC NULLS LAST LIMIT 50"
        )

        for job in jobs:
            ai_result = await ai_client.analyze_match(profile or {}, dict(job))
            analysis = ai_result.get("analysis") or {}

            await conn.execute(
                """
                INSERT INTO job_matches (
                    session_id, resume_id, job_posting_id, match_score, analysis,
                    tech_match_score, experience_match_score, personality_match_score, location_match_score,
                    created_at, updated_at
                )
                VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                ON CONFLICT (session_id, job_posting_id) DO UPDATE
                SET match_score = EXCLUDED.match_score,
                    analysis = EXCLUDED.analysis,
                    tech_match_score = EXCLUDED.tech_match_score,
                    experience_match_score = EXCLUDED.experience_match_score,
                    personality_match_score = EXCLUDED.personality_match_score,
                    location_match_score = EXCLUDED.location_match_score,
                    updated_at = NOW()
                """,
                session_id,
                job["id"],
                float(ai_result.get("match_score", 0.0)),
                json.dumps(analysis),
                ai_result.get("tech_match_score"),
                ai_result.get("experience_match_score"),
                ai_result.get("personality_match_score"),
                ai_result.get("location_match_score"),
            )

    matches = await conn.fetch(
        """
        SELECT jm.*, jp.company_name, jp.title, jp.position, jp.location, jp.experience_text,
               jp.tech_stacks, jp.salary_text, jp.deadline
        FROM job_matches jm
        JOIN job_postings jp ON jm.job_posting_id = jp.id
        WHERE jm.session_id = $1 AND jp.is_active = TRUE
        ORDER BY jm.match_score DESC
        LIMIT $2
        """,
        session_id,
        limit,
    )

    response = []
    for row in matches:
        analysis = row["analysis"] or {}
        response.append(
            {
                "match_id": row["id"],
                "job_id": row["job_posting_id"],
                "company": row["company_name"],
                "title": row["title"],
                "position": row["position"],
                "location": row["location"],
                "experience": row["experience_text"],
                "tech_stacks": row["tech_stacks"] or [],
                "salary": row["salary_text"],
                "deadline": row["deadline"].isoformat() if row["deadline"] else None,
                "match_score": float(row["match_score"]),
                "score_breakdown": {
                    "tech": float(row["tech_match_score"]) if row["tech_match_score"] else 0.0,
                    "experience": float(row["experience_match_score"]) if row["experience_match_score"] else 0.0,
                    "personality": float(row["personality_match_score"]) if row["personality_match_score"] else 0.0,
                },
                "analysis": {
                    "summary": analysis.get("overall_summary"),
                    "strengths": analysis.get("strengths", []),
                    "improvements": analysis.get("improvements", []),
                },
                "is_bookmarked": row["is_bookmarked"],
                "is_applied": row["is_applied"],
            }
        )

    return {"profile": profile, "total": len(response), "matches": response}


@app.post("/api/matches/{match_id}/bookmark")
async def toggle_match_bookmark(
    match_id: int,
    conn: asyncpg.Connection = Depends(get_db),
):
    current = await conn.fetchval(
        "SELECT is_bookmarked FROM job_matches WHERE id = $1",
        match_id,
    )
    if current is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "매칭 결과를 찾을 수 없습니다.")

    await conn.execute(
        "UPDATE job_matches SET is_bookmarked = $2, updated_at = NOW() WHERE id = $1",
        match_id,
        not current,
    )
    return {"is_bookmarked": not current}


@app.post("/api/matches/{match_id}/apply")
async def apply_to_match(
    match_id: int,
    conn: asyncpg.Connection = Depends(get_db),
):
    match = await conn.fetchrow(
        "SELECT session_id, resume_id, job_posting_id FROM job_matches WHERE id = $1",
        match_id,
    )
    if not match:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "매칭 결과를 찾을 수 없습니다.")

    await conn.execute(
        """
        INSERT INTO applications (resume_id, session_id, job_posting_id, match_id, status)
        VALUES ($1, $2, $3, $4, 'submitted')
        ON CONFLICT (session_id, job_posting_id) DO NOTHING
        """,
        match["resume_id"],
        match["session_id"],
        match["job_posting_id"],
        match_id,
    )

    await conn.execute(
        "UPDATE job_matches SET is_applied = TRUE, applied_at = NOW(), updated_at = NOW() WHERE id = $1",
        match_id,
    )

    return {"message": "지원 완료", "match_id": match_id}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
