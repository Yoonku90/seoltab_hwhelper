// 고2~고3 (2022 개정) RAG 커리큘럼 DB — “일반선택” 핵심 과목만
// ※ 과목은 고2/고3 어디에서든 편성될 수 있어 gradeBand로 묶고, recommendedYears는 ["H2","H3"]로 고정.

export type SubjectCode = 'KOR' | 'ENG' | 'MAT' | 'SOC' | 'SCI' | 'INF';
export type RecommendedYear = 'H2' | 'H3';

export type RagElectiveCourse = {
  id: string;
  gradeBand: 'H2-H3';
  recommendedYears: readonly RecommendedYear[];
  curriculumRevision: '2022';
  category: '일반선택';
  subjectCode: SubjectCode;
  subjectKr: '국어' | '영어' | '수학' | '사회' | '과학' | '정보';
  courseKr:
    | '화법과 언어'
    | '독서와 작문'
    | '문학'
    | '대수'
    | '미적분Ⅰ'
    | '확률과 통계'
    | '영어Ⅰ'
    | '영어Ⅱ'
    | '영어독해와 작문'
    | '세계시민과 지리'
    | '세계사'
    | '사회와 문화'
    | '현대사회와 윤리'
    | '물리학'
    | '화학'
    | '지구과학'
    | '생명과학'
    | '정보';
  courseAliases?: string[];
  units: Array<{
    id: string;
    title: string;
    concepts: string[];
    keywords: string[];
    sttTriggers: string[];
  }>;
};

const H23: readonly RecommendedYear[] = ['H2', 'H3'] as const;

export const H2H3_GENERAL_ELECTIVES_2022: RagElectiveCourse[] = [
  // =========================
  // 국어(일반선택)
  // =========================
  {
    id: 'H23-KOR-GE-01',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'KOR',
    subjectKr: '국어',
    courseKr: '화법과 언어',
    units: [
      {
        id: 'H23-KOR-SP-01',
        title: '말하기·듣기 과정(목적·청중·구성·전달)',
        concepts: ['말하기 목적', '청중 분석', '내용 조직', '전달 전략', '경청', '피드백'],
        keywords: ['청중', '목적', '구성', '도입-전개-정리', '시각자료', '경청', '피드백'],
        sttTriggers: ['청중을 먼저', '목적에 맞게', '도입에서', '핵심을 구조화', '전달 전략', '경청하며 메모'],
      },
      {
        id: 'H23-KOR-SP-02',
        title: '설득·토론·논증(주장-근거-반박)',
        concepts: ['논제', '주장', '근거', '타당성', '반박', '재반박', '논리적 오류'],
        keywords: ['논제', '쟁점', '주장', '근거', '반박', '재반박', '오류'],
        sttTriggers: ['쟁점은', '주장-근거', '근거가 타당한지', '반박 포인트', '논리적 오류', '재반박'],
      },
      {
        id: 'H23-KOR-SP-03',
        title: '협상·합의(이해관계·대안 탐색)',
        concepts: ['이해관계', '협상 절차', '대안', '양보', '합의안', '갈등 조정'],
        keywords: ['협상', '이해관계', '대안', '양보', '합의', '조정'],
        sttTriggers: ['이해관계를 정리', '대안을 비교', '양보 가능한 범위', '합의안', '갈등을 조정', '윈윈'],
      },
      {
        id: 'H23-KOR-SP-04',
        title: '담화·화행·맥락(공손·협력·추론)',
        concepts: ['담화', '화행', '상황맥락', '협력', '공손', '함축', '추론'],
        keywords: ['담화', '화행', '맥락', '협력 원리', '공손성', '함축', '추론'],
        sttTriggers: ['상황맥락상', '말의 의도', '함축된 의미', '협력 원리', '공손하게 표현', '추론해 보면'],
      },
      {
        id: 'H23-KOR-SP-05',
        title: '사회 속 언어(언어 공동체·언어 변화·매체 언어)',
        concepts: ['언어 공동체', '언어 변화', '표현의 책임', '혐오/차별 표현', '매체 언어', '비판적 수용'],
        keywords: ['언어 공동체', '언어 변화', '신조어', '차별/혐오', '매체 언어', '책임'],
        sttTriggers: ['언어가 변하는 이유', '공동체마다 표현이', '표현의 책임', '차별적 표현', '매체 언어의 특징', '비판적으로'],
      },
    ],
  },
  {
    id: 'H23-KOR-GE-02',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'KOR',
    subjectKr: '국어',
    courseKr: '독서와 작문',
    units: [
      {
        id: 'H23-KOR-RW-01',
        title: '독서 과정과 전략(목적 설정·점검·조정)',
        concepts: ['읽기 목적', '예측', '질문 생성', '점검', '조정', '메타인지'],
        keywords: ['읽기 목적', '예측', '질문', '점검', '조정', '메타인지'],
        sttTriggers: ['읽기 목적을 세우고', '예측해 보면', '질문을 만들고', '이해가 안 되면 조정', '핵심을 다시 확인', '읽기 전략'],
      },
      {
        id: 'H23-KOR-RW-02',
        title: '정보·설명 글 읽기(정의·분류·비교·인과·과정)',
        concepts: ['설명 방법', '정의', '분류', '비교', '인과', '과정', '자료 통합'],
        keywords: ['정의', '분류', '비교', '인과', '과정', '도표/그래프', '자료 통합'],
        sttTriggers: ['정의부터 잡고', '분류 기준은', '비교/대조', '원인-결과', '과정이 단계별로', '자료를 종합'],
      },
      {
        id: 'H23-KOR-RW-03',
        title: '논증 글 읽기(주장·근거·타당성·오류)',
        concepts: ['논증', '주장', '근거', '추론', '타당성', '논리적 오류', '반박'],
        keywords: ['논증', '주장', '근거', '타당성', '오류', '반박', '추론'],
        sttTriggers: ['주장은 뭐냐면', '근거가 충분한가', '추론이 맞나', '오류가 있는지', '반박 가능', '타당성 검토'],
      },
      {
        id: 'H23-KOR-RW-04',
        title: '작문 과정(계획-작성-수정-퇴고)',
        concepts: ['주제 설정', '자료 수집', '개요', '초고', '고쳐쓰기', '퇴고'],
        keywords: ['계획', '개요', '초고', '고쳐쓰기', '퇴고', '문장 다듬기'],
        sttTriggers: ['개요부터', '초고를 쓰고', '고쳐쓰기', '중복을 줄이고', '문장을 다듬고', '퇴고해 보자'],
      },
      {
        id: 'H23-KOR-RW-05',
        title: '자료 기반 글쓰기(보고/설명/출처·인용 윤리)',
        concepts: ['보고', '설명', '자료 활용', '인용', '출처', '표절 예방', '쓰기 윤리'],
        keywords: ['보고서', '자료 인용', '출처', '표절', '근거 자료', '통계', '그래프'],
        sttTriggers: ['자료를 근거로', '인용은 이렇게', '출처를 밝혀야', '표절은 금지', '통계 자료', '보고서 구조'],
      },
      {
        id: 'H23-KOR-RW-06',
        title: '주장하는 글쓰기(반박 예상·설득 전략)',
        concepts: ['주장', '근거', '예시', '반박 예상', '재반박', '설득 전략', '대안 제시'],
        keywords: ['주장', '근거', '반박', '재반박', '설득', '대안', '타당성'],
        sttTriggers: ['반박을 예상하고', '재반박', '설득 전략', '대안을 제시', '근거를 보강', '타당성을 높이자'],
      },
    ],
  },
  {
    id: 'H23-KOR-GE-03',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'KOR',
    subjectKr: '국어',
    courseKr: '문학',
    units: [
      {
        id: 'H23-KOR-LIT-01',
        title: '문학의 본질(형상화·상상력·수용)',
        concepts: ['문학의 본질', '형상화', '상상력', '정서', '수용', '해석의 근거'],
        keywords: ['형상화', '상상력', '수용', '해석 근거', '정서', '문학의 기능'],
        sttTriggers: ['형상화라는 건', '상상력', '수용자의 해석', '근거 구절', '정서가 드러나고', '문학의 기능'],
      },
      {
        id: 'H23-KOR-LIT-02',
        title: '시(서정) 분석(화자·심상·운율·표현)',
        concepts: ['화자', '심상', '운율', '비유', '상징', '정서', '분위기'],
        keywords: ['화자', '심상', '운율', '비유', '상징', '정서', '분위기'],
        sttTriggers: ['화자의 정서', '심상이', '운율이 만들어내는', '비유/상징', '분위기', '표현 효과'],
      },
      {
        id: 'H23-KOR-LIT-03',
        title: '소설(서사) 분석(서술자·시점·인물·갈등·구성)',
        concepts: ['서술자', '시점', '인물', '갈등', '사건', '구성', '주제'],
        keywords: ['서술자', '시점', '인물', '갈등', '사건', '구성', '주제'],
        sttTriggers: ['시점은', '서술자가', '인물의 성격', '갈등 구조', '사건의 흐름', '주제 의식'],
      },
      {
        id: 'H23-KOR-LIT-04',
        title: '극·교술 분석(대사·무대·서술·논리)',
        concepts: ['극', '대사', '무대 지시', '갈등', '교술', '논리', '표현 방식'],
        keywords: ['희곡', '대사', '무대지시', '갈등', '수필', '논설', '표현 방식'],
        sttTriggers: ['대사가 중심', '무대 지시', '갈등이 표면화', '교술의 논리', '서술 방식', '표현이 다르죠'],
      },
      {
        id: 'H23-KOR-LIT-05',
        title: '맥락과 문학(사회·문화·역사 맥락, 비교 감상)',
        concepts: ['사회·문화적 맥락', '역사적 맥락', '작가 맥락', '독자 맥락', '비교 감상', '현재적 의미'],
        keywords: ['맥락', '사회문화', '역사', '작가', '독자', '비교', '현재적 의미'],
        sttTriggers: ['맥락을 고려하면', '당대 사회', '작가의 관점', '독자 수용', '비교해서', '현재적 의미'],
      },
      {
        id: 'H23-KOR-LIT-06',
        title: '재구성·창작(각색·시점 전환·창작 활동)',
        concepts: ['재구성', '각색', '시점 전환', '요약', '창작', '매체 변환'],
        keywords: ['각색', '재구성', '시점 전환', '대본', '영상화', '창작'],
        sttTriggers: ['시점을 바꿔서', '각색해 보면', '장면을 재구성', '대본으로', '매체로 변환', '창작 활동'],
      },
    ],
  },

  // =========================
  // 수학(일반선택)
  // =========================
  {
    id: 'H23-MAT-GE-01',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'MAT',
    subjectKr: '수학',
    courseKr: '대수',
    units: [
      {
        id: 'H23-MAT-ALG-01',
        title: '지수의 확장과 지수법칙(실수 지수 포함)',
        concepts: ['지수', '거듭제곱', '지수법칙', '실수 지수', '지수함수 기초'],
        keywords: ['지수', '지수법칙', '거듭제곱', '실수 지수', 'a^x'],
        sttTriggers: ['지수법칙', '실수 지수로 확장', '거듭제곱 성질', 'a의 x제곱', '정리해 보면'],
      },
      {
        id: 'H23-MAT-ALG-02',
        title: '로그의 뜻과 성질(로그법칙, 밑변환 기초)',
        concepts: ['로그', '로그의 뜻', '로그법칙', '밑변환', '지수-로그 관계'],
        keywords: ['로그', 'log', '로그법칙', '밑변환', '지수-로그'],
        sttTriggers: ['로그의 정의', '지수와 역관계', '로그법칙', '밑을 바꾸면', '정리하면'],
      },
      {
        id: 'H23-MAT-ALG-03',
        title: '지수함수·로그함수(그래프·성질·방정식/부등식 기초)',
        concepts: ['지수함수', '로그함수', '그래프', '단조성', '교점', '방정식', '부등식'],
        keywords: ['지수함수', '로그함수', '그래프', '단조', '방정식', '부등식'],
        sttTriggers: ['그래프를 그리면', '단조증가/감소', '교점', '방정식을 풀면', '부등식의 해'],
      },
      {
        id: 'H23-MAT-ALG-04',
        title: '삼각함수의 뜻(sin·cos·tan)과 그래프',
        concepts: ['삼각함수', '사인', '코사인', '탄젠트', '호도법(기초)', '그래프', '주기'],
        keywords: ['삼각함수', 'sin', 'cos', 'tan', '그래프', '주기', '진폭'],
        sttTriggers: ['사인/코사인', '그래프의 주기', '기본 성질', '값의 범위', '단위원', '탄젠트는'],
      },
      {
        id: 'H23-MAT-ALG-05',
        title: '삼각함수의 성질·방정식/부등식(기초 적용)',
        concepts: ['삼각함수 성질', '삼각방정식', '삼각부등식', '해의 표현', '주기성'],
        keywords: ['삼각방정식', '삼각부등식', '주기', '해', '기본각'],
        sttTriggers: ['주기성을 이용', '해는 이렇게', '기본각', '일반해', '부등식의 범위'],
      },
      {
        id: 'H23-MAT-ALG-06',
        title: '수열(등차·등비, 일반항, 합)',
        concepts: ['수열', '등차수열', '등비수열', '일반항', '합', '점화식(기초)'],
        keywords: ['등차', '등비', '일반항', '합', '점화식'],
        sttTriggers: ['공차', '공비', '일반항', '첫째항', '합 공식', '점화식으로'],
      },
    ],
  },
  {
    id: 'H23-MAT-GE-02',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'MAT',
    subjectKr: '수학',
    courseKr: '미적분Ⅰ',
    units: [
      {
        id: 'H23-MAT-CAL1-01',
        title: '함수의 극한(개념·계산·좌극한/우극한)',
        concepts: ['극한', '좌극한', '우극한', '극한의 성질', '그래프 해석'],
        keywords: ['극한', '좌극한', '우극한', 'lim', '성질', '그래프'],
        sttTriggers: ['x가 a로 갈 때', '좌극한/우극한', '극한의 성질', '그래프를 보면', '값이 가까워져'],
      },
      {
        id: 'H23-MAT-CAL1-02',
        title: '연속(연속의 뜻·연속 조건·연속과 그래프)',
        concepts: ['연속', '연속 조건', '불연속', '연속함수', '그래프'],
        keywords: ['연속', '불연속', '연속 조건', '그래프'],
        sttTriggers: ['연속이려면', '끊어지지 않고', '불연속점', '조건을 만족', '그래프에서 확인'],
      },
      {
        id: 'H23-MAT-CAL1-03',
        title: '미분계수·도함수(정의·기하적 의미)',
        concepts: ['미분계수', '도함수', '접선의 기울기', '변화율', '도함수 정의'],
        keywords: ['미분계수', '도함수', '접선', '기울기', '변화율'],
        sttTriggers: ['접선의 기울기', '변화율', '미분계수 정의', '도함수로 나타내면', '순간변화율'],
      },
      {
        id: 'H23-MAT-CAL1-04',
        title: '미분법(기본 공식·합성함수 기초 포함)',
        concepts: ['미분 공식', '합/곱/몫(기초)', '합성함수(기초)', '연쇄적 적용'],
        keywords: ['미분 공식', '곱의 미분', '몫의 미분', '합성함수', '연쇄'],
        sttTriggers: ['미분하면', '공식을 적용', '곱/몫', '합성이라서', '연쇄적으로'],
      },
      {
        id: 'H23-MAT-CAL1-05',
        title: '도함수의 활용(증가·감소·극값·그래프)',
        concepts: ['증가', '감소', '극대', '극소', '최대/최소', '그래프 개형'],
        keywords: ['증가', '감소', '극대', '극소', '최댓값', '최솟값', '그래프'],
        sttTriggers: ['도함수의 부호', '증가/감소', '극대/극소', '최대/최소', '그래프를 그리면'],
      },
      {
        id: 'H23-MAT-CAL1-06',
        title: '적분(부정·정적분 기초, 넓이)',
        concepts: ['부정적분', '정적분', '기본정리(기초)', '넓이', '적분의 활용(기초)'],
        keywords: ['부정적분', '정적분', '넓이', '적분', '누적'],
        sttTriggers: ['적분은 미분의 역', '부정적분', '정적분', '넓이를 구하면', '구간에서 누적'],
      },
    ],
  },
  {
    id: 'H23-MAT-GE-03',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'MAT',
    subjectKr: '수학',
    courseKr: '확률과 통계',
    units: [
      {
        id: 'H23-MAT-STA-01',
        title: '경우의 수(합·곱, 순열·조합)',
        concepts: ['합의 법칙', '곱의 법칙', '순열', '조합', '계승', '중복/원순열(기초)'],
        keywords: ['경우의 수', '합의 법칙', '곱의 법칙', '순열', '조합', '팩토리얼'],
        sttTriggers: ['경우를 나누고', '곱의 법칙', '순열/조합', '조건을 해석', '세어 보면'],
      },
      {
        id: 'H23-MAT-STA-02',
        title: '확률의 기초(사건·확률의 성질·덧셈정리)',
        concepts: ['사건', '확률', '여사건', '합사건', '곱사건', '덧셈정리', '배반/독립(기초)'],
        keywords: ['사건', '확률', '여사건', '덧셈정리', '배반', '독립'],
        sttTriggers: ['사건을 정의', '여사건', '덧셈정리', '배반이면', '확률의 성질', '전체 경우 분의'],
      },
      {
        id: 'H23-MAT-STA-03',
        title: '조건부확률·독립(곱셈정리와 연결)',
        concepts: ['조건부확률', '곱셈정리', '독립', '사건의 관계', '나무도표/표(기초)'],
        keywords: ['조건부확률', 'P(A|B)', '독립', '곱셈정리', '나무도표'],
        sttTriggers: ['B가 일어났을 때', '조건부확률', '독립이면', '곱셈정리', '나무도표로'],
      },
      {
        id: 'H23-MAT-STA-04',
        title: '자료 분석(산포·분포·상관, 그래프 해석)',
        concepts: ['분포', '산포', '대표값', '상관', '산점도', '자료 해석'],
        keywords: ['분포', '산포', '상관', '산점도', '히스토그램', '상자그림'],
        sttTriggers: ['분포를 보면', '산포가 크고', '상관관계', '산점도', '그래프 해석', '추세가'],
      },
      {
        id: 'H23-MAT-STA-05',
        title: '표본과 통계적 추론(추정의 아이디어)',
        concepts: ['모집단', '표본', '표본추출', '추정', '오차', '신뢰(아이디어)'],
        keywords: ['모집단', '표본', '표본추출', '추정', '오차', '신뢰'],
        sttTriggers: ['표본으로 모집단을', '추정한다', '표본추출', '오차가 생기고', '신뢰를 높이려면'],
      },
    ],
  },

  // =========================
  // 영어(일반선택)
  // =========================
  {
    id: 'H23-ENG-GE-01',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'ENG',
    subjectKr: '영어',
    courseKr: '영어Ⅰ',
    courseAliases: ['영어 I', 'English I'],
    units: [
      {
        id: 'H23-ENG-E1-01',
        title: 'Listening: main idea/details/inference',
        concepts: ['주제 파악', '세부 정보', '추론', '화자 의도', '요약'],
        keywords: ['main idea', 'details', 'inference', 'intention', 'summary'],
        sttTriggers: ['main idea is', 'the speaker implies', 'according to', 'details', 'inference', 'summarize'],
      },
      {
        id: 'H23-ENG-E1-02',
        title: 'Reading: structure/argument/evidence',
        concepts: ['글 구조', '요지', '논지 전개', '근거', '문맥 추론'],
        keywords: ['structure', 'thesis', 'evidence', 'argument', 'context clues'],
        sttTriggers: ['topic sentence', 'however/therefore', 'evidence', 'argument', 'context clue'],
      },
      {
        id: 'H23-ENG-E1-03',
        title: 'Speaking: opinion & interaction (Q&A)',
        concepts: ['의견 표현', '이유 제시', '질문/응답', '상호작용', '발표 기초'],
        keywords: ['opinion', 'reason', 'Q&A', 'interaction', 'presentation'],
        sttTriggers: ['I think', 'because', 'What do you think', 'Can you explain', 'In conclusion'],
      },
      {
        id: 'H23-ENG-E1-04',
        title: 'Writing: paragraph (topic-support-conclusion)',
        concepts: ['문단', '주제문', '뒷받침 문장', '연결어', '요약/서술'],
        keywords: ['paragraph', 'topic sentence', 'support', 'transition', 'concluding sentence'],
        sttTriggers: ['topic sentence', 'supporting details', 'for example', 'therefore', 'in summary'],
      },
      {
        id: 'H23-ENG-E1-05',
        title: 'Vocabulary/grammar in context (core patterns)',
        concepts: ['핵심 어휘', '문장 패턴', '시제/태/조동사(맥락)', '정확성'],
        keywords: ['tense', 'voice', 'modals', 'patterns', 'accuracy'],
        sttTriggers: ['in context', 'pattern', 'tense', 'passive/active', 'modal'],
      },
    ],
  },
  {
    id: 'H23-ENG-GE-02',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'ENG',
    subjectKr: '영어',
    courseKr: '영어Ⅱ',
    courseAliases: ['영어 II', 'English II'],
    units: [
      {
        id: 'H23-ENG-E2-01',
        title: 'Listening: stance/tone/nuance + evidence-based inference',
        concepts: ['관점', '태도', '뉘앙스', '근거 기반 추론', '요약'],
        keywords: ['stance', 'tone', 'nuance', 'evidence-based inference', 'summary'],
        sttTriggers: ['tone is', 'the speaker’s stance', 'implied', 'evidence', 'summarize'],
      },
      {
        id: 'H23-ENG-E2-02',
        title: 'Reading: counterargument / source integration',
        concepts: ['반박 구조', '복합 자료 종합', '비판적 읽기', '논증 평가'],
        keywords: ['counterargument', 'refutation', 'integrate sources', 'critical reading'],
        sttTriggers: ['on the other hand', 'counterargument', 'refute', 'integrate', 'evaluate the claim'],
      },
      {
        id: 'H23-ENG-E2-03',
        title: 'Speaking: discussion/negotiation (pros-cons, compromise)',
        concepts: ['토의', '찬반', '대안', '합의', '설득', '경청/응답'],
        keywords: ['discussion', 'pros/cons', 'alternative', 'compromise', 'persuasion'],
        sttTriggers: ['I agree/disagree', 'pros and cons', 'alternative', 'let’s compromise', 'I suggest'],
      },
      {
        id: 'H23-ENG-E2-04',
        title: 'Writing: argument & source-based writing (cohesion, register)',
        concepts: ['주장 글', '근거', '자료 기반 글쓰기', '연결성', '문체/톤', '정확성'],
        keywords: ['argument', 'evidence', 'source-based', 'cohesion', 'register'],
        sttTriggers: ['claim-evidence', 'according to the source', 'therefore/however', 'formal tone', 'cohesion'],
      },
    ],
  },
  {
    id: 'H23-ENG-GE-03',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'ENG',
    subjectKr: '영어',
    courseKr: '영어독해와 작문',
    courseAliases: ['영어 독해와 작문', 'Reading & Writing'],
    units: [
      {
        id: 'H23-ENG-RW-01',
        title: '독해 전략(구조·문맥·추론·요약)',
        concepts: ['글 구조', '문맥 추론', '핵심 찾기', '요약', '추론'],
        keywords: ['text structure', 'context clues', 'inference', 'summary', 'main idea'],
        sttTriggers: ['structure', 'context clue', 'infer', 'summarize', 'main idea'],
      },
      {
        id: 'H23-ENG-RW-02',
        title: '논증 독해(주장·근거·반박·오류)',
        concepts: ['주장', '근거', '반박', '타당성', '논리적 오류'],
        keywords: ['claim', 'evidence', 'refute', 'validity', 'fallacy'],
        sttTriggers: ['claim is', 'evidence shows', 'refute', 'logical fallacy', 'valid/invalid'],
      },
      {
        id: 'H23-ENG-RW-03',
        title: '요약·바꿔쓰기(Paraphrase)·정보 통합',
        concepts: ['요약', '바꿔쓰기', '정보 통합', '표/그래프 해석', '출처 기반 정리'],
        keywords: ['paraphrase', 'summary', 'synthesize', 'chart', 'integrate'],
        sttTriggers: ['paraphrase', 'in your own words', 'synthesize', 'according to the chart', 'integrate'],
      },
      {
        id: 'H23-ENG-RW-04',
        title: '작문 과정(계획-초고-수정)과 문단 조직',
        concepts: ['planning', 'drafting', 'revising', 'paragraphing', 'coherence'],
        keywords: ['planning', 'draft', 'revise', 'paragraph', 'coherence', 'cohesion'],
        sttTriggers: ['outline', 'draft', 'revise', 'topic sentence', 'coherence', 'transition'],
      },
      {
        id: 'H23-ENG-RW-05',
        title: '자료 기반 글쓰기(통합형: 읽고-쓰고)',
        concepts: ['source-based writing', 'citation (basic)', 'argument', 'explanation', 'tone'],
        keywords: ['source-based', 'integrated writing', 'citation', 'argument', 'expository'],
        sttTriggers: ['use the source', 'cite', 'integrated writing', 'support your claim', 'formal tone'],
      },
    ],
  },

  // =========================
  // 사회(일반선택)
  // =========================
  {
    id: 'H23-SOC-GE-01',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'SOC',
    subjectKr: '사회',
    courseKr: '세계시민과 지리',
    units: [
      {
        id: 'H23-SOC-GEO-01',
        title: '지리적 관점·공간적 사고(위치·분포·상호작용)',
        concepts: ['공간적 사고', '분포', '이동', '상호작용', '지역', '스케일'],
        keywords: ['공간', '분포', '이동', '상호작용', '지역', '스케일'],
        sttTriggers: ['분포를 보면', '이동이 발생', '상호작용', '지역의 특성', '스케일을 바꾸면'],
      },
      {
        id: 'H23-SOC-GEO-02',
        title: '지도·지리정보(지도 읽기, GIS 개념 기초)',
        concepts: ['지도', '좌표', '축척', '주제도', 'GIS', '자료 해석'],
        keywords: ['지도', '축척', '주제도', '좌표', 'GIS', '공간자료'],
        sttTriggers: ['축척', '주제도', '지도에서', '좌표', 'GIS로 분석', '공간자료'],
      },
      {
        id: 'H23-SOC-GEO-03',
        title: '세계화와 지역 변화(도시·산업·이동·불평등)',
        concepts: ['세계화', '도시', '산업 재편', '국제 이동', '지역 격차', '연결성'],
        keywords: ['세계화', '도시화', '산업', '이동', '격차', '네트워크'],
        sttTriggers: ['세계화 영향', '도시가 성장', '산업이 이동', '국제 이동', '지역 격차', '네트워크'],
      },
      {
        id: 'H23-SOC-GEO-04',
        title: '환경·기후위기와 지속가능성(정책·실천)',
        concepts: ['기후위기', '환경 문제', '자원', '지속가능발전', '대응', '세계시민 실천'],
        keywords: ['기후위기', '탄소', '자원', '지속가능', '대응', 'SDGs'],
        sttTriggers: ['기후위기', '탄소 배출', '지속가능', '대응 정책', '실천 방안', 'SDGs'],
      },
      {
        id: 'H23-SOC-GEO-05',
        title: '세계시민(권리·책임·다문화·평화)',
        concepts: ['세계시민', '인권', '다문화', '평화', '연대', '책임'],
        keywords: ['세계시민', '인권', '다문화', '평화', '연대', '책임'],
        sttTriggers: ['세계시민의 관점', '권리와 책임', '다문화', '평화', '연대', '실천'],
      },
    ],
  },
  {
    id: 'H23-SOC-GE-02',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'SOC',
    subjectKr: '사회',
    courseKr: '세계사',
    units: [
      {
        id: 'H23-SOC-WH-01',
        title: '고대 세계의 형성(문명·국가·종교)',
        concepts: ['고대 문명', '국가 형성', '고대 제국', '종교/사상', '교류'],
        keywords: ['문명', '제국', '종교', '사상', '교류', '고대'],
        sttTriggers: ['고대 문명', '국가가 형성', '제국의 확대', '종교/사상', '교류가 시작'],
      },
      {
        id: 'H23-SOC-WH-02',
        title: '중세 세계와 교류(봉건·이슬람·동서 교역)',
        concepts: ['중세', '봉건', '이슬람 세계', '동서 교류', '교역', '문화 확산'],
        keywords: ['봉건', '이슬람', '십자군', '교역', '실크로드', '문화'],
        sttTriggers: ['봉건제', '이슬람의 확산', '동서 교류', '교역로', '문화가 퍼지고'],
      },
      {
        id: 'H23-SOC-WH-03',
        title: '근세의 전환(르네상스·종교개혁·대항해)',
        concepts: ['르네상스', '종교개혁', '대항해', '절대왕정(기초)', '근대의 시작'],
        keywords: ['르네상스', '종교개혁', '대항해', '절대왕정', '근대'],
        sttTriggers: ['르네상스', '종교개혁', '대항해 시대', '근대가 열리고', '세계가 연결'],
      },
      {
        id: 'H23-SOC-WH-04',
        title: '근대 시민혁명·산업화(자유주의·민주주의 확산)',
        concepts: ['시민혁명', '산업혁명', '자본주의', '민주주의', '제국주의(기초)'],
        keywords: ['시민혁명', '산업혁명', '자본주의', '민주주의', '제국주의'],
        sttTriggers: ['시민혁명', '산업혁명', '자본주의가 확산', '민주주의 발전', '제국주의'],
      },
      {
        id: 'H23-SOC-WH-05',
        title: '현대 세계(세계대전·냉전·탈냉전·세계화)',
        concepts: ['세계대전', '냉전', '탈냉전', '국제기구', '세계화', '현대 쟁점'],
        keywords: ['세계대전', '냉전', '국제기구', '세계화', '현대'],
        sttTriggers: ['세계대전', '냉전 체제', '탈냉전', '국제기구', '세계화', '현대 쟁점'],
      },
    ],
  },
  {
    id: 'H23-SOC-GE-03',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'SOC',
    subjectKr: '사회',
    courseKr: '사회와 문화',
    units: [
      {
        id: 'H23-SOC-SC-01',
        title: '사회·문화의 이해(사회학적 상상력, 연구 방법 기초)',
        concepts: ['사회학적 관점', '사회학적 상상력', '가설', '조사', '자료 해석', '윤리'],
        keywords: ['사회학', '연구', '가설', '설문', '면접', '자료 해석', '윤리'],
        sttTriggers: ['사회학적 관점', '가설을 세우고', '조사 방법', '자료를 해석', '연구 윤리'],
      },
      {
        id: 'H23-SOC-SC-02',
        title: '문화(특성·다양성·변동·다문화)',
        concepts: ['문화', '문화의 특성', '문화 상대주의', '문화 변동', '하위문화', '다문화'],
        keywords: ['문화', '상대주의', '변동', '하위문화', '다문화', '문화 갈등'],
        sttTriggers: ['문화의 특성', '상대주의', '문화가 변동', '다문화 사회', '문화 갈등', '공존'],
      },
      {
        id: 'H23-SOC-SC-03',
        title: '사회화·일탈·사회 통제(규범/제재)',
        concepts: ['사회화', '규범', '일탈', '낙인', '사회 통제', '제재'],
        keywords: ['사회화', '규범', '일탈', '낙인', '통제', '제재'],
        sttTriggers: ['사회화 과정', '규범을 어기면', '일탈', '낙인', '사회적 통제', '제재'],
      },
      {
        id: 'H23-SOC-SC-04',
        title: '사회 계층·불평등(이동·격차·정책)',
        concepts: ['사회계층', '불평등', '사회이동', '계층 구조', '양극화', '복지'],
        keywords: ['계층', '불평등', '사회이동', '양극화', '복지', '격차'],
        sttTriggers: ['계층 구조', '불평등', '사회이동', '양극화', '격차를 줄이려면', '복지 정책'],
      },
      {
        id: 'H23-SOC-SC-05',
        title: '사회 변동과 현대사회(정보화·인구·가족·교육·미디어)',
        concepts: ['사회변동', '정보화', '인구 변화', '가족', '교육', '미디어', '사회 문제'],
        keywords: ['사회변동', '정보화', '저출산', '고령화', '가족 변화', '교육', '미디어'],
        sttTriggers: ['정보화 사회', '인구 구조 변화', '가족이 변하고', '교육의 기능', '미디어 영향', '사회 문제'],
      },
    ],
  },
  {
    id: 'H23-SOC-GE-04',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'SOC',
    subjectKr: '사회',
    courseKr: '현대사회와 윤리',
    units: [
      {
        id: 'H23-SOC-ETH-01',
        title: '윤리적 사고(규범·가치·딜레마 분석)',
        concepts: ['가치', '규범', '윤리적 딜레마', '정당화', '비판적 성찰'],
        keywords: ['가치', '규범', '딜레마', '정당화', '성찰'],
        sttTriggers: ['윤리적 딜레마', '가치가 충돌', '정당화', '근거를 따지면', '비판적으로 성찰'],
      },
      {
        id: 'H23-SOC-ETH-02',
        title: '정의·인권·자유(권리 충돌과 조정)',
        concepts: ['정의', '인권', '자유', '평등', '권리 충돌', '사회적 약자'],
        keywords: ['정의', '인권', '자유', '평등', '권리', '약자'],
        sttTriggers: ['정의의 기준', '인권', '자유와 평등', '권리가 충돌', '조정 방안', '약자 보호'],
      },
      {
        id: 'H23-SOC-ETH-03',
        title: '생명·의료 윤리(생명권·자기결정·돌봄)',
        concepts: ['생명윤리', '의료윤리', '자기결정', '돌봄', '책임', '공공성'],
        keywords: ['생명윤리', '의료윤리', '자기결정', '돌봄', '공공성'],
        sttTriggers: ['자기결정권', '생명권', '의료 윤리', '돌봄', '공공성', '책임'],
      },
      {
        id: 'H23-SOC-ETH-04',
        title: '과학기술·AI 윤리(정보 윤리, 프라이버시, 편향)',
        concepts: ['정보윤리', '프라이버시', '감시', '알고리즘 편향', '책임', '디지털 시민성'],
        keywords: ['프라이버시', '데이터', '감시', '편향', 'AI 윤리', '디지털 시민'],
        sttTriggers: ['프라이버시', '데이터가 수집', '감시', '편향', 'AI 윤리', '책임 소재'],
      },
      {
        id: 'H23-SOC-ETH-05',
        title: '환경·지속가능 윤리(기후위기·세대 간 정의)',
        concepts: ['환경윤리', '기후위기', '지속가능', '세대 간 정의', '공동선', '실천'],
        keywords: ['환경윤리', '기후위기', '지속가능', '세대 간 정의', '공동선'],
        sttTriggers: ['기후위기', '세대 간 정의', '지속가능', '공동선', '실천 방안'],
      },
    ],
  },

  // =========================
  // 과학(일반선택)
  // =========================
  {
    id: 'H23-SCI-GE-01',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'SCI',
    subjectKr: '과학',
    courseKr: '물리학',
    units: [
      {
        id: 'H23-SCI-PHY-01',
        title: '운동(속도·가속도)과 힘(뉴턴 법칙)',
        concepts: ['운동', '속도', '가속도', '힘', '뉴턴 법칙', '마찰'],
        keywords: ['속도', '가속도', '뉴턴', '힘', '마찰', '그래프'],
        sttTriggers: ['속도-시간 그래프', '가속도', '뉴턴의 법칙', '힘의 합', '마찰력', '운동 방정식'],
      },
      {
        id: 'H23-SCI-PHY-02',
        title: '에너지·일·운동량(보존 법칙 기초)',
        concepts: ['일', '에너지', '운동에너지', '위치에너지', '운동량', '보존'],
        keywords: ['일', '에너지', '운동량', '보존', '충돌'],
        sttTriggers: ['일-에너지', '보존', '운동량', '충돌', '에너지 전환'],
      },
      {
        id: 'H23-SCI-PHY-03',
        title: '파동(진동·파장·주기)과 소리/빛 기초',
        concepts: ['파동', '진폭', '주기', '파장', '간섭(기초)', '반사', '굴절'],
        keywords: ['파동', '파장', '주기', '진폭', '간섭', '반사', '굴절'],
        sttTriggers: ['파장과 주기', '진폭', '간섭', '반사', '굴절', '매질이 바뀌면'],
      },
      {
        id: 'H23-SCI-PHY-04',
        title: '전기(전하·전기장)와 회로(전류·저항) 기초',
        concepts: ['전하', '전기장', '전위(기초)', '전류', '저항', '옴의 법칙', '회로'],
        keywords: ['전하', '전류', '저항', '옴의 법칙', '회로', '전기장'],
        sttTriggers: ['옴의 법칙', '전류가 흐르고', '저항', '회로 연결', '전하', '전기장'],
      },
      {
        id: 'H23-SCI-PHY-05',
        title: '자기(자기장)와 전자기 유도(기초)',
        concepts: ['자기장', '자기력', '전자기 유도', '발전 원리(기초)', '모터(기초)'],
        keywords: ['자기장', '전자기 유도', '발전', '모터', '자기력'],
        sttTriggers: ['자기장', '유도 전류', '발전 원리', '모터', '자기력의 방향'],
      },
    ],
  },
  {
    id: 'H23-SCI-GE-02',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'SCI',
    subjectKr: '과학',
    courseKr: '화학',
    units: [
      {
        id: 'H23-SCI-CHE-01',
        title: '물질의 구성(원자·주기율·전자배치 기초)',
        concepts: ['원자', '원소', '주기율', '전자배치(기초)', '이온(기초)'],
        keywords: ['원자', '주기율', '전자배치', '이온', '원소'],
        sttTriggers: ['주기율표', '전자배치', '원자 구조', '이온이 되면', '원소의 성질'],
      },
      {
        id: 'H23-SCI-CHE-02',
        title: '화학 결합(이온결합·공유결합)과 분자 구조(기초)',
        concepts: ['이온결합', '공유결합', '분자', '결합의 극성(기초)', '물질의 성질'],
        keywords: ['이온결합', '공유결합', '분자', '극성', '성질'],
        sttTriggers: ['이온결합/공유결합', '분자', '성질이 달라지고', '극성', '결합을 보면'],
      },
      {
        id: 'H23-SCI-CHE-03',
        title: '화학 반응(반응식·양적 관계) 기초',
        concepts: ['화학반응', '반응식', '계수', '질량보존', '양적 관계(기초)'],
        keywords: ['반응식', '계수', '질량보존', '양적 관계', '몰(기초)'],
        sttTriggers: ['반응식을 맞추고', '계수', '질량보존', '양적 관계', '얼마나 생성'],
      },
      {
        id: 'H23-SCI-CHE-04',
        title: '상태·용액(기체/액체/고체 성질, 농도 기초)',
        concepts: ['상태', '기체', '용액', '용질/용매', '농도', '용해'],
        keywords: ['용액', '농도', '용해', '용질', '용매', '기체 성질'],
        sttTriggers: ['농도', '용질/용매', '용해', '희석', '기체의 성질', '상태에 따라'],
      },
      {
        id: 'H23-SCI-CHE-05',
        title: '산·염기(중화) 기초',
        concepts: ['산', '염기', 'pH(기초)', '중화', '염'],
        keywords: ['산', '염기', '중화', 'pH', '염'],
        sttTriggers: ['산과 염기', '중화 반응', 'pH', '염이 생성', '성질을 비교'],
      },
    ],
  },
  {
    id: 'H23-SCI-GE-03',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'SCI',
    subjectKr: '과학',
    courseKr: '지구과학',
    units: [
      {
        id: 'H23-SCI-ESC-01',
        title: '지구 시스템(지권·수권·기권 상호작용)',
        concepts: ['지구시스템', '지권', '수권', '기권', '상호작용', '순환'],
        keywords: ['지구시스템', '지권', '수권', '기권', '순환', '상호작용'],
        sttTriggers: ['지구시스템', '상호작용', '순환', '권역이 연결', '물질/에너지 흐름'],
      },
      {
        id: 'H23-SCI-ESC-02',
        title: '지질(판구조·지진·화산·지층) 기초',
        concepts: ['판구조', '지각변동', '지진', '화산', '지층', '암석'],
        keywords: ['판', '지진', '화산', '지층', '암석', '변동'],
        sttTriggers: ['판이 이동', '지진/화산', '지층이 쌓이고', '암석', '변동의 증거'],
      },
      {
        id: 'H23-SCI-ESC-03',
        title: '대기·기후(기압·바람·전선·기후 변화) 기초',
        concepts: ['기압', '바람', '전선', '구름/강수', '기후', '기후변화'],
        keywords: ['기압', '바람', '전선', '강수', '기후', '기후변화'],
        sttTriggers: ['기압차', '바람이 불고', '전선', '구름과 강수', '기후', '기후변화'],
      },
      {
        id: 'H23-SCI-ESC-04',
        title: '해양(해류·해수 성질·해양과 기후) 기초',
        concepts: ['해수', '해류', '염분', '수온', '해양-기후 상호작용'],
        keywords: ['해류', '염분', '수온', '해양', '기후'],
        sttTriggers: ['해류', '염분/수온', '해양이 기후에', '열을 운반', '상호작용'],
      },
      {
        id: 'H23-SCI-ESC-05',
        title: '천문(태양계·별·은하·우주) 기초',
        concepts: ['태양계', '행성', '별', '은하', '우주', '관측'],
        keywords: ['태양계', '행성', '별', '은하', '우주', '관측'],
        sttTriggers: ['태양계', '행성의 특징', '별의 밝기/색', '은하', '우주', '관측 자료'],
      },
    ],
  },
  {
    id: 'H23-SCI-GE-04',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'SCI',
    subjectKr: '과학',
    courseKr: '생명과학',
    units: [
      {
        id: 'H23-SCI-BIO-01',
        title: '세포와 물질대사(막수송·효소·호흡/광합성 기초)',
        concepts: ['세포', '세포막', '막수송', '효소', '물질대사', '세포호흡', '광합성(기초)'],
        keywords: ['세포', '막수송', '효소', '물질대사', '호흡', '광합성'],
        sttTriggers: ['세포막', '막수송', '효소', '대사', '호흡', '광합성'],
      },
      {
        id: 'H23-SCI-BIO-02',
        title: '유전(염색체·DNA·유전 정보·가계도 기초)',
        concepts: ['염색체', 'DNA', '유전자', '유전', '형질', '가계도(기초)'],
        keywords: ['DNA', '유전자', '염색체', '유전', '가계도', '형질'],
        sttTriggers: ['DNA', '유전자', '염색체', '형질이 전달', '가계도', '유전 방식'],
      },
      {
        id: 'H23-SCI-BIO-03',
        title: '진화와 다양성(변이·자연선택·계통)',
        concepts: ['변이', '자연선택', '적응', '진화', '계통', '생물다양성'],
        keywords: ['변이', '자연선택', '적응', '진화', '계통', '다양성'],
        sttTriggers: ['변이가 생기고', '자연선택', '적응', '진화', '계통 관계', '다양성'],
      },
      {
        id: 'H23-SCI-BIO-04',
        title: '항상성·신경/호르몬(조절과 항상성 기초)',
        concepts: ['항상성', '신경계', '호르몬', '되먹임', '조절'],
        keywords: ['항상성', '신경', '호르몬', '되먹임', '조절'],
        sttTriggers: ['항상성', '호르몬', '신경계', '되먹임', '조절 작용'],
      },
      {
        id: 'H23-SCI-BIO-05',
        title: '생태(개체군·군집·생태계·물질순환/에너지흐름)',
        concepts: ['개체군', '군집', '생태계', '먹이그물', '에너지 흐름', '물질순환'],
        keywords: ['개체군', '군집', '생태계', '먹이그물', '에너지', '물질순환'],
        sttTriggers: ['개체군', '군집', '생태계', '먹이그물', '에너지 흐름', '물질순환'],
      },
    ],
  },

  // =========================
  // 정보(일반선택)
  // =========================
  {
    id: 'H23-INF-GE-01',
    gradeBand: 'H2-H3',
    recommendedYears: H23,
    curriculumRevision: '2022',
    category: '일반선택',
    subjectCode: 'INF',
    subjectKr: '정보',
    courseKr: '정보',
    units: [
      {
        id: 'H23-INF-INF-01',
        title: '데이터 표현(이진수·문자·이미지/소리 기초)과 컴퓨팅 시스템',
        concepts: ['이진수', '정보 표현', '인코딩', '컴퓨팅 시스템', '하드웨어/소프트웨어'],
        keywords: ['이진수', '인코딩', '데이터 표현', '하드웨어', '소프트웨어'],
        sttTriggers: ['이진수', '데이터를 표현', '인코딩', '하드웨어/소프트웨어', '시스템'],
      },
      {
        id: 'H23-INF-INF-02',
        title: '문제 해결과 알고리즘(절차·분해·추상화·검증)',
        concepts: ['문제 분해', '추상화', '알고리즘', '의사코드', '정확성', '효율성'],
        keywords: ['알고리즘', '의사코드', '추상화', '분해', '효율', '정확성'],
        sttTriggers: ['문제를 분해', '추상화', '알고리즘을 설계', '의사코드', '검증', '효율성'],
      },
      {
        id: 'H23-INF-INF-03',
        title: '프로그래밍 기초(변수·조건·반복·함수)와 디버깅',
        concepts: ['변수', '자료형(기초)', '조건', '반복', '함수', '디버깅'],
        keywords: ['변수', '조건문', '반복문', '함수', '디버깅', '테스트'],
        sttTriggers: ['변수', 'if', 'loop', '함수로 묶고', '디버깅', '테스트 케이스'],
      },
      {
        id: 'H23-INF-INF-04',
        title: '데이터 분석 기초(수집·정제·시각화·해석)',
        concepts: ['데이터 수집', '정제', '분석', '시각화', '해석', '의사결정'],
        keywords: ['정제', '시각화', '분석', '해석', '데이터', '의사결정'],
        sttTriggers: ['정제', '결측 처리', '시각화', '패턴을 해석', '데이터 기반'],
      },
      {
        id: 'H23-INF-INF-05',
        title: '네트워크·보안(인터넷, 암호/인증 기초, 정보 윤리)',
        concepts: ['네트워크', '인터넷', '프로토콜(기초)', '보안', '암호(기초)', '인증', '정보 윤리'],
        keywords: ['네트워크', '인터넷', '보안', '암호', '인증', '개인정보', '윤리'],
        sttTriggers: ['네트워크', '인터넷', '보안', '암호', '인증', '개인정보', '정보 윤리'],
      },
      {
        id: 'H23-INF-INF-06',
        title: 'AI/데이터 사회의 쟁점(편향·책임·프라이버시)',
        concepts: ['AI', '편향', '책임', '프라이버시', '데이터 거버넌스', '디지털 시민성'],
        keywords: ['AI', '편향', '책임', '프라이버시', '데이터', '디지털 시민'],
        sttTriggers: ['편향', '책임 소재', '프라이버시', 'AI가 판단', '데이터를 사용', '디지털 시민성'],
      },
    ],
  },
];

