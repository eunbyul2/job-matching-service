import React, { useState, useEffect, useCallback } from "react";
import "./MatchResults.css";

interface Match {
  match_id: number;
  job_id: number;
  company: string;
  title: string;
  position: string;
  location: string;
  experience: string;
  tech_stacks: string[];
  salary: string;
  deadline: string;
  match_score: number;
  score_breakdown: {
    tech: number;
    experience: number;
    personality: number;
  };
  analysis: {
    summary: string;
    strengths: string[];
    improvements: string[];
  };
}

interface MatchResultsProps {
  resumeId: number;
}

export default function MatchResults({ resumeId }: MatchResultsProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/resumes/${resumeId}/matches`
      );
      const data = await res.json();
      setMatches(data.matches);
    } catch (error) {
      console.error("매칭 결과 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => {
    if (!resumeId) return;
    setSelectedMatch(null);
    fetchMatches();
  }, [fetchMatches, resumeId]);

  const toggleBookmark = async (matchId: number) => {
    await fetch(`http://localhost:8000/api/matches/${matchId}/bookmark`, {
      method: "POST",
    });
    alert("북마크 토글");
  };

  const applyJob = async (matchId: number) => {
    if (!window.confirm("이 공고에 지원하시겠습니까?")) return;
    await fetch(`http://localhost:8000/api/matches/${matchId}/apply`, {
      method: "POST",
    });
    alert("지원 완료!");
  };

  if (loading) {
    return <div className="loading">매칭 결과 로딩 중...</div>;
  }

  if (matches.length === 0) {
    return <div className="no-results">매칭된 공고가 없습니다.</div>;
  }

  return (
    <div className="match-results">
      <div className="results-header">
        <h2>🎯 맞춤 채용 공고 ({matches.length}개)</h2>
        <p>AI가 분석한 귀하와 가장 잘 맞는 채용 공고입니다</p>
      </div>

      <div className="results-list">
        {matches.map((match) => (
          <div key={match.match_id} className="match-card">
            <div className="match-header">
              <div className="match-title">
                <h3>{match.company}</h3>
                <p>{match.title}</p>
              </div>
              <div className="match-score">
                <div
                  className="score-circle"
                  style={{
                    background: `conic-gradient(#4CAF50 ${
                      match.match_score * 3.6
                    }deg, #eee 0deg)`,
                  }}
                >
                  <span>{Math.round(match.match_score)}%</span>
                </div>
              </div>
            </div>

            <div className="match-info">
              <span className="badge">{match.position}</span>
              <span>{match.location}</span>
              <span>{match.experience}</span>
              <span>{match.salary}</span>
            </div>

            <div className="tech-stacks">
              {match.tech_stacks.map((tech, i) => (
                <span key={i} className="tech-tag">
                  {tech}
                </span>
              ))}
            </div>

            <div className="match-analysis">
              <h4>🎯 매칭 분석</h4>
              <p className="summary">{match.analysis.summary}</p>

              <div className="score-breakdown">
                <div className="score-bar">
                  <label>기술 스택</label>
                  <div className="bar">
                    <div
                      className="fill"
                      style={{ width: `${match.score_breakdown.tech}%` }}
                    ></div>
                  </div>
                  <span>{Math.round(match.score_breakdown.tech)}%</span>
                </div>
                <div className="score-bar">
                  <label>경력</label>
                  <div className="bar">
                    <div
                      className="fill"
                      style={{ width: `${match.score_breakdown.experience}%` }}
                    ></div>
                  </div>
                  <span>{Math.round(match.score_breakdown.experience)}%</span>
                </div>
                <div className="score-bar">
                  <label>성격/역량</label>
                  <div className="bar">
                    <div
                      className="fill"
                      style={{ width: `${match.score_breakdown.personality}%` }}
                    ></div>
                  </div>
                  <span>{Math.round(match.score_breakdown.personality)}%</span>
                </div>
              </div>

              <div className="strengths">
                <h5>✅ 강점</h5>
                <ul>
                  {match.analysis.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              {match.analysis.improvements.length > 0 && (
                <div className="improvements">
                  <h5>💡 개선하면 더 좋은 점</h5>
                  <ul>
                    {match.analysis.improvements.map((imp, i) => (
                      <li key={i}>{imp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="match-actions">
              <button
                className="btn-detail"
                onClick={() => setSelectedMatch(match)}
              >
                상세 분석
              </button>
              <button
                className="btn-apply"
                onClick={() => applyJob(match.match_id)}
              >
                지원하기
              </button>
              <button
                className="btn-bookmark"
                onClick={() => toggleBookmark(match.match_id)}
              >
                ⭐ 북마크
              </button>
            </div>

            {match.deadline && (
              <div className="deadline">
                마감일: {new Date(match.deadline).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedMatch && (
        <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>매칭 상세 분석</h3>
              <button onClick={() => setSelectedMatch(null)}>✕</button>
            </div>
            <div className="modal-content">
              <div className="overall-score">
                <div className="score-large">
                  {Math.round(selectedMatch.match_score)}%
                </div>
                <p>매칭률</p>
              </div>
              <p className="summary">{selectedMatch.analysis.summary}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
