(function () {
  var header = document.getElementById("header");
  if (header) {
    function onScroll() {
      if (window.scrollY > 24) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  var copyBtn = document.querySelector(".copy-email-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var email = copyBtn.getAttribute("data-email");
      if (!email) return;
      var original = copyBtn.textContent;
      function done() {
        copyBtn.textContent = "Copied";
        copyBtn.disabled = true;
        window.setTimeout(function () {
          copyBtn.textContent = original;
          copyBtn.disabled = false;
        }, 2000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done).catch(function () {
          fallbackCopy(email, done);
        });
      } else {
        fallbackCopy(email, done);
      }
    });
  }

  function fallbackCopy(text, onOk) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      if (document.execCommand("copy")) onOk();
    } catch (e) {
      /* ignore */
    }
    document.body.removeChild(ta);
  }

  var waitlistForm = document.getElementById("hero-waitlist-form");
  if (waitlistForm) {
    waitlistForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("waitlist-email");
      if (!input) return;
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
      var btn = waitlistForm.querySelector(".hero-waitlist-submit");
      if (btn) {
        btn.textContent = "You are in";
        btn.disabled = true;
      }
      input.disabled = true;
      var ok = document.getElementById("hero-waitlist-success");
      if (ok) ok.hidden = false;
    });
  }
})();
