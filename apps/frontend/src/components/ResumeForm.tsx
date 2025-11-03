import React, { useState } from 'react';
import './ResumeForm.css';

type Tab = 'basic' | 'cover' | 'experience' | 'portfolio';

interface ResumeFormProps {
  onSubmitSuccess: (resumeId: number) => void;
}

export default function ResumeForm({ onSubmitSuccess }: ResumeFormProps) {
  const [tab, setTab] = useState<Tab>('basic');
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [basicInfo, setBasicInfo] = useState({ name: '', email: '', phone: '' });
  const [coverLetter, setCoverLetter] = useState({ self_introduction: '', motivation: '', strengths: '' });
  const [experiences, setExperiences] = useState<any[]>([]);
  const [newExp, setNewExp] = useState({ company_name: '', position: '', start_date: '', end_date: '', responsibilities: [''] });
  const [projects, setProjects] = useState<any[]>([]);
  const [newProject, setNewProject] = useState({ project_name: '', role: '', tech_stacks: [''], description: '' });

  const createResume = async () => {
    const res = await fetch('http://localhost:8000/api/resumes?user_id=1', { method: 'POST' });
    const data = await res.json();
    setResumeId(data.id);
    return data.id;
  };

  const saveBasicInfo = async () => {
    let rid = resumeId;
    if (!rid) rid = await createResume();
    await fetch(`http://localhost:8000/api/resumes/${rid}/basic-info`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basicInfo)
    });
    alert('기본정보 저장 완료');
    setTab('cover');
  };

  const saveCoverLetter = async () => {
    if (!resumeId) return;
    await fetch(`http://localhost:8000/api/resumes/${resumeId}/cover-letter`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coverLetter)
    });
    alert('자기소개서 저장 완료');
    setTab('experience');
  };

  const addExperience = async () => {
    if (!resumeId) return;
    await fetch(`http://localhost:8000/api/resumes/${resumeId}/experiences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExp)
    });
    setExperiences([...experiences, newExp]);
    setNewExp({ company_name: '', position: '', start_date: '', end_date: '', responsibilities: [''] });
  };

  const addProject = async () => {
    if (!resumeId) return;
    await fetch(`http://localhost:8000/api/resumes/${resumeId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    });
    setProjects([...projects, newProject]);
    setNewProject({ project_name: '', role: '', tech_stacks: [''], description: '' });
  };

  const submitResume = async () => {
    if (!resumeId) return;
    setLoading(true);
    try {
      await fetch(`http://localhost:8000/api/resumes/${resumeId}/submit`, { method: 'POST' });
      alert('지원서 제출 완료! AI 매칭 중...');
      onSubmitSuccess(resumeId);
    } catch (error) {
      alert('제출 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resume-form">
      <div className="form-header">
        <h2>구직 지원서 작성</h2>
        <div className="progress">총 작성량: 0자 | 약 0페이지</div>
      </div>

      <div className="form-tabs">
        <button className={tab === 'basic' ? 'active' : ''} onClick={() => setTab('basic')}>👤 기본정보</button>
        <button className={tab === 'cover' ? 'active' : ''} onClick={() => setTab('cover')}>📄 자기소개서</button>
        <button className={tab === 'experience' ? 'active' : ''} onClick={() => setTab('experience')}>💼 경력기술서</button>
        <button className={tab === 'portfolio' ? 'active' : ''} onClick={() => setTab('portfolio')}>💻 포트폴리오</button>
      </div>

      <div className="form-content">
        {tab === 'basic' && (
          <div className="form-section">
            <h3>기본정보</h3>
            <div className="form-group">
              <label>이름 *</label>
              <input type="text" value={basicInfo.name} onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })} placeholder="이름을 입력하세요" />
            </div>
            <div className="form-group">
              <label>이메일 *</label>
              <input type="email" value={basicInfo.email} onChange={(e) => setBasicInfo({ ...basicInfo, email: e.target.value })} placeholder="example@email.com" />
            </div>
            <div className="form-group">
              <label>연락처</label>
              <input type="tel" value={basicInfo.phone} onChange={(e) => setBasicInfo({ ...basicInfo, phone: e.target.value })} placeholder="010-0000-0000" />
            </div>
            <button className="btn-primary" onClick={saveBasicInfo}>저장하고 다음</button>
          </div>
        )}

        {tab === 'cover' && (
          <div className="form-section">
            <h3>자기소개 (0자)</h3>
            <p className="description">본인의 성장 과정, 성격, 가치관 등을 자유롭게 기술해주세요.</p>
            <textarea value={coverLetter.self_introduction} onChange={(e) => setCoverLetter({ ...coverLetter, self_introduction: e.target.value })} placeholder="저는 문제 해결을 즐기는 개발자입니다..." rows={8} />

            <h3>지원 동기 및 포부 (0자)</h3>
            <textarea value={coverLetter.motivation} onChange={(e) => setCoverLetter({ ...coverLetter, motivation: e.target.value })} placeholder="귀사의 혁신적인 기술과 비전에..." rows={8} />

            <h3>본인의 강점 및 역량 (0자)</h3>
            <textarea value={coverLetter.strengths} onChange={(e) => setCoverLetter({ ...coverLetter, strengths: e.target.value })} placeholder="저의 가장 큰 강점은..." rows={8} />

            <button className="btn-primary" onClick={saveCoverLetter}>저장하고 다음</button>
          </div>
        )}

        {tab === 'experience' && (
          <div className="form-section">
            <h3>경력 사항</h3>
            <div className="list">
              {experiences.map((exp, i) => (
                <div key={i} className="list-item">
                  <strong>{exp.company_name}</strong> - {exp.position}
                </div>
              ))}
            </div>
            <div className="form-group">
              <input type="text" value={newExp.company_name} onChange={(e) => setNewExp({ ...newExp, company_name: e.target.value })} placeholder="회사명" />
              <input type="text" value={newExp.position} onChange={(e) => setNewExp({ ...newExp, position: e.target.value })} placeholder="직무" />
              <button onClick={addExperience}>추가</button>
            </div>
            <button className="btn-primary" onClick={() => setTab('portfolio')}>다음</button>
          </div>
        )}

        {tab === 'portfolio' && (
          <div className="form-section">
            <h3>프로젝트 경험</h3>
            <div className="list">
              {projects.map((proj, i) => (
                <div key={i} className="list-item">
                  <strong>{proj.project_name}</strong> - {proj.role}
                </div>
              ))}
            </div>
            <div className="form-group">
              <input type="text" value={newProject.project_name} onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })} placeholder="프로젝트명" />
              <input type="text" value={newProject.role} onChange={(e) => setNewProject({ ...newProject, role: e.target.value })} placeholder="역할" />
              <textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="프로젝트 설명" rows={4} />
              <button onClick={addProject}>추가</button>
            </div>
            <button className="btn-submit" onClick={submitResume} disabled={loading}>
              {loading ? '매칭 중...' : '지원서 제출하고 매칭하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}