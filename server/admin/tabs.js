// The admin page's tabs: one part of the page at a time, the one picked kept
// in the address (#players, say) so a reload or a bookmark opens it again.
// A part with nothing to show is hidden by its own code (its section's hidden
// attribute); its tab hides with it, and while it is gone the page shows the
// overview, going back to the part picked once it is there again.
export function setUpTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
  const nameOf = (tab) => tab.id.slice('tab-'.length);
  let wanted = location.hash.slice(1);

  const show = () => {
    for (const tab of tabs) tab.hidden = panelOf(tab).hidden;
    const current = tabs.find((t) => nameOf(t) === wanted && !t.hidden) ?? tabs[0];
    for (const tab of tabs) {
      const on = tab === current;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panelOf(tab).classList.toggle('active', on);
    }
  };

  const pick = (tab, focus = false) => {
    wanted = nameOf(tab);
    history.replaceState(null, '', wanted === nameOf(tabs[0]) ? location.pathname : `#${wanted}`);
    show();
    if (focus) tab.focus();
    scrollTo(0, 0);
  };

  for (const tab of tabs) {
    tab.addEventListener('click', () => pick(tab));
    // Arrow keys, Home and End move between the tabs shown, as in any tab list.
    tab.addEventListener('keydown', (e) => {
      const shown = tabs.filter((t) => !t.hidden);
      const at = shown.indexOf(tab);
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: shown.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      pick(shown[(to + shown.length) % shown.length], true);
    });
  }
  addEventListener('hashchange', () => {
    wanted = location.hash.slice(1);
    show();
  });
  const watch = new MutationObserver(show);
  for (const tab of tabs) watch.observe(panelOf(tab), { attributes: true, attributeFilter: ['hidden'] });
  show();
}
