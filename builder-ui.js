(function builderUiHelpers() {
  function initShell(options = {}) {
    const shell = document.getElementById(options.shellId);
    const toggle = document.getElementById(options.toggleId);
    if (!shell || !toggle) return { refresh() {} };
    const key = options.storageKey || `${options.shellId}Collapsed`;
    let collapsed = localStorage.getItem(key) === 'true';
    if (window.matchMedia('(max-width: 720px)').matches && localStorage.getItem(key) === null) collapsed = true;

    const apply = () => {
      shell.classList.toggle('sidebar-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Open builder outline' : 'Collapse builder outline');
      toggle.innerHTML = sidebarIcon(collapsed);
    };
    toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      localStorage.setItem(key, String(collapsed));
      apply();
    });
    apply();
    return { refresh: apply };
  }

  function initInfoTips(root = document) {
    const eventRoot = root.ownerDocument || root;
    const closeAll = except => root.querySelectorAll('.cmcInfoTip[aria-expanded="true"]').forEach(button => {
      if (button !== except) button.setAttribute('aria-expanded', 'false');
    });
    root.querySelectorAll('.cmcInfoTip').forEach(button => {
      if (button.dataset.infoReady) return;
      button.dataset.infoReady = 'true';
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const open = button.getAttribute('aria-expanded') === 'true';
        closeAll(button);
        button.setAttribute('aria-expanded', String(!open));
      });
    });
    if (!eventRoot.documentElement?.dataset.infoTipsReady) {
      eventRoot.documentElement.dataset.infoTipsReady = 'true';
      eventRoot.addEventListener('click', () => eventRoot.querySelectorAll('.cmcInfoTip[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false')));
      eventRoot.addEventListener('keydown', event => {
        if (event.key === 'Escape') eventRoot.querySelectorAll('.cmcInfoTip[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
      });
    }
  }

  function sidebarIcon(collapsed) {
    return collapsed
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"></rect><path d="M8.5 4v16M13 9l3 3-3 3"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"></rect><path d="M8.5 4v16M16 9l-3 3 3 3"></path></svg>';
  }

  window.CMCBuilderUI = { initShell, initInfoTips };
})();
