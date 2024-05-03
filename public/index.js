document.addEventListener("DOMContentLoaded", function() {
  liff.init({ liffId:  "2004698497-4e8mJBR3" }).then(() => {
    if (liff.isLoggedIn()) {
      liff.getProfile().then(profile => {
        const userId = profile.userId;
        fetch(`/fetchDreams?userId=${userId}`)
        .then(response => response.json())
        .then(dreams => {
          const container = document.getElementById('dreamsContainer');
          dreams.forEach(dream => {
            const div = document.createElement('div');
            div.textContent = dream.content;
            container.appendChild(div);
          });
        });
      });
    } else {
      liff.login();
    }
  }).catch(err => {
    console.error('LIFF Initialization failed', err);
  });
});