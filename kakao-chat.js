document.addEventListener("DOMContentLoaded", function () {
  const kakaoBtn = document.createElement("a");
  kakaoBtn.href = "https://pf.kakao.com/_여기채널아이디/chat"; // 실제 카카오톡 링크
  kakaoBtn.target = "_blank";
  kakaoBtn.rel = "noopener noreferrer";
  kakaoBtn.className = "kakao-chat-box";
  kakaoBtn.setAttribute("aria-label", "카카오톡 문의하기");
  
  kakaoBtn.innerHTML = `
    <svg class="kakao-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.477 2 10.766c0 2.766 1.808 5.188 4.548 6.574-.2.734-.725 2.66-.83 3.064-.132.512.188.505.394.368.163-.108 2.593-1.758 3.636-2.468.733.108 1.488.164 2.252.164 5.523 0 10-3.477 10-7.766C22 6.477 17.523 3 12 3z"/>
    </svg>
    <span>카카오톡 문의</span>
  `;

  document.body.appendChild(kakaoBtn);
});
