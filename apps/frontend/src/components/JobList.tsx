import React, { useState, useEffect, useCallback } from "react";
import "./JobList.css";

interface Job {
  id: number;
  company_name: string;
  title: string;
  position: string;
  location: string;
  experience_text: string;
  tech_stacks: string[];
  salary_text: string;
  deadline: string;
  description: string;
}

export default function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ position: "", location: "" });
  const [query, setQuery] = useState({ position: "", location: "" });
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      let url = "http://localhost:8000/api/job-postings?limit=50";
      if (query.position) url += `&position=${query.position}`;
      if (query.location) url += `&location=${query.location}`;

      const res = await fetch(url);
      const data = await res.json();
      setJobs(data.jobs);
    } catch (error) {
      console.error("공고 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSearch = () => {
    setSelectedJob(null);
    setQuery(filters);
  };

  if (loading) {
    return <div className="loading">채용 공고 로딩 중...</div>;
  }

  return (
    <div className="job-list">
      <div className="list-header">
        <h2>📋 전체 채용 공고 ({jobs.length}개)</h2>

        <div className="filters">
          <select
            value={filters.position}
            onChange={(e) =>
              setFilters({ ...filters, position: e.target.value })
            }
          >
            <option value="">전체 직군</option>
            <option value="백엔드">백엔드</option>
            <option value="프론트엔드">프론트엔드</option>
            <option value="풀스택">풀스택</option>
            <option value="데이터엔지니어">데이터엔지니어</option>
            <option value="AI/ML">AI/ML</option>
          </select>

          <input
            type="text"
            placeholder="지역 검색"
            value={filters.location}
            onChange={(e) =>
              setFilters({ ...filters, location: e.target.value })
            }
          />

          <button onClick={handleSearch}>검색</button>
        </div>
      </div>

      <div className="jobs-grid">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="job-card"
            onClick={() => setSelectedJob(job)}
          >
            <div className="job-header">
              <h3>{job.company_name}</h3>
              <span className="position-badge">{job.position}</span>
            </div>

            <p className="job-title">{job.title}</p>

            <div className="job-info">
              <span>📍 {job.location}</span>
              <span>⏱️ {job.experience_text}</span>
              <span>💰 {job.salary_text}</span>
            </div>

            {job.tech_stacks && job.tech_stacks.length > 0 && (
              <div className="tech-tags">
                {job.tech_stacks.slice(0, 3).map((tech, i) => (
                  <span key={i} className="tech-tag">
                    {tech}
                  </span>
                ))}
                {job.tech_stacks.length > 3 && (
                  <span className="more">+{job.tech_stacks.length - 3}</span>
                )}
              </div>
            )}

            {job.deadline && (
              <div className="deadline">
                🕐 마감: {new Date(job.deadline).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedJob && (
        <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedJob.company_name}</h2>
                <p>{selectedJob.title}</p>
              </div>
              <button onClick={() => setSelectedJob(null)}>✕</button>
            </div>

            <div className="modal-content">
              <div className="job-details">
                <div className="detail-row">
                  <label>직군:</label>
                  <span>{selectedJob.position}</span>
                </div>
                <div className="detail-row">
                  <label>지역:</label>
                  <span>{selectedJob.location}</span>
                </div>
                <div className="detail-row">
                  <label>경력:</label>
                  <span>{selectedJob.experience_text}</span>
                </div>
                <div className="detail-row">
                  <label>급여:</label>
                  <span>{selectedJob.salary_text}</span>
                </div>
              </div>

              <div className="description-section">
                <h4>직무 설명</h4>
                <p>{selectedJob.description}</p>
              </div>

              <div className="modal-actions">
                <button className="btn-primary">지원하기</button>
                <button className="btn-secondary">북마크</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
