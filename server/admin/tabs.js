// The admin page's tabs: one part of the page at a time, the one picked kept
// in the address (#players, say) so a reload or a bookmark opens it again.
// A part can have tabs of its own (CTB's), a level deeper in the address
// (#ctb/runs); its first is left out of it, as the page's overview is.
// A part with nothing to show is hidden by its own code (its section's hidden
// attribute); its tab hides with it, and while it is gone the page shows the
// first part there, going back to the part picked once it is there again. A
// part's own tabs hide altogether while only one of them is left.
export function setUpTabs() {
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
  const lists = [...document.querySelectorAll('[role="tablist"]')].map((nav) => {
    const outer = nav.parentElement.closest('[role="tabpanel"]');
    const parent = outer && document.querySelector(`[role="tab"][aria-controls="${outer.id}"]`);
    const prefix = parent ? `${parent.id}-` : 'tab-';
    return { nav, parent, tabs: [...nav.querySelectorAll('[role="tab"]')], nameOf: (tab) => tab.id.slice(prefix.length), wanted: '', current: null };
  });
  const top = lists.find((l) => !l.parent);
  const shownIn = (l) => l.tabs.filter((t) => !t.hidden);

  const read = () => {
    const [part = '', sub = ''] = location.hash.slice(1).split('/');
    for (const l of lists) {
      if (!l.parent) l.wanted = part;
      else if (top.nameOf(l.parent) === part) l.wanted = sub;
    }
  };

  const show = () => {
    for (const l of lists) {
      for (const tab of l.tabs) tab.hidden = panelOf(tab).hidden;
      const shown = shownIn(l);
      l.current = shown.find((t) => l.nameOf(t) === l.wanted) ?? shown[0] ?? l.tabs[0];
      if (l.parent) l.nav.hidden = shown.length < 2;
      for (const tab of l.tabs) {
        const on = tab === l.current;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        panelOf(tab).classList.toggle('active', on);
      }
    }
  };

  // On a narrow screen a row of tabs scrolls sideways: the one picked in sight.
  const reveal = () => {
    for (const l of lists) {
      const [row, tab] = [l.nav.getBoundingClientRect(), l.current.getBoundingClientRect()];
      if (tab.left < row.left || tab.right > row.right) l.nav.scrollLeft += tab.left - row.left - 16;
    }
  };

  const address = () => {
    if (top.current === top.tabs[0]) return location.pathname;
    const sub = lists.find((l) => l.parent === top.current);
    return `#${top.nameOf(top.current)}${sub && sub.current !== shownIn(sub)[0] ? `/${sub.nameOf(sub.current)}` : ''}`;
  };

  const pick = (l, tab, focus = false) => {
    l.wanted = l.nameOf(tab);
    if (l.parent) top.wanted = top.nameOf(l.parent);
    show();
    history.replaceState(null, '', address());
    reveal();
    if (focus) tab.focus();
    scrollTo(0, 0);
  };

  for (const l of lists) {
    for (const tab of l.tabs) {
      tab.addEventListener('click', () => pick(l, tab));
      // Arrow keys, Home and End move between the tabs shown, as in any tab list.
      tab.addEventListener('keydown', (e) => {
        const shown = shownIn(l);
        const at = shown.indexOf(tab);
        const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: shown.length - 1 }[e.key];
        if (to === undefined) return;
        e.preventDefault();
        pick(l, shown[(to + shown.length) % shown.length], true);
      });
    }
  }
  const update = () => {
    show();
    reveal();
  };
  addEventListener('hashchange', () => {
    read();
    update();
  });
  const watch = new MutationObserver(update);
  for (const l of lists) for (const tab of l.tabs) watch.observe(panelOf(tab), { attributes: true, attributeFilter: ['hidden'] });
  read();
  update();
}
