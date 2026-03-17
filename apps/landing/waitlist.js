(() => {
  var supabaseUrl = "https://rwnewsjvphqqzhdunwll.supabase.co";
  var anonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3bmV3c2p2cGhxcXpoZHVud2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODA5MzIsImV4cCI6MjA4Nzk1NjkzMn0.wmPXL_GUjz_lO7ft4hLZQNwHtJSSgBMhGXALZubn9zE";

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

    fetch(`${supabaseUrl}/rest/v1/waitlist_emails`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
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
