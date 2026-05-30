(() => {
  var form = document.querySelector(".waitlist-form");
  var locale = form.getAttribute("data-locale");
  var msgSuccess = form.getAttribute("data-msg-success");
  var msgDuplicate = form.getAttribute("data-msg-duplicate");
  var msgError = form.getAttribute("data-msg-error");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    var email = form.querySelector('input[type="email"]').value.trim();
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;

    fetch("/api/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email, locale: locale }),
    })
      .then((res) => {
        if (res.status === 201) {
          form.innerHTML = `<p class="waitlist-success">${msgSuccess}</p>`;
        } else if (res.status === 409) {
          form.innerHTML = `<p class="waitlist-success">${msgDuplicate}</p>`;
        } else {
          btn.disabled = false;
          alert(msgError);
        }
      })
      .catch(() => {
        btn.disabled = false;
        alert(msgError);
      });
  });
})();
