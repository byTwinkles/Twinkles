/* Mobile nav toggle — progressive enhancement, no dependencies */
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.setAttribute("data-open", open ? "true" : "false");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Close" : "Menu";
  }
  setOpen(false);

  toggle.addEventListener("click", function () {
    setOpen(nav.getAttribute("data-open") !== "true");
  });

  // close on nav link click (mobile)
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") setOpen(false);
  });

  // close on escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });
})();
