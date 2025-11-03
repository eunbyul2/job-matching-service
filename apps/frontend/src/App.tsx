import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
} from "react";
import "./App.css";

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  id: number;
  role: Role;
  content: string;
  createdAt: string;
}

interface RawChatMessage {
  id: number;
  role: Role;
  content: string;
  created_at?: string;
  createdAt?: string;
}

interface CandidateProfile {
  headline?: string;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  lastGeneratedAt?: string | null;
  skills?: Record<string, unknown>;
  experiences?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

interface ChatSessionResponse {
  session_id: number;
  messages: RawChatMessage[];
  profile?: any;
}

interface MatchResult {
  matchId: number;
  jobId: number;
  company: string;
  title: string;
  position: string;
  location: string;
  matchScore: number;
  scoreBreakdown: {
    tech: number;
    experience: number;
    personality: number;
  };
  analysis: {
    summary?: string | null;
    strengths?: string[];
    improvements?: string[];
  };
  techStacks?: string[];
  salary?: string | null;
  deadline?: string | null;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  prompt: string;
  mode: "send" | "prefill";
  preserveInput?: boolean;
}

const API_BASE = process.env.REACT_APP_API_URL ?? "http://localhost:8000";

const normalizeMessage = (raw: RawChatMessage): ChatMessage => {
  const createdAt = raw.created_at ?? raw.createdAt ?? new Date().toISOString();
  return {
    id: raw.id,
    role: raw.role,
    content: raw.content,
    createdAt: new Date(createdAt).toISOString(),
  };
};

const normalizeProfile = (raw: any): CandidateProfile | null => {
  if (!raw) {
    return null;
  }

  const toObject = (value: any): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  };

  return {
    headline: raw.headline ?? undefined,
    summary: raw.summary ?? undefined,
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
    lastGeneratedAt: raw.last_generated_at ?? raw.lastGeneratedAt ?? null,
    skills: toObject(raw.skills),
    experiences: toObject(raw.experiences),
    preferences: toObject(raw.preferences),
  };
};

function App() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [hasFetchedMatches, setHasFetchedMatches] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        id: "experience-template",
        label: "경험 정리 템플릿",
        description: "프로젝트를 STAR 구조로 정리할 수 있게 안내해 드려요.",
        icon: "📝",
        prompt:
          "아래 템플릿 형식에 맞춰 내 대표 경험을 정리할 수 있도록 질문해 줘.\n- 상황(Situation):\n- 과제(Task):\n- 실행(Action):\n- 결과(Result):",
        mode: "prefill",
      },
      {
        id: "mock-interview",
        label: "면접 질문 연습",
        description: "지원 직무 기준 예상 질문과 답변 피드백을 받아요.",
        icon: "🎤",
        prompt:
          "내가 지원하려는 직무에 맞춘 심층 면접 질문 3가지를 제시하고, 각 질문에 어떻게 답변하면 좋을지 핵심 포인트를 안내해 줘.",
        mode: "send",
        preserveInput: true,
      },
    ],
    []
  );

  const moreActions = useMemo<QuickAction[]>(
    () => [
      {
        id: "resume-review",
        label: "이력서 첨삭 요청",
        description: "이력서 문장을 붙여 넣으면 개선 방향을 제안해 줘요.",
        icon: "📄",
        prompt:
          "다음에 붙여 넣을 이력서 단락을 읽고, 문장 다듬기와 강조할 포인트를 제안해 줘.",
        mode: "prefill",
      },
      {
        id: "follow-up",
        label: "후속 메일 작성",
        description: "면접 이후 보낼 감사 메일 초안을 만들어 줘요.",
        icon: "✉️",
        prompt:
          "면접 이후 보낼 감사 메일을 작성할 수 있게, 기본 구조와 예시 문장을 제안해 줘.",
        mode: "send",
        preserveInput: true,
      },
      {
        id: "learning-plan",
        label: "학습 계획 짜기",
        description: "부족한 역량을 보완할 학습 로드맵을 추천해 줘요.",
        icon: "🧭",
        prompt:
          "내가 부족한 역량을 보강할 수 있도록 4주 학습 계획을 주차별로 제안해 줘.",
        mode: "send",
        preserveInput: true,
      },
    ],
    []
  );

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, messages, loading]);

  useEffect(() => {
    if (!initializing) {
      textareaRef.current?.focus();
    }
  }, [initializing]);

  useEffect(() => {
    if (!moreMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreMenuRef.current &&
        event.target instanceof Node &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setMoreMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [moreMenuOpen]);

  const loadMatches = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!sessionId) {
        return;
      }

      setMatchesLoading(true);
      setMatchesError(null);

      try {
        const url = new URL(
          `${API_BASE}/api/chat/sessions/${sessionId}/matches`
        );
        if (options?.refresh) {
          url.searchParams.set("refresh", "true");
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error("Failed to load matches");
        }

        const data = await response.json();
        const items: MatchResult[] = (data.matches ?? []).map((item: any) => ({
          matchId: item.match_id,
          jobId: item.job_id,
          company: item.company,
          title: item.title,
          position: item.position,
          location: item.location,
          matchScore: Number(item.match_score ?? 0),
          scoreBreakdown: {
            tech: Number(item.score_breakdown?.tech ?? 0),
            experience: Number(item.score_breakdown?.experience ?? 0),
            personality: Number(item.score_breakdown?.personality ?? 0),
          },
          analysis: {
            summary: item.analysis?.summary ?? null,
            strengths: Array.isArray(item.analysis?.strengths)
              ? item.analysis?.strengths
              : [],
            improvements: Array.isArray(item.analysis?.improvements)
              ? item.analysis?.improvements
              : [],
          },
          techStacks: Array.isArray(item.tech_stacks) ? item.tech_stacks : [],
          salary: item.salary ?? item.salary_text ?? null,
          deadline: item.deadline ?? null,
        }));

        setMatches(items);
      } catch (err) {
        console.error(err);
        setMatchesError(
          "추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        );
      } finally {
        setMatchesLoading(false);
        setHasFetchedMatches(true);
      }
    },
    [sessionId]
  );

  const createSession = useCallback(async () => {
    setInitializing(true);
    setLoading(false);
    setError(null);
    setMessages([]);
    setProfile(null);
    setMoreMenuOpen(false);
    setDetailsOpen(false);
    setMatches([]);
    setMatchesError(null);
    setMatchesLoading(false);
    setHasFetchedMatches(false);

    try {
      const response = await fetch(`${API_BASE}/api/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data: ChatSessionResponse = await response.json();
      setSessionId(data.session_id);

      const visibleMessages = (data.messages ?? [])
        .filter((msg) => msg.role !== "system")
        .map(normalizeMessage);

      setMessages(visibleMessages);
      setProfile(normalizeProfile(data.profile));
    } catch (err) {
      console.error(err);
      setSessionId(null);
      setError("대화를 시작하지 못했습니다. 서버 상태를 확인해 주세요.");
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    createSession();
  }, [createSession]);

  useEffect(() => {
    if (detailsOpen && sessionId && !hasFetchedMatches) {
      loadMatches();
    }
  }, [detailsOpen, sessionId, hasFetchedMatches, loadMatches]);

  const sendMessage = useCallback(
    async (
      content: string,
      options?: { preserveInput?: boolean; restoreValue?: string }
    ) => {
      const trimmed = content.trim();
      if (!sessionId || !trimmed || loading) {
        return;
      }

      setError(null);
      const tempId = Date.now();
      const optimisticMessage: ChatMessage = {
        id: tempId,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      const shouldClearInput = !options?.preserveInput;
      if (shouldClearInput) {
        setInput("");
      }

      setLoading(true);
      textareaRef.current?.focus();

      try {
        const response = await fetch(
          `${API_BASE}/api/chat/sessions/${sessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: trimmed }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const data = await response.json();
        const userMessage = normalizeMessage(data.user_message);
        const assistantMessage = normalizeMessage(data.assistant_message);

        setMessages((prev) => {
          const replaced = prev.map((msg) =>
            msg.id === tempId ? userMessage : msg
          );
          return [...replaced, assistantMessage];
        });

        setProfile(normalizeProfile(data.profile));
        setHasFetchedMatches(false);
        if (detailsOpen) {
          setMatches([]);
        }
      } catch (err) {
        console.error(err);
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        if (shouldClearInput) {
          setInput(options?.restoreValue ?? trimmed);
        }
        setError("메시지를 전송하지 못했습니다. 다시 시도해 주세요.");
      } finally {
        setLoading(false);
        textareaRef.current?.focus();
      }
    },
    [sessionId, loading, detailsOpen]
  );

  const handleSend = useCallback(() => {
    const current = input;
    sendMessage(current, { preserveInput: false, restoreValue: current });
  }, [input, sendMessage]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const triggerAction = useCallback(
    (action: QuickAction) => {
      if (action.mode === "send") {
        sendMessage(action.prompt, {
          preserveInput: action.preserveInput ?? false,
          restoreValue: action.preserveInput ? input : action.prompt,
        });
      } else {
        setInput(action.prompt);
        textareaRef.current?.focus();
      }
    },
    [input, sendMessage]
  );
  const handleMoreAction = useCallback(
    (action: QuickAction) => {
      setMoreMenuOpen(false);
      triggerAction(action);
    },
    [triggerAction]
  );

  const handleToggleDetails = () => {
    const nextState = !detailsOpen;
    setDetailsOpen(nextState);
    if (nextState && !hasFetchedMatches) {
      loadMatches();
    }
  };

  const handleRefreshMatches = () => {
    loadMatches({ refresh: true });
  };

  const formatScore = (score: number) => {
    if (!Number.isFinite(score)) {
      return "-";
    }
    return score > 1 ? `${Math.round(score)}%` : `${Math.round(score * 100)}%`;
  };

  const formatLabel = (label: string) => label.replace(/_/g, " ");

  const formatDetailValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join(", ");
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const renderObjectEntries = (
    data?: Record<string, unknown>,
    heading?: string
  ) => {
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return (
      <div className="detail-subsection">
        {heading && <h4>{heading}</h4>}
        <ul>
          {Object.entries(data).map(([key, value]) => (
            <li key={key}>
              <span className="detail-term">{formatLabel(key)}</span>
              <span className="detail-value">{formatDetailValue(value)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="chat-app">
      <header className="chat-header">
        <div>
          <h1>AI 채용 매칭 코치</h1>
          <p>대화하면서 경험을 정리하고 맞춤 공고를 추천받아 보세요.</p>
        </div>
        <button
          type="button"
          className="new-chat-button"
          onClick={createSession}
          disabled={initializing || loading}
        >
          새 대화 시작
        </button>
      </header>

      <main className="chat-main">
        <section className="chat-pane">
          <div ref={messagesContainerRef} className="messages-container">
            {initializing && (
              <div className="system-message">새 대화를 준비하고 있어요...</div>
            )}

            {!initializing &&
              messages.map((message) => (
                <div key={message.id} className={`message-row ${message.role}`}>
                  <div className="message-bubble">
                    {message.role === "assistant" && (
                      <span className="avatar">🤖</span>
                    )}
                    <div className="message-content">
                      <p>{message.content}</p>
                      <span className="timestamp">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

            {!initializing && loading && (
              <div className="message-row assistant">
                <div className="message-bubble typing">
                  <span className="avatar">🤖</span>
                  <div className="message-content">
                    <p>AI가 응답을 작성 중입니다...</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="input-area">
            <div className="composer-toolbar">
              <div className="composer-tools" ref={moreMenuRef}>
                <button
                  type="button"
                  className={`more-button ${moreMenuOpen ? "active" : ""}`}
                  onClick={() => setMoreMenuOpen((prev) => !prev)}
                  disabled={initializing || loading}
                  aria-label="추가 기능 열기"
                >
                  +
                </button>
                <div className="quick-actions" role="list">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="quick-action"
                      onClick={() => triggerAction(action)}
                      disabled={initializing || loading}
                    >
                      <span className="quick-action-icon" aria-hidden="true">
                        {action.icon}
                      </span>
                      <span className="quick-action-label">{action.label}</span>
                    </button>
                  ))}
                </div>
                {moreMenuOpen && (
                  <div className="more-menu" role="menu">
                    <ul>
                      {moreActions.map((action) => (
                        <li key={action.id}>
                          <button
                            type="button"
                            onClick={() => handleMoreAction(action)}
                            disabled={initializing || loading}
                          >
                            <span
                              className="more-action-icon"
                              aria-hidden="true"
                            >
                              {action.icon}
                            </span>
                            <span className="more-action-copy">
                              <span className="more-action-label">
                                {action.label}
                              </span>
                              <span className="more-action-description">
                                {action.description}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {error && <div className="error-banner">{error}</div>}
            <textarea
              ref={textareaRef}
              placeholder="자신의 경험이나 궁금한 점을 자유롭게 적어 주세요. (Shift+Enter: 줄바꿈)"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={initializing}
            />
            <div className="input-actions">
              <span className="hint">Shift + Enter로 줄바꿈</span>
              <button
                type="button"
                onClick={handleSend}
                disabled={initializing || loading || !input.trim()}
              >
                전송
              </button>
            </div>
          </div>
        </section>

        <aside className={`profile-pane ${profile ? "visible" : ""}`}>
          {profile ? (
            <>
              <div className="profile-header">
                <h2>AI 요약</h2>
                <button
                  type="button"
                  className="detail-toggle"
                  onClick={handleToggleDetails}
                  disabled={initializing && !profile.summary}
                >
                  {detailsOpen ? "상세 닫기" : "상세 보기"}
                </button>
              </div>

              {profile.headline && (
                <p className="headline">{profile.headline}</p>
              )}
              {profile.summary && <p className="summary">{profile.summary}</p>}

              {profile.strengths && profile.strengths.length > 0 && (
                <div className="list-block">
                  <h3>강점</h3>
                  <ul>
                    {profile.strengths.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.improvements && profile.improvements.length > 0 && (
                <div className="list-block">
                  <h3>보완 포인트</h3>
                  <ul>
                    {profile.improvements.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.lastGeneratedAt && (
                <p className="timestamp-note">
                  마지막 업데이트:{" "}
                  {new Date(profile.lastGeneratedAt).toLocaleString("ko-KR")}
                </p>
              )}

              {detailsOpen && (
                <div className="profile-details">
                  <div className="detail-section">
                    <h3>분석 근거</h3>
                    {(() => {
                      const blocks = [
                        renderObjectEntries(profile.skills, "핵심 스킬"),
                        renderObjectEntries(profile.experiences, "주요 경험"),
                        renderObjectEntries(profile.preferences, "선호 조건"),
                      ].filter(Boolean) as React.ReactNode[];

                      if (blocks.length > 0) {
                        return blocks;
                      }

                      return (
                        <p className="detail-hint">
                          아직 분석 근거를 정리하는 중이에요. 조금 더 경험을
                          들려주시면 더 정확한 요약을 제공할게요.
                        </p>
                      );
                    })()}
                  </div>

                  <div className="detail-section">
                    <div className="detail-header">
                      <h3>추천 직무·공고</h3>
                      <button
                        type="button"
                        className="refresh-button"
                        onClick={handleRefreshMatches}
                        disabled={matchesLoading || !sessionId}
                      >
                        {matchesLoading ? "새로고침 중..." : "새로 고침"}
                      </button>
                    </div>

                    {matchesLoading && matches.length === 0 && (
                      <p className="detail-hint">추천을 준비하고 있어요...</p>
                    )}

                    {matchesError && !matchesLoading && (
                      <p className="detail-error">{matchesError}</p>
                    )}

                    {!matchesLoading &&
                      !matchesError &&
                      matches.length === 0 && (
                        <p className="detail-hint">
                          아직 추천을 만들 만큼 정보가 충분하지 않아요. 경험을
                          조금 더 들려주세요!
                        </p>
                      )}

                    {matches.length > 0 && (
                      <ul className="match-list">
                        {matches.map((match) => (
                          <li key={match.matchId} className="match-card">
                            <div className="match-header">
                              <div className="match-meta">
                                <p className="match-title">
                                  {match.title || match.position || "추천 직무"}
                                </p>
                                <p className="match-company">
                                  {[match.company, match.location]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </p>
                              </div>
                              <span className="match-score">
                                {formatScore(match.matchScore)}
                              </span>
                            </div>

                            {match.analysis.summary && (
                              <p className="match-summary">
                                {match.analysis.summary}
                              </p>
                            )}

                            {match.techStacks &&
                              match.techStacks.length > 0 && (
                                <div className="match-tags">
                                  {match.techStacks.slice(0, 6).map((stack) => (
                                    <span key={`${match.matchId}-${stack}`}>
                                      {stack}
                                    </span>
                                  ))}
                                </div>
                              )}

                            <div className="match-breakdown">
                              <span>
                                기술 {formatScore(match.scoreBreakdown.tech)}
                              </span>
                              <span>
                                경험{" "}
                                {formatScore(match.scoreBreakdown.experience)}
                              </span>
                              <span>
                                인성{" "}
                                {formatScore(match.scoreBreakdown.personality)}
                              </span>
                            </div>

                            {match.analysis.strengths &&
                              match.analysis.strengths.length > 0 && (
                                <ul className="match-strengths">
                                  {match.analysis.strengths.map(
                                    (item, index) => (
                                      <li
                                        key={`${match.matchId}-strength-${index}`}
                                      >
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              )}

                            {match.analysis.improvements &&
                              match.analysis.improvements.length > 0 && (
                                <ul className="match-improvements">
                                  {match.analysis.improvements.map(
                                    (item, index) => (
                                      <li
                                        key={`${match.matchId}-improvement-${index}`}
                                      >
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="profile-placeholder">
              <h2>AI 요약</h2>
              <p>대화를 시작하면 요약과 강점을 여기에 정리해 드릴게요.</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
