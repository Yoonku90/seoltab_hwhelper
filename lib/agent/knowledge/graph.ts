// ==========================================
// 🕸️ Knowledge Graph (지식 그래프)
// 개념 간 관계 매핑 및 최적 학습 순서
// ==========================================

/**
 * 개념 노드
 */
export interface ConceptNode {
  id: string;
  name: string;
  subject: string;
  prerequisites: string[]; // 선행 개념들
  difficulty: number; // 1-5
  description?: string;
}

/**
 * 지식 그래프
 */
export class KnowledgeGraph {
  private concepts: Map<string, ConceptNode> = new Map();
  
  /**
   * 개념 추가
   */
  addConcept(concept: ConceptNode): void {
    this.concepts.set(concept.id, concept);
  }
  
  /**
   * 개념 조회
   */
  getConcept(id: string): ConceptNode | undefined {
    return this.concepts.get(id);
  }
  
  /**
   * 최적 학습 순서 계산 (위상 정렬)
   */
  getOptimalLearningOrder(targetConceptId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    const dfs = (conceptId: string) => {
      if (visited.has(conceptId)) return;
      
      const concept = this.concepts.get(conceptId);
      if (!concept) return;
      
      // 선행 개념들을 먼저 방문
      for (const prereq of concept.prerequisites) {
        dfs(prereq);
      }
      
      visited.add(conceptId);
      result.push(conceptId);
    };
    
    dfs(targetConceptId);
    return result;
  }
  
  /**
   * 관련 개념 추천
   */
  getRelatedConcepts(conceptId: string, maxCount: number = 5): string[] {
    const concept = this.concepts.get(conceptId);
    if (!concept) return [];
    
    const related = new Set<string>();
    
    // 선행 개념들
    for (const prereq of concept.prerequisites) {
      related.add(prereq);
    }
    
    // 이 개념을 선행 개념으로 가지는 개념들
    for (const [id, c] of this.concepts.entries()) {
      if (c.prerequisites.includes(conceptId)) {
        related.add(id);
      }
    }
    
    return Array.from(related).slice(0, maxCount);
  }
}

/**
 * 기본 지식 그래프 생성 (예시)
 */
export function createDefaultKnowledgeGraph(): KnowledgeGraph {
  const graph = new KnowledgeGraph();
  
  // 수학 예시
  graph.addConcept({ id: 'math_basic', name: '기초 연산', subject: '수학', prerequisites: [], difficulty: 1 });
  graph.addConcept({ id: 'math_equation', name: '방정식', subject: '수학', prerequisites: ['math_basic'], difficulty: 2 });
  graph.addConcept({ id: 'math_quadratic', name: '이차방정식', subject: '수학', prerequisites: ['math_equation'], difficulty: 3 });
  
  // 영어 예시
  graph.addConcept({ id: 'eng_verb', name: '동사', subject: '영어', prerequisites: [], difficulty: 1 });
  graph.addConcept({ id: 'eng_sense', name: '감각동사', subject: '영어', prerequisites: ['eng_verb'], difficulty: 2 });
  graph.addConcept({ id: 'eng_give', name: '수여동사', subject: '영어', prerequisites: ['eng_verb'], difficulty: 2 });
  
  return graph;
}

