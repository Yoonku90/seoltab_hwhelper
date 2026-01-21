/**
 * STT와 이미지를 섹션별로 분할하는 유틸리티
 */

import type { Conversation } from './stt-utils';

export interface Section {
  index: number;
  conversations: Conversation[];
  imageRefs: string[];
  startTime?: number;
  endTime?: number;
  title?: string;
}

/**
 * STT 대화를 섹션으로 분할
 * - 페이지 전환 신호: "다음 페이지", "이제 ~볼게", "~페이지"
 * - 주제 전환 신호: "이제 ~해볼게", "다음으로 ~", "이제 ~배워볼게"
 * - 시간 간격: 10분 이상 공백
 */
export function splitConversationsIntoSections(
  conversations: Conversation[],
  images: string[] = []
): Section[] {
  if (conversations.length === 0) {
    return [];
  }

  const sections: Section[] = [];
  let currentSection: Conversation[] = [];
  let currentImageRefs: string[] = [];
  let sectionIndex = 0;

  // 페이지 전환 키워드
  const pageTransitionKeywords = [
    '다음 페이지',
    '이제 다음',
    '페이지 넘',
    '~페이지',
    '다음 장',
    '이제 ~볼게',
    '이제 보자',
    '다음으로 넘어가',
  ];

  // 주제 전환 키워드
  const topicTransitionKeywords = [
    '이제 ~해볼게',
    '다음으로 ~',
    '이제 ~배워볼게',
    '그럼 이제',
    '이제부터',
    '다음은',
    '이제 ~풀어볼게',
    '다음 문제',
  ];

  // 이미지 참조 추출
  const getImageRefs = (conv: Conversation): string[] => {
    if (conv.imageRef) {
      return [conv.imageRef];
    }
    return [];
  };

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    const text = conv.text.toLowerCase();

    // 페이지 전환 감지
    const hasPageTransition = pageTransitionKeywords.some((keyword) => {
      const pattern = keyword.replace('~', '\\w+');
      return new RegExp(pattern).test(text) || text.includes(keyword.replace('~', ''));
    });

    // 주제 전환 감지
    const hasTopicTransition = topicTransitionKeywords.some((keyword) => {
      const pattern = keyword.replace('~', '\\w+');
      return new RegExp(pattern).test(text) || text.includes(keyword.replace('~', ''));
    });

    // 시간 간격 체크 (10분 = 600초)
    let hasTimeGap = false;
    if (i > 0 && conv.timestamp && conversations[i - 1].timestamp) {
      const timeDiff = Math.abs(
        new Date(conv.timestamp).getTime() - new Date(conversations[i - 1].timestamp).getTime()
      );
      if (timeDiff > 600000) {
        // 10분 = 600,000ms
        hasTimeGap = true;
      }
    }

    // 섹션 전환 조건
    if ((hasPageTransition || hasTopicTransition || hasTimeGap) && currentSection.length > 0) {
      // 현재 섹션 저장
      sections.push({
        index: sectionIndex++,
        conversations: [...currentSection],
        imageRefs: [...new Set(currentImageRefs)],
        startTime: currentSection[0]?.timestamp
          ? new Date(currentSection[0].timestamp).getTime()
          : undefined,
        endTime: currentSection[currentSection.length - 1]?.timestamp
          ? new Date(currentSection[currentSection.length - 1].timestamp).getTime()
          : undefined,
      });

      // 새 섹션 시작
      currentSection = [];
      currentImageRefs = [];
    }

    // 현재 대화 추가
    currentSection.push(conv);
    currentImageRefs.push(...getImageRefs(conv));
  }

  // 마지막 섹션 추가
  if (currentSection.length > 0) {
    sections.push({
      index: sectionIndex,
      conversations: [...currentSection],
      imageRefs: [...new Set(currentImageRefs)],
      startTime: currentSection[0]?.timestamp
        ? new Date(currentSection[0].timestamp).getTime()
        : undefined,
      endTime: currentSection[currentSection.length - 1]?.timestamp
        ? new Date(currentSection[currentSection.length - 1].timestamp).getTime()
        : undefined,
    });
  }

  // 섹션이 없으면 전체를 하나의 섹션으로
  if (sections.length === 0 && conversations.length > 0) {
    sections.push({
      index: 0,
      conversations: [...conversations],
      imageRefs: conversations
        .map((conv) => conv.imageRef)
        .filter((ref): ref is string => !!ref),
      startTime: conversations[0]?.timestamp
        ? new Date(conversations[0].timestamp).getTime()
        : undefined,
      endTime: conversations[conversations.length - 1]?.timestamp
        ? new Date(conversations[conversations.length - 1].timestamp).getTime()
        : undefined,
    });
  }

  // 각 섹션에 해당하는 이미지 매칭
  for (const section of sections) {
    if (images.length > 0 && section.imageRefs.length === 0) {
      // 이미지 참조가 없으면 전체 이미지 사용 (첫 섹션만)
      if (section.index === 0) {
        section.imageRefs = images.slice(0, 3); // 처음 3개
      } else {
        // 나머지 섹션은 이미지를 균등 분배
        const imagesPerSection = Math.ceil(images.length / sections.length);
        const startIdx = section.index * imagesPerSection;
        const endIdx = Math.min(startIdx + imagesPerSection, images.length);
        section.imageRefs = images.slice(startIdx, endIdx);
      }
    } else if (section.imageRefs.length > 0) {
      // 이미지 참조가 있으면 실제 이미지 URL과 매칭
      section.imageRefs = images.filter((img) =>
        section.imageRefs.some((ref) => img.includes(ref) || ref.includes(img.split('/').pop() || ''))
      );
    }
  }

  return sections;
}

/**
 * 섹션별 STT 텍스트 생성
 */
export function getSectionSttText(section: Section): string {
  return section.conversations
    .map((conv) => `[${conv.speaker}]: ${conv.text}`)
    .join('\n');
}

