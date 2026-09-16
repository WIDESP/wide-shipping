// app.mjs - 포워딩 적재 계산기 로직

document.addEventListener('DOMContentLoaded', () => {
  console.log('Load Planner System Initialized');

  // 1. 홈페이지 헤더 모바일 메뉴 동작
  initHeaderMenu();

  // 2. 입력값 변경 감지 (이벤트 위임 방식으로 동적 입력창도 자동 감지)
  document.body.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') {
      calculateLoad();
    }
  });

  // 적재 계산 실행 함수
  function calculateLoad() {
    console.log('Calculating cargo dimensions and load plan...');
    // TODO: 상세 적재 계산 로직
  }

  // 상단 헤더 모바일 메뉴 토글 함수
  function initHeaderMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');

    if (menuToggle && mainNav) {
      menuToggle.addEventListener('click', () => {
        const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
        menuToggle.setAttribute('aria-expanded', !isExpanded);
        menuToggle.classList.toggle('active');
        mainNav.classList.toggle('active');
      });
    }
  }
});
