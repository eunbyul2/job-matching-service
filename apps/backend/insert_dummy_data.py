import asyncio
import asyncpg
from datetime import datetime, date, timedelta
import random
import json

async def main():
    conn = await asyncpg.connect(
        user='postgres',
        password='password',
        database='job_matching',
        host='localhost'
    )
    
    try:
        print("=== 더미 데이터 삽입 시작 ===\n")
        
        # 1. 테스트 사용자
        print("1. 사용자 생성...")
        user_id = await conn.fetchval("""
            INSERT INTO users (email, password_hash, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO UPDATE SET name = $3
            RETURNING id
        """, 'test@example.com', 'hashed_password', '김개발')
        print(f"   ✅ 사용자 ID: {user_id}\n")
        
        # 2. 채용공고 200개
        print("2. 채용공고 생성 (200개)...")
        
        companies = ['네이버', '카카오', '쿠팡', '토스', '당근마켓', '배민', '라인', '야놀자', '무신사', '컬리',
                     '직방', '왓챠', '크래프톤', '넥슨', '엔씨소프트', '넷마블', '스마일게이트', '하이퍼커넥트']
        
        positions = ['백엔드', '프론트엔드', '풀스택', '데이터엔지니어', '데이터분석가', 'AI/ML', '인프라/DevOps', '안드로이드', 'iOS']
        
        locations = ['서울', '경기', '판교', '강남', '분당', '성남']
        
        tech_stacks_map = {
            '백엔드': [['Python', 'Django', 'PostgreSQL'], ['Java', 'Spring', 'MySQL'], ['Node.js', 'Express', 'MongoDB']],
            '프론트엔드': [['React', 'TypeScript', 'Next.js'], ['Vue.js', 'Nuxt.js', 'Tailwind'], ['Angular', 'RxJS', 'SCSS']],
            '데이터엔지니어': [['Python', 'Spark', 'Airflow'], ['Kafka', 'Hadoop', 'Hive']],
            'AI/ML': [['Python', 'PyTorch', 'TensorFlow'], ['Scikit-learn', 'MLflow', 'Kubeflow']]
        }
        
        for i in range(200):
            company = companies[i % len(companies)]
            position = positions[i % len(positions)]
            location = locations[i % len(locations)]
            
            tech_options = tech_stacks_map.get(position, [['Python', 'Django']])
            tech_stacks = random.choice(tech_options)
            
            exp_min = random.choice([0, 1, 2, 3])
            exp_max = exp_min + random.choice([2, 3, 4])
            
            salary_min = 4000 + exp_min * 1000
            salary_max = salary_min + 2000
            
            descriptions = [
                f"우리 회사는 {position} 개발자를 찾습니다. 긍정적이고 협업을 중시하는 분을 환영합니다.",
                f"{company}에서 함께 성장할 {position} 개발자를 모집합니다. 적극적인 소통과 책임감이 중요합니다.",
                f"빠르게 성장하는 팀에서 {position} 역할을 맡을 분을 찾습니다. 문제 해결 능력과 학습 의욕이 높은 분 환영합니다."
            ]
            
            requirements = f"{', '.join(tech_stacks[:2])} 실무 {exp_min}년 이상\n팀 프로젝트 경험\nGit 협업 경험"
            preferred = "긍정적 마인드\n적극적 소통\n책임감\n빠른 학습 능력"
            
            await conn.execute("""
                INSERT INTO job_postings (
                    source, external_id, company_name, title, position,
                    location, experience_min, experience_max, experience_text,
                    tech_stacks, salary_min, salary_max, salary_text,
                    description, requirements, preferred_qualifications,
                    deadline, posted_at, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                ON CONFLICT DO NOTHING
            """,
                'dummy', f'dummy_{i+1}', company, f'{position} 개발자 채용', position,
                location, exp_min, exp_max, f'경력 {exp_min}~{exp_max}년',
                json.dumps(tech_stacks), salary_min, salary_max, f'{salary_min//10000}~{salary_max//10000}만원',
                random.choice(descriptions), requirements, preferred,
                date.today() + timedelta(days=30 + i % 60),
                datetime.now() - timedelta(days=i % 30), True
            )
            
            if (i + 1) % 50 == 0:
                print(f"   {i + 1}개 생성...")
        
        print(f"   ✅ 200개 채용공고 생성 완료\n")
        
        # 3. 테스트 지원서
        print("3. 테스트 지원서 생성...")
        resume_id = await conn.fetchval("INSERT INTO resumes (user_id, title) VALUES ($1, $2) RETURNING id", 
                                        user_id, '백엔드 개발자 지원서')
        
        await conn.execute("""
            INSERT INTO resume_basic_info (resume_id, name, email, phone)
            VALUES ($1, $2, $3, $4) ON CONFLICT (resume_id) DO UPDATE SET name = $2
        """, resume_id, '김개발', 'test@example.com', '010-1234-5678')
        
        await conn.execute("""
            INSERT INTO resume_cover_letters (resume_id, self_introduction, motivation, strengths)
            VALUES ($1, $2, $3, $4) ON CONFLICT (resume_id) DO UPDATE SET self_introduction = $2
        """,
            resume_id,
            "저는 밝고 긍정적인 성격으로 문제 해결을 즐기는 개발자입니다. 팀 프로젝트에서 협업의 중요성을 배웠고, 적극적인 소통을 통해 함께 성장하는 것을 좋아합니다.",
            "귀사의 혁신적인 기술력과 긍정적인 조직 문화에 깊은 인상을 받았습니다. 빠른 학습을 통해 팀에 기여하고 책임감 있게 프로젝트를 완수하겠습니다.",
            "빠른 학습 능력과 문제 해결 능력이 강점입니다. Python과 Django를 활용한 3년간의 백엔드 개발 경험으로 RESTful API 설계에 익숙합니다."
        )
        
        print(f"   ✅ 지원서 ID: {resume_id}\n")
        print("=== 완료! ===\n")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())