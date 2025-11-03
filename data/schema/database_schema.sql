-- PostgreSQL 14+ 스키마

-- DROP TABLE IF EXISTS applications CASCADE;
-- DROP TABLE IF EXISTS job_matches CASCADE;
-- DROP TABLE IF EXISTS resume_additional_info CASCADE;
-- DROP TABLE IF EXISTS resume_skills CASCADE;
-- DROP TABLE IF EXISTS resume_projects CASCADE;
-- DROP TABLE IF EXISTS resume_achievements CASCADE;
-- DROP TABLE IF EXISTS resume_experiences CASCADE;
-- DROP TABLE IF EXISTS resume_cover_letters CASCADE;
-- DROP TABLE IF EXISTS resume_basic_info CASCADE;
-- DROP TABLE IF EXISTS job_postings CASCADE;
-- DROP TABLE IF EXISTS resumes CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) DEFAULT 'AI 매칭 세션',
    status VARCHAR(20) DEFAULT 'active',
    summary TEXT,
    last_message_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

CREATE TABLE candidate_profiles (
    id SERIAL PRIMARY KEY,
    session_id INTEGER UNIQUE REFERENCES chat_sessions(id) ON DELETE CASCADE,
    headline VARCHAR(255),
    summary TEXT,
    strengths TEXT[],
    improvements TEXT[],
    skills JSONB,
    experiences JSONB,
    preferences JSONB,
    last_generated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resumes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) DEFAULT '새 지원서',
    sections_completed INTEGER DEFAULT 0,
    total_characters INTEGER DEFAULT 0,
    estimated_pages DECIMAL(3,1) DEFAULT 0,
    is_submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resume_basic_info (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resume_cover_letters (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE UNIQUE,
    self_introduction TEXT,
    motivation TEXT,
    strengths TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resume_experiences (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
    company_name VARCHAR(200) NOT NULL,
    position VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    responsibilities TEXT[],
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resume_achievements (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    details TEXT[],
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resume_projects (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
    project_name VARCHAR(200) NOT NULL,
    start_date DATE,
    end_date DATE,
    role VARCHAR(100),
    tech_stacks JSONB,
    key_features TEXT[],
    outcomes TEXT[],
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resume_skills (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    skills TEXT[],
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE resume_additional_info (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE UNIQUE,
    github_url VARCHAR(255),
    blog_url VARCHAR(255),
    portfolio_url VARCHAR(255),
    linkedin_url VARCHAR(255),
    other_info TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_postings (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    external_id VARCHAR(200),
    original_url TEXT,
    company_name VARCHAR(200) NOT NULL,
    title VARCHAR(300) NOT NULL,
    position VARCHAR(100),
    location VARCHAR(200),
    experience_min INTEGER DEFAULT 0,
    experience_max INTEGER,
    experience_text VARCHAR(100),
    tech_stacks JSONB,
    salary_min INTEGER,
    salary_max INTEGER,
    salary_text VARCHAR(200),
    benefits JSONB,
    description TEXT NOT NULL,
    requirements TEXT,
    preferred_qualifications TEXT,
    deadline DATE,
    posted_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    raw_data JSONB,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source, external_id)
);

CREATE TABLE job_matches (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    job_posting_id INTEGER REFERENCES job_postings(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL,
    analysis JSONB,
    tech_match_score DECIMAL(5,2),
    experience_match_score DECIMAL(5,2),
    personality_match_score DECIMAL(5,2),
    location_match_score DECIMAL(5,2),
    is_bookmarked BOOLEAN DEFAULT FALSE,
    is_applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resume_id, job_posting_id),
    UNIQUE(session_id, job_posting_id)
);

CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER REFERENCES resumes(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    job_posting_id INTEGER REFERENCES job_postings(id) ON DELETE CASCADE,
    match_id INTEGER REFERENCES job_matches(id),
    status VARCHAR(50) DEFAULT 'submitted',
    applied_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resume_id, job_posting_id),
    UNIQUE(session_id, job_posting_id)
);

CREATE INDEX idx_resumes_user ON resumes(user_id);
CREATE INDEX idx_job_postings_position ON job_postings(position);
CREATE INDEX idx_job_postings_is_active ON job_postings(is_active);
CREATE INDEX idx_job_postings_tech_stacks ON job_postings USING GIN(tech_stacks);
CREATE INDEX idx_matches_resume ON job_matches(resume_id);
CREATE INDEX idx_matches_session ON job_matches(session_id);
CREATE INDEX idx_matches_score ON job_matches(match_score DESC);
