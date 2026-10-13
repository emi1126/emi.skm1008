(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var header = document.querySelector(".site-header");
  var nav = document.getElementById("site-nav");
  var menuBtn = document.querySelector(".menu-btn");
  var menuLabel = menuBtn.querySelector(".menu-label");
  var desktopNav = window.matchMedia("(min-width: 981px)");

  document.documentElement.classList.add("has-js");
  if (!reduce) document.documentElement.classList.add("js");

  function setMenu(open) {
    var mobile = !desktopNav.matches;
    if (!mobile) open = false;
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuLabel.textContent = open ? "閉じる" : "メニュー";
    menuBtn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    document.body.classList.toggle("nav-open", open);
    if ("inert" in nav) nav.inert = mobile && !open;
    if (open) {
      var first = nav.querySelector("a");
      if (first) first.focus();
    }
  }

  menuBtn.setAttribute("aria-label", "メニューを開く");
  setMenu(false);

  menuBtn.addEventListener("click", function () {
    setMenu(menuBtn.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  desktopNav.addEventListener("change", function () {
    setMenu(false);
  });

  var logo = document.querySelector(".logo");
  logo.addEventListener("click", function (event) {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    setMenu(false);
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  });

  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".site-nav a"));
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var on = link.getAttribute("href") === "#" + entry.target.id;
          if (on) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach(function (section) { spy.observe(section); });

    if (!reduce) {
      var reveal = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          reveal.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      var revealNodes = document.querySelectorAll(".reveal");
      Array.prototype.forEach.call(revealNodes, function (el) {
        reveal.observe(el);
      });
      window.setTimeout(function () {
        Array.prototype.forEach.call(revealNodes, function (el) {
          el.classList.add("is-in");
        });
      }, 2500);
    }
  } else {
    document.documentElement.classList.remove("js");
  }

  function instagramUrl() {
    var raw = window.SITE_CONFIG && window.SITE_CONFIG.instagramUrl;
    if (!raw) return "";
    var value = String(raw).trim();
    try {
      var url = new URL(value);
      var host = url.hostname.toLowerCase();
      if (url.protocol === "https:" && (host === "instagram.com" || host === "www.instagram.com")) {
        return url.href;
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  var readyUrl = instagramUrl();
  if (readyUrl) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-instagram-link]"), function (link) {
      link.href = readyUrl;
      link.hidden = false;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-instagram-fallback], [data-instagram-note]"), function (node) {
      node.hidden = true;
    });
  }
})();
