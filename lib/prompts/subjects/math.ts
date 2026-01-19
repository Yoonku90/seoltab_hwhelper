export const MATH_SUBJECT_GUIDE = [
  `**수학 과목 요약 요구사항 (매우 중요):**
  - 수학 과목은 방금 끝난 수업에서 다룬 핵심 개념을 요약하는 것이 주요 목적입니다.
  - 개념 설명이 없이 문제 풀이만 진행 된 수업이더라도 핵심 개념을 요약해서 정리합니다. (핵심 정의/공식/성질을 먼저 정리)
  - 각 개념을 간결하게, 하지만 이해할 수 있게 설명 (너무 짧지 않게, 너무 길지 않게)
  - 계산 과정은 한두 단계로 요약하고, 실수할 수 있는 포인트(부호/분모/괄호) 강조
  - 기하/도형이면 도형 성질과 보조선/각 관계 중심으로 정리
  - 수학 과목 시각 자료 생성 특별 지침을 참고하여 정리된 핵심 정리 개념을 바탕으로 도형, 그래프와 함께 보며 이해할 수 있도록 핵심 정리 설명과 일치하는 시각 자료 생성
  
  ========================================
  수학 과목 시각 자료 생성 특별 지침 (매우 중요)
  ========================================
  
  **VisualAidRenderer 배열 생성 필수:**
  - 수업에서 다룬 **도형, 그래프, 좌표계, 기하 도형**이 있으면 핵심 정리 각 섹션을 설명할 수 있는 도형 또는 그래프를 반드시 **VisualAidRenderer 배열**에 JSON 형태로 포함
  - **중요: VisualAidRenderer는 문제를 만드는 것이 아니라, 핵심 정리 내용을 시각적으로 보조하는 자료입니다**
  - 그래프/함수가 다뤄졌으면 type: "graph" 형식으로 포함 (함수식, 범위, 특정점 포함)
  - 도형/기하가 다뤄졌으면 type: "geometry" 형식으로 포함 (shapes 배열, annotations 배열 포함)
  - detailedContent에서 넘버링된 섹션(1., 2., 3. 등) 각각에 해당하는 도형/그래프를 배열에 포함
  - **VisualAidRenderer는 빈 배열 []이 아니라, 실제 도형/그래프가 있으면 반드시 JSON 객체 배열로 포함해야 합니다**
  - 수업에서 도형/그래프가 전혀 다뤄지지 않았을 때만 빈 배열 []을 사용
  
  **도형/그래프 JSON 형식:**
  - 도형: type, shapes(도형 배열), annotations(주석 배열)
  - 그래프: type, function(함수식), xRange, yRange, specialPoints
  - 좌표는 상대 좌표로 표현 (예: [[0, 0], [100, 0], [50, 86.6]])
  - function은 정확한 수식으로 (파싱 가능하게)
  - shapes는 배열로 여러 도형 조합 가능
  - annotations로 치수, 각도, 레이블 추가
  - question, choices, answer는 선택사항 (수업에서 실제 문제를 풀었을 때만 포함)
  
  ========================================
  VisualAidRenderer 도형/그래프 JSON 예시 (형식을 참고해 핵심 개념 정리를 보조하는 시각자료를 생성)
  ========================================
  
  [원의 구조 예시]
  {
    "name": "원의 구조",
    "type": "geometry",
    "shapes": [
      {"type": "circle", "center": [150, 150], "radius": 80, "stroke": "#3b82f6", "strokeWidth": 3, "fill": "rgba(59, 130, 246, 0.1)"},
      {"type": "line", "points": [[150, 150], [230, 150]], "stroke": "#ef4444", "strokeWidth": 3, "label": "반지름 r"},
      {"type": "line", "points": [[70, 150], [230, 150]], "stroke": "#10b981", "strokeWidth": 3, "strokeDasharray": "5,5", "label": "지름 d"},
      {"type": "circle", "center": [150, 150], "radius": 5, "fill": "#1e293b"}
    ],
    "annotations": [
      {"type": "text", "position": [150, 135], "text": "O", "fontSize": 18, "color": "#1e293b", "fontWeight": "bold"},
      {"type": "text", "position": [190, 165], "text": "r = 5cm", "fontSize": 16, "color": "#ef4444"},
      {"type": "text", "position": [150, 65], "text": "둘레 = 2πr", "fontSize": 16, "color": "#3b82f6", "fontWeight": "bold"},
      {"type": "text", "position": [150, 250], "text": "넓이 = πr²", "fontSize": 16, "color": "#3b82f6", "fontWeight": "bold"}
    ]
  }
  
  [삼각함수 - 직각삼각형 예시]
  {
    "name": "삼각함수 - 직각삼각형",
    "type": "geometry",
    "shapes": [
      {"type": "polygon", "points": [[80, 220], [80, 100], [260, 220]], "fill": "rgba(59, 130, 246, 0.1)", "stroke": "#3b82f6", "strokeWidth": 3},
      {"type": "line", "points": [[80, 220], [80, 100]], "stroke": "#ef4444", "strokeWidth": 4, "label": "높이(대변)"},
      {"type": "line", "points": [[80, 220], [260, 220]], "stroke": "#10b981", "strokeWidth": 4, "label": "밑변(인접변)"},
      {"type": "line", "points": [[80, 100], [260, 220]], "stroke": "#8b5cf6", "strokeWidth": 4, "label": "빗변"}
    ],
    "annotations": [
      {"type": "text", "position": [60, 160], "text": "6", "fontSize": 20, "color": "#ef4444", "fontWeight": "bold"},
      {"type": "text", "position": [170, 235], "text": "8", "fontSize": 20, "color": "#10b981", "fontWeight": "bold"},
      {"type": "text", "position": [180, 150], "text": "10", "fontSize": 20, "color": "#8b5cf6", "fontWeight": "bold"},
      {"type": "arc", "center": [260, 220], "radius": 35, "startAngle": 180, "endAngle": 217, "label": "θ"},
      {"type": "rightAngleMarker", "position": [80, 220], "size": 20},
      {"type": "text", "position": [150, 60], "text": "sin θ = 대변/빗변", "fontSize": 16, "color": "#1e293b", "fontWeight": "bold"},
      {"type": "text", "position": [150, 80], "text": "cos θ = 인접변/빗변", "fontSize": 16, "color": "#1e293b", "fontWeight": "bold"},
      {"type": "text", "position": [150, 100], "text": "tan θ = 대변/인접변", "fontSize": 16, "color": "#1e293b", "fontWeight": "bold"}
    ]
  }
  
  [삼각함수 - 단위원 예시]
  {
    "name": "삼각함수 - 단위원",
    "type": "geometry",
    "shapes": [
      {"type": "circle", "center": [150, 150], "radius": 80, "stroke": "#3b82f6", "strokeWidth": 2, "fill": "none"},
      {"type": "line", "points": [[70, 150], [230, 150]], "stroke": "#6b7280", "strokeWidth": 1, "strokeDasharray": "3,3"},
      {"type": "line", "points": [[150, 70], [150, 230]], "stroke": "#6b7280", "strokeWidth": 1, "strokeDasharray": "3,3"},
      {"type": "line", "points": [[150, 150], [219.3, 110]], "stroke": "#ef4444", "strokeWidth": 3},
      {"type": "line", "points": [[219.3, 110], [219.3, 150]], "stroke": "#10b981", "strokeWidth": 3, "strokeDasharray": "5,5", "label": "sin θ"},
      {"type": "line", "points": [[150, 150], [219.3, 150]], "stroke": "#8b5cf6", "strokeWidth": 3, "strokeDasharray": "5,5", "label": "cos θ"},
      {"type": "circle", "center": [219.3, 110], "radius": 4, "fill": "#ef4444"}
    ],
    "annotations": [
      {"type": "text", "position": [235, 125], "text": "sin 30°", "fontSize": 14, "color": "#10b981", "fontWeight": "bold"},
      {"type": "text", "position": [180, 165], "text": "cos 30°", "fontSize": 14, "color": "#8b5cf6", "fontWeight": "bold"},
      {"type": "text", "position": [175, 125], "text": "1", "fontSize": 14, "color": "#ef4444"},
      {"type": "arc", "center": [150, 150], "radius": 30, "startAngle": 0, "endAngle": 30, "label": "30°"},
      {"type": "text", "position": [150, 50], "text": "단위원 (반지름 = 1)", "fontSize": 14, "color": "#3b82f6", "fontWeight": "bold"}
    ]
  }
  
  [원기둥의 구조 예시]
  {
    "name": "원기둥의 구조",
    "type": "geometry",
    "shapes": [
      {"type": "ellipse", "center": [150, 80], "rx": 70, "ry": 20, "stroke": "#3b82f6", "strokeWidth": 2, "fill": "rgba(59, 130, 246, 0.2)"},
      {"type": "ellipse", "center": [150, 220], "rx": 70, "ry": 20, "stroke": "#3b82f6", "strokeWidth": 2, "fill": "rgba(59, 130, 246, 0.1)"},
      {"type": "line", "points": [[80, 80], [80, 220]], "stroke": "#3b82f6", "strokeWidth": 2},
      {"type": "line", "points": [[220, 80], [220, 220]], "stroke": "#3b82f6", "strokeWidth": 2},
      {"type": "line", "points": [[150, 220], [220, 220]], "stroke": "#ef4444", "strokeWidth": 3}
    ],
    "annotations": [
      {"type": "text", "position": [185, 235], "text": "r = 5cm", "fontSize": 16, "color": "#ef4444", "fontWeight": "bold"},
      {"type": "text", "position": [150, 50], "text": "부피 = πr²h", "fontSize": 16, "color": "#3b82f6", "fontWeight": "bold"},
      {"type": "text", "position": [150, 260], "text": "겉넓이 = 2πr² + 2πrh", "fontSize": 14, "color": "#6b7280"}
    ]
  }
  [좌표평면 예시]
  {
    "name": "좌표평면과 사분면",
    "type": "geometry",
    "shapes": [
      {"type": "line", "points": [[-200, 0], [200, 0]], "stroke": "#1e293b", "strokeWidth": 2, "arrow": "end"},
      {"type": "line", "points": [[0, -200], [0, 200]], "stroke": "#1e293b", "strokeWidth": 2, "arrow": "end"},
      {"type": "circle", "center": [80, 60], "radius": 5, "fill": "#ef4444"},
      {"type": "circle", "center": [-80, 60], "radius": 5, "fill": "#10b981"},
      {"type": "circle", "center": [-80, -60], "radius": 5, "fill": "#3b82f6"},
      {"type": "circle", "center": [80, -60], "radius": 5, "fill": "#f59e0b"}
    ],
    "annotations": [
      {"type": "text", "position": [210, 0], "text": "x", "fontSize": 20, "color": "#1e293b", "fontWeight": "bold"},
      {"type": "text", "position": [0, -210], "text": "y", "fontSize": 20, "color": "#1e293b", "fontWeight": "bold"},
      {"type": "text", "position": [0, 0], "text": "O", "fontSize": 18, "color": "#1e293b", "offset": [-15, 15]},
      {"type": "text", "position": [80, 60], "text": "A(4, 3)", "fontSize": 14, "color": "#ef4444", "offset": [10, -10]},
      {"type": "text", "position": [-80, 60], "text": "B(-4, 3)", "fontSize": 14, "color": "#10b981", "offset": [-50, -10]},
      {"type": "text", "position": [-80, -60], "text": "C(-4, -3)", "fontSize": 14, "color": "#3b82f6", "offset": [-60, 10]},
      {"type": "text", "position": [80, -60], "text": "D(4, -3)", "fontSize": 14, "color": "#f59e0b", "offset": [10, 10]},
      {"type": "text", "position": [60, 100], "text": "제1사분면", "fontSize": 16, "color": "#6b7280", "opacity": 0.7},
      {"type": "text", "position": [-60, 100], "text": "제2사분면", "fontSize": 16, "color": "#6b7280", "opacity": 0.7},
      {"type": "text", "position": [-60, -100], "text": "제3사분면", "fontSize": 16, "color": "#6b7280", "opacity": 0.7},
      {"type": "text", "position": [60, -100], "text": "제4사분면", "fontSize": 16, "color": "#6b7280", "opacity": 0.7}
    ]
  }
  [일차함수 예시]
  {
    "name": "일차함수 - 기울기와 절편",
    "type": "graph",
    "function": "y = 2x + 3",
    "xRange": [-2, 4],
    "yRange": [-2, 12],
    "xLabel": "x",
    "yLabel": "y",
    "specialPoints": [
      {"x": 0, "y": 3, "label": "y절편 (0, 3)", "color": "#ef4444"},
      {"x": 1, "y": 5, "label": "(1, 5)", "color": "#3b82f6"},
      {"x": 2, "y": 7, "label": "(2, 7)", "color": "#3b82f6"}
    ],
    "gridLines": true,
    "showSlope": true,
    "annotations": [
      {"type": "text", "position": "top-right", "text": "기울기 = 2", "fontSize": 16, "color": "#10b981", "fontWeight": "bold"},
      {"type": "text", "position": "top-right", "text": "y절편 = 3", "fontSize": 16, "color": "#ef4444", "fontWeight": "bold"},
      {"type": "arrow", "from": [1, 5], "to": [2, 7], "label": "x가 1 증가 → y가 2 증가", "color": "#10b981"}
    ]
  }
  [이차함수 그래프 예시]
  {
    "name": "이차함수 그래프",
    "type": "graph",
    "function": "y = -x² + 4x + 5",
    "xRange": [-1, 6],
    "yRange": [0, 12],
    "xLabel": "x",
    "yLabel": "y",
    "specialPoints": [
      {"x": 2, "y": 9, "label": "꼭짓점 (2, 9)", "color": "#ef4444"}
    ],
    "gridLines": true,
    "showVertex": true
  }
  [미분 예시]
  {
    "name": "미분 - 접선의 기울기",
    "type": "graph",
    "function": "y = x²",
    "xRange": [-2, 4],
    "yRange": [-1, 10],
    "xLabel": "x",
    "yLabel": "y",
    "specialPoints": [
      {"x": 2, "y": 4, "label": "P(2, 4)", "color": "#ef4444"}
    ],
    "gridLines": true,
    "tangentLines": [
      {"x": 2, "slope": 4, "color": "#10b981", "strokeWidth": 3, "label": "접선"}
    ],
    "annotations": [
      {"type": "text", "position": "top-right", "text": "f(x) = x²", "fontSize": 18, "color": "#3b82f6", "fontWeight": "bold"},
      {"type": "text", "position": "top-right", "text": "f'(x) = 2x", "fontSize": 16, "color": "#10b981", "fontWeight": "bold"},
      {"type": "text", "position": "top-right", "text": "x=2에서 접선의 기울기 = f'(2) = 4", "fontSize": 14, "color": "#ef4444"},
      {"type": "arrow", "from": [1.5, 2.25], "to": [2, 4], "label": "Δx → 0", "color": "#6b7280", "strokeDasharray": "3,3"}
    ]
  }
  [적분 예시]
  {
    "name": "적분 - 곡선과 x축 사이의 넓이",
    "type": "graph",
    "function": "y = -x² + 4",
    "xRange": [-3, 3],
    "yRange": [-1, 5],
    "xLabel": "x",
    "yLabel": "y",
    "specialPoints": [
      {"x": -2, "y": 0, "label": "(-2, 0)", "color": "#ef4444"},
      {"x": 2, "y": 0, "label": "(2, 0)", "color": "#ef4444"},
      {"x": 0, "y": 4, "label": "(0, 4)", "color": "#3b82f6"}
    ],
    "gridLines": true,
    "shadedArea": {
      "from": -2,
      "to": 2,
      "color": "rgba(59, 130, 246, 0.3)",
      "label": "넓이 S"
    },
    "annotations": [
      {"type": "text", "position": "top-center", "text": "∫₋₂² (-x² + 4) dx", "fontSize": 18, "color": "#3b82f6", "fontWeight": "bold"},
      {"type": "text", "position": "center", "text": "S = 32/3", "fontSize": 20, "color": "#ef4444", "fontWeight": "bold"},
      {"type": "verticalLine", "x": -2, "color": "#ef4444", "strokeDasharray": "3,3"},
      {"type": "verticalLine", "x": 2, "color": "#ef4444", "strokeDasharray": "3,3"}
    ]
  }
  [직선의 방정식 예시]
  {
    "name": "두 점을 지나는 직선",
    "type": "geometry",
    "shapes": [
      {"type": "line", "points": [[-150, 0], [200, 0]], "stroke": "#6b7280", "strokeWidth": 1, "arrow": "end"},
      {"type": "line", "points": [[0, -150], [0, 200]], "stroke": "#6b7280", "strokeWidth": 1, "arrow": "end"},
      {"type": "line", "points": [[-100, -80], [150, 140]], "stroke": "#3b82f6", "strokeWidth": 3},
      {"type": "circle", "center": [-50, -20], "radius": 5, "fill": "#ef4444"},
      {"type": "circle", "center": [100, 100], "radius": 5, "fill": "#ef4444"},
      {"type": "line", "points": [[-50, -20], [100, -20]], "stroke": "#10b981", "strokeWidth": 2, "strokeDasharray": "5,5"},
      {"type": "line", "points": [[100, -20], [100, 100]], "stroke": "#f59e0b", "strokeWidth": 2, "strokeDasharray": "5,5"}
    ],
    "annotations": [
      {"type": "text", "position": [-50, -20], "text": "A(-2, -1)", "fontSize": 14, "color": "#ef4444", "offset": [-60, 0]},
      {"type": "text", "position": [100, 100], "text": "B(4, 5)", "fontSize": 14, "color": "#ef4444", "offset": [10, -10]},
      {"type": "text", "position": [25, -35], "text": "Δx = 6", "fontSize": 14, "color": "#10b981"},
      {"type": "text", "position": [115, 40], "text": "Δy = 6", "fontSize": 14, "color": "#f59e0b"},
      {"type": "text", "position": [0, -170], "text": "기울기 = Δy/Δx = 6/6 = 1", "fontSize": 16, "color": "#3b82f6", "fontWeight": "bold"},
      {"type": "text", "position": [0, 220], "text": "y - (-1) = 1(x - (-2))", "fontSize": 14, "color": "#1e293b"}
    ]
  }
  `
  ].join('\n'); 