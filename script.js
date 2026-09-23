const menuBtn=document.querySelector('.menu-btn');
const nav=document.querySelector('.main-nav');
menuBtn?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuBtn.setAttribute('aria-expanded',open)});
document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('show');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
document.getElementById('year').textContent=new Date().getFullYear();

// 카카오톡 플로팅 버튼 자동 생성
document.addEventListener('DOMContentLoaded', function() {
  const kakaoBtn = document.createElement('a');
  kakaoBtn.href = 'https://open.kakao.com/o/gcueGWOi';
  kakaoBtn.target = '_blank';
  kakaoBtn.rel = 'noopener noreferrer';
  kakaoBtn.className = 'kakao-chat-box';
  kakaoBtn.setAttribute('aria-label', '카카오톡 문의하기');
  kakaoBtn.innerHTML = `
    <svg class="kakao-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3C6.477 3 2 6.477 2 10.765c0 2.758 1.848 5.172 4.636 6.55-.205.76-.745 2.75-.853 3.17-.132.518.19.512.4.373.165-.11 2.643-1.79 3.708-2.514.686.096 1.393.146 2.109.146 5.523 0 10-3.477 10-7.765C22 6.477 17.523 3 12 3z" fill="#191919"/>
    </svg>
    <span>카톡 문의</span>
  `;
  document.body.appendChild(kakaoBtn);
});
