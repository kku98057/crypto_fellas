// HTML 요소 기반 정밀 스크롤 애니메이션 예제
// 각 HTML 요소가 특정 위치에 올 때 정확하게 애니메이션 트리거

/*
사용법:
1. 각 단계마다 HTML 요소에 data-step 속성 부여
2. 각 요소별로 개별 ScrollTrigger 생성
3. start/end를 요소 기준으로 설정 (예: "center center", "bottom top")

장점:
- 브라우저 크기 무관하게 정확한 위치에서 트리거
- 각 HTML 요소의 실제 위치 기반으로 애니메이션
- 디자인 변경 시 유연하게 대응 가능

예시:
```typescript
const step1 = document.querySelector('[data-step="1"]');

ScrollTrigger.create({
  trigger: step1,
  start: "top center",    // 요소의 top이 뷰포트 center에 닿을 때
  end: "bottom center",   // 요소의 bottom이 뷰포트 center에 닿을 때
  scrub: 1,
  onUpdate: (self) => {
    // self.progress는 이 요소의 start ~ end 구간에서 0~1
    const progress = self.progress;
    // 정확한 애니메이션 제어
  }
});
```

start/end 옵션:
- "top top" : 요소 상단이 뷰포트 상단에
- "center center" : 요소 중앙이 뷰포트 중앙에
- "bottom top" : 요소 하단이 뷰포트 상단에
- "top 80%" : 요소 상단이 뷰포트 80% 위치에
- "top+=100px bottom" : 오프셋 추가 가능
*/

export const createElementBasedTriggers = (
  sections: HTMLDivElement[],
  systemRef: any,
  cameraRef: any,
  animConfig: any
) => {
  const triggers: ScrollTrigger[] = [];

  if (sections[1]) {
    // 1. 섹션 전체 Pin
    const mainTrigger = ScrollTrigger.create({
      trigger: sections[1],
      start: "top top",
      end: "+=500%", // 또는 "bottom bottom"
      pin: true,
      id: "section-1-pin",
    });
    triggers.push(mainTrigger);

    // 2. 각 요소별 개별 트리거
    const steps = [
      { selector: '[data-step="1"]', id: "step-1-morph-start" },
      { selector: '[data-step="2"]', id: "step-2-camera-zoom" },
      { selector: '[data-step="3"]', id: "step-3-model-move" },
      { selector: '[data-step="4"]', id: "step-4-complete" },
    ];

    steps.forEach((step, index) => {
      const element = sections[1]?.querySelector(step.selector);

      if (element) {
        const trigger = ScrollTrigger.create({
          trigger: element,
          start: "top center", // 요소가 화면 중앙에 올 때 시작
          end: "bottom center", // 요소가 화면 중앙을 벗어날 때 종료
          scrub: 1,
          id: step.id,
          onUpdate: (self) => {
            const progress = self.progress; // 이 요소의 진행도 (0~1)

            // 각 단계별 애니메이션 로직
            if (index === 0) {
              // Step 1: Morphing Start
              systemRef.current?.setInfluences?.([progress * 0.3, 0]);
            } else if (index === 1) {
              // Step 2: Camera Zoom
              const easedProgress = gsap.parseEase("power2.in")(progress);
              systemRef.current?.setInfluences?.([
                0.3 + easedProgress * 0.4,
                0,
              ]);

              if (cameraRef.current) {
                const cameraZ =
                  animConfig.cameraZoomStart -
                  easedProgress *
                    (animConfig.cameraZoomStart - animConfig.cameraZoomEnd) *
                    0.5;
                cameraRef.current.position.z = cameraZ;
              }
            } else if (index === 2) {
              // Step 3: Model Move
              const easedProgress = gsap.parseEase("power2.out")(progress);
              systemRef.current?.setInfluences?.([
                0.7 + easedProgress * 0.25,
                0,
              ]);

              systemRef.current?.setModelOffset?.([
                animConfig.offsetX * 0.3 +
                  easedProgress * animConfig.offsetX * 0.5,
                easedProgress * animConfig.offsetY * 0.7,
                0,
              ]);
            } else if (index === 3) {
              // Step 4: Complete
              const easedProgress = gsap.parseEase("power1.out")(progress);
              systemRef.current?.setInfluences?.([
                0.95 + easedProgress * 0.05,
                0,
              ]);

              if (cameraRef.current) {
                cameraRef.current.position.z = animConfig.cameraZoomEnd;
              }
            }
          },
          onEnter: () => console.log(`🎯 ${step.id} 활성`),
          markers: false, // true로 변경하면 트리거 라인 표시
        });

        triggers.push(trigger);
      }
    });
  }

  return triggers;
};
