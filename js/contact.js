(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var note = document.getElementById("endpoint-note");
  var alertBox = document.getElementById("contact-alert");
  var success = document.getElementById("contact-success");
  var submitBtn = document.getElementById("contact-submit");
  var hp = document.getElementById("contact-hp");
  var startedAt = Date.now();
  var submitting = false;
  var types = [
    "ホームページ制作について",
    "LP制作について",
    "既存サイトの改善について",
    "AI活用について",
    "SNS運用について",
    "その他"
  ];

  function endpoint() {
    var raw = window.SITE_CONFIG && window.SITE_CONFIG.contactEndpoint;
    if (!raw) return "";
    try {
      var url = new URL(String(raw).trim());
      if (url.protocol !== "https:" || url.hostname !== "script.google.com") return "";
      if (!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(url.pathname)) return "";
      return url.origin + url.pathname.replace(/\/$/, "");
    } catch (error) {
      return "";
    }
  }

  function field(id) {
    return document.getElementById(id);
  }

  function showAlert(message) {
    alertBox.hidden = false;
    alertBox.textContent = message;
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.textContent = "";
  }

  function clearFieldError(input) {
    var error = document.getElementById(input.id + "-error");
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
    if (!error) return;
    error.hidden = true;
    error.textContent = "";
  }

  function showFieldError(input, message) {
    var error = document.getElementById(input.id + "-error");
    input.setAttribute("aria-invalid", "true");
    if (error) {
      input.setAttribute("aria-describedby", error.id);
      error.hidden = false;
      error.textContent = message;
    }
  }

  function clearErrors() {
    hideAlert();
    Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea"), function (input) {
      if (input.type === "hidden" || input.id === "contact-hp") return;
      clearFieldError(input);
    });
  }

  function messageFor(code) {
    if (code === "duplicate") {
      return "同じ内容の送信が続いたため、受け付けられませんでした。時間をおいて、もう一度お試しください。";
    }
    if (code === "headers" || code === "sheet") {
      return "送信先の準備が完了していないため、送信できませんでした。";
    }
    if (code === "validation") {
      return "入力内容を確認してください。";
    }
    return "送信できませんでした。時間をおいて、もう一度お試しください。";
  }

  function validate() {
    var errors = [];
    var name = field("contact-name").value.trim();
    var company = field("contact-business").value.trim();
    var email = field("contact-email").value.trim();
    var category = field("contact-type").value;
    var message = field("contact-message").value.trim();
    var agreed = field("contact-consent").checked;

    if (!name) errors.push(["contact-name", "お名前を入力してください。"]);
    else if (name.length > 80) errors.push(["contact-name", "お名前は80文字以内で入力してください。"]);

    if (company.length > 120) errors.push(["contact-business", "事業者名・屋号は120文字以内で入力してください。"]);

    if (!email) errors.push(["contact-email", "メールアドレスを入力してください。"]);
    else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(["contact-email", "メールアドレスの形式を確認してください。"]);
    }

    if (!category || types.indexOf(category) === -1) {
      errors.push(["contact-type", "お問い合わせ内容を選択してください。"]);
    }

    if (!message) errors.push(["contact-message", "ご相談内容を入力してください。"]);
    else if (message.length > 4000) errors.push(["contact-message", "ご相談内容は4000文字以内で入力してください。"]);

    if (!agreed) errors.push(["contact-consent", "個人情報の取り扱いへの同意が必要です。"]);

    return {
      ok: errors.length === 0,
      errors: errors,
      values: {
        name: name,
        company: company,
        email: email,
        category: category,
        message: message
      }
    };
  }

  function resetButton() {
    submitting = false;
    submitBtn.disabled = !endpoint();
    submitBtn.classList.remove("is-sending");
    submitBtn.textContent = "お問い合わせを送信する";
    form.removeAttribute("aria-busy");
  }

  var readyEndpoint = endpoint();
  if (readyEndpoint) {
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-unavailable");
    var state = submitBtn.querySelector(".btn-state");
    if (state) state.remove();
    if (note) note.hidden = true;
    form.removeAttribute("aria-describedby");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (submitting) return;

    clearErrors();
    var result = validate();
    if (!result.ok) {
      var first = null;
      result.errors.forEach(function (item) {
        var input = field(item[0]);
        if (!input) return;
        showFieldError(input, item[1]);
        if (!first) first = input;
      });
      if (first) first.focus();
      return;
    }

    var target = endpoint();
    if (!target) {
      showAlert("送信先が未設定のため、送信できません。");
      return;
    }

    if (hp && hp.value) {
      showAlert(messageFor("spam"));
      return;
    }

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.classList.add("is-sending");
    submitBtn.textContent = "送信しています…";
    form.setAttribute("aria-busy", "true");

    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, 20000);

    fetch(target, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        name: result.values.name,
        company: result.values.company,
        email: result.values.email,
        category: result.values.category,
        message: result.values.message,
        website: hp ? hp.value : "",
        startedAt: startedAt
      }),
      signal: controller.signal
    }).then(function (response) {
      return response.text().then(function (text) {
        return { okStatus: response.ok, text: text };
      });
    }).then(function (res) {
      var data = null;
      try {
        data = JSON.parse(String(res.text || "").replace(/^\uFEFF/, ""));
      } catch (error) {
        data = null;
      }
      if (!res.okStatus || !data || data.ok !== true) {
        var code = data && data.error ? data.error : "failed";
        throw new Error(code);
      }
      form.hidden = true;
      if (note) note.hidden = true;
      success.hidden = false;
      success.focus();
    }).catch(function (error) {
      var code = error && error.name === "AbortError" ? "timeout" : (error && error.message);
      showAlert(messageFor(code));
      resetButton();
    }).then(function () {
      window.clearTimeout(timer);
    });
  });
})();
