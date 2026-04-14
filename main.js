(function () {
  var cfg = window.__BUILDBET_SUPABASE || {};
  var SUPABASE_URL = cfg.url || "";
  var SUPABASE_ANON_KEY = cfg.anonKey || "";

  /* In-app browsers (e.g. Threads) sometimes report a wide layout width while the visible
   * area is narrow. Use the smallest of visual/layout widths so the hero stays stacked when needed. */
  function syncLayoutCompact() {
    var root = document.documentElement;
    var vv = window.visualViewport;
    var vw =
      vv && typeof vv.width === "number" && vv.width > 0 ? vv.width : window.innerWidth || 0;
    var iw = window.innerWidth || vw;
    var cw = root.clientWidth || iw;
    var smallest = Math.min(vw, iw, cw);
    if (smallest > 0) {
      root.classList.toggle("layout-compact", smallest < 720);
    }
  }
  syncLayoutCompact();
  window.addEventListener("resize", syncLayoutCompact, { passive: true });
  window.addEventListener("orientationchange", syncLayoutCompact, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncLayoutCompact, { passive: true });
    window.visualViewport.addEventListener("scroll", syncLayoutCompact, { passive: true });
  }

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

  function waitlistConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  function normalizeEmail(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase();
  }

  function waitlistFailureMessage(status, pgCode) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "You appear to be offline. Reconnect and try again.";
    }
    if (status === 401) {
      return "Signup was rejected. Check your Supabase URL and anon key in .env, run npm run env:gen, and refresh.";
    }
    if (status === 403 || pgCode === "42501") {
      return "Signup was blocked. In Supabase, allow insert on waitlist_signups for the anon role (see supabase-waitlist.sql).";
    }
    if (status === 404) {
      return "Waitlist table was not found. Create waitlist_signups in Supabase (see supabase-waitlist.sql).";
    }
    if (status >= 500) {
      return "The signup service had a problem. Try again in a few minutes.";
    }
    return "We could not add you to the waitlist. Please try again.";
  }

  function waitlistInsert(email) {
    var base = String(SUPABASE_URL).replace(/\/+$/, "");
    return fetch(base + "/rest/v1/waitlist_signups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ email: email }),
    })
      .then(function (res) {
        if (res.ok || res.status === 201 || res.status === 204) {
          return { ok: true };
        }
        return res.text().then(function (text) {
          var code;
          try {
            var j = JSON.parse(text);
            if (j && j.code != null) code = String(j.code);
            if (!code && Array.isArray(j) && j[0] && j[0].code != null) {
              code = String(j[0].code);
            }
          } catch (err) {
            /* ignore */
          }
          if (res.status === 409 || code === "23505") {
            return { ok: true, duplicate: true };
          }
          return {
            ok: false,
            message: waitlistFailureMessage(res.status, code),
          };
        });
      })
      .catch(function () {
        return {
          ok: false,
          message:
            "We could not reach the signup server. Check your connection and try again.",
        };
      });
  }

  function waitlistShowFailure(waitlistForm, btn, input, errEl, message) {
    if (waitlistForm) waitlistForm.classList.add("is-error");
    if (btn) {
      btn.textContent = "Try again";
      btn.disabled = false;
      btn.setAttribute("aria-describedby", "hero-waitlist-error");
    }
    if (input) input.disabled = false;
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
      if (typeof errEl.scrollIntoView === "function") {
        errEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }

  function waitlistClearFailure(waitlistForm, btn) {
    if (waitlistForm) waitlistForm.classList.remove("is-error");
    if (btn) btn.removeAttribute("aria-describedby");
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
      var email = normalizeEmail(input.value);
      var btn = waitlistForm.querySelector(".hero-waitlist-submit");
      var okEl = document.getElementById("hero-waitlist-success");
      var errEl = document.getElementById("hero-waitlist-error");
      waitlistClearFailure(waitlistForm, btn);
      if (okEl) okEl.hidden = true;
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = "";
      }

      if (!waitlistConfigured()) {
        waitlistShowFailure(
          waitlistForm,
          btn,
          input,
          errEl,
          "Waitlist is not connected. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env, run npm run env:gen, and refresh this page."
        );
        return;
      }

      if (btn) {
        btn.textContent = "Joining…";
        btn.disabled = true;
      }
      if (input) input.disabled = true;

      waitlistInsert(email).then(function (result) {
        if (result && result.ok) {
          waitlistClearFailure(waitlistForm, btn);
          if (btn) {
            btn.textContent = "You are in";
            btn.disabled = true;
          }
          if (input) input.disabled = true;
          if (okEl) okEl.hidden = false;
          return;
        }
        var msg =
          (result && result.message) ||
          "We could not add you to the waitlist. Please try again.";
        waitlistShowFailure(waitlistForm, btn, input, errEl, msg);
      });
    });
  }
})();
