import httpx
from typing import Dict, Any, List

ChatMessage = Dict[str, str]

class AIClient:
    def __init__(self, ai_server_url: str = "http://localhost:5000"):
        self.ai_server_url = ai_server_url
        self.timeout = 30.0
    
    async def generate_reply(self, history: List[ChatMessage]) -> Dict[str, Any]:
        payload = {"messages": history}
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.ai_server_url}/api/chat/reply",
                    json=payload,
                    timeout=self.timeout,
                )
                if response.status_code == 200:
                    return response.json()
            except Exception:
                pass
        return self._fallback_reply(history)

    async def extract_profile(self, history: List[ChatMessage]) -> Dict[str, Any]:
        payload = {"messages": history}
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.ai_server_url}/api/profile/extract",
                    json=payload,
                    timeout=self.timeout,
                )
                if response.status_code == 200:
                    return response.json()
            except Exception:
                pass
        return self._fallback_profile(history)

    async def analyze_match(self, profile_data: Dict[str, Any], job_data: Dict[str, Any]) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.ai_server_url}/api/match",
                    json={"profile": profile_data, "job": job_data},
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    return self._fallback_matching()
            except:
                return self._fallback_matching()
    
    def _fallback_reply(self, history: List[ChatMessage]) -> Dict[str, Any]:
        last_user_message = next(
            (msg["content"] for msg in reversed(history) if msg.get("role") == "user"),
            "안녕하세요!",
        )
        acknowledgement = "알려주셔서 감사합니다." if len(last_user_message) < 120 else "정말 자세한 설명이네요!"
        follow_up = "다음으로 강조하고 싶은 경험이나 프로젝트가 있나요?"
        return {
            "role": "assistant",
            "content": f"{acknowledgement} 말씀해 주신 내용을 정리해 보고 있어요. {follow_up}",
            "suggested_topics": [
                "핵심 기술 스택",
                "주요 성과",
                "관심 있는 산업/기업 문화"
            ],
        }

    def _fallback_profile(self, history: List[ChatMessage]) -> Dict[str, Any]:
        user_texts = [msg["content"] for msg in history if msg.get("role") == "user"]
        combined = " ".join(user_texts).strip()
        headline = "열정적인 지원자"
        if "디자" in combined:
            headline = "크리에이티브 디자이너"
        elif "백엔드" in combined or "서버" in combined:
            headline = "백엔드 개발자"
        elif "데이터" in combined:
            headline = "데이터 분석가"

        summary = combined[:280] + ("..." if len(combined) > 280 else "")
        default_strengths = ["학습 의지가 뛰어남", "팀 커뮤니케이션 능력"]
        strengths = default_strengths if not combined else default_strengths + ["실제 대화를 기반으로 요약"]
        improvements = ["구체적인 수치 기반 성과를 더 공유", "희망 근무 형태를 명확히 전달"]

        return {
            "headline": headline,
            "summary": summary or "아직 정보가 충분하지 않습니다.",
            "strengths": strengths,
            "improvements": improvements,
            "skills": {"keywords": []},
            "experiences": {"highlights": []},
            "preferences": {"roles": [], "locations": [], "work_style": None},
        }

    def _fallback_matching(self) -> Dict[str, Any]:
        return {
            "match_score": 70.0,
            "tech_match_score": 70.0,
            "experience_match_score": 70.0,
            "personality_match_score": 70.0,
            "analysis": {
                "overall_summary": "AI 서버 대기 중",
                "strengths": ["기술 스택 분석 중", "경력 분석 중"],
                "improvements": []
            }
        }