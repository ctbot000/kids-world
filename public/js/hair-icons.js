// Little pictures of a kid's hair styles, for choosing one in 🎨 Change me:
// a face from the front, in your own skin and hair colours. With a grown-up's
// face (see FACES in shared/words.js): glasses, a moustache or a beard.
const TIE = '#ff6f9f';

// The top of the hair, over a fringe swept into curls, or cut straight across.
const SWEPT = 'M8.5 27A15.5 16.5 0 0 1 39.5 27Q37 20 33.5 21.5Q30.5 17 26.5 20.5Q23 16.5 19 20Q15 17 13 22Q10.5 21 8.5 27Z';
const STRAIGHT = 'M8.5 28A15.5 17 0 0 1 39.5 28L37.5 28Q37.5 22 34 22.5Q31 21 28 22.5Q24 21 20 22.5Q17 21 14 22.5Q10.5 22 10.5 28Z';
const CURLS_BACK = [[10, 26, 4.5], [10.5, 19, 4.5], [14, 13.5, 4.8], [20, 10, 5], [27, 9.8, 5], [33.5, 12.5, 4.8], [37.5, 18.5, 4.5], [38, 25.5, 4.5]];
const CURLS_FRONT = [[15, 19.5, 4], [21, 17, 4.2], [27.5, 17, 4.2], [33, 19.5, 4]];

// Behind the face, and over it, for each style.
const STYLES = {
  short: { front: `<path d="${SWEPT}"/>` },
  spiky: { back: '<path d="M12 17L13.5 6L19 12.5L22 3.5L26.5 11.5L31 4.5L32.5 12.5L37.5 7.5L36 17Z"/>', front: `<path d="${SWEPT}"/>` },
  curly: {
    back: CURLS_BACK.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join(''),
    front: CURLS_FRONT.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join(''),
  },
  bob: { back: '<path d="M7 26A17 17 0 0 1 41 26L41 35Q41 38.5 37.5 38.5L10.5 38.5Q7 38.5 7 35Z"/>', front: `<path d="${STRAIGHT}"/>`, ears: false },
  long: { back: '<path d="M7 26A17 17 0 0 1 41 26L42.5 44Q42.5 46.5 39.5 46.5L8.5 46.5Q5.5 46.5 5.5 44Z"/>', front: `<path d="${STRAIGHT}"/>`, ears: false },
  ponytail: { back: `<ellipse cx="40" cy="31" rx="4.5" ry="9" transform="rotate(-20 40 31)"/><circle cx="37.5" cy="21" r="2.6" fill="${TIE}"/>`, front: `<path d="${SWEPT}"/>` },
  pigtails: {
    back: `<ellipse cx="7" cy="31" rx="4.5" ry="7.5" transform="rotate(15 7 31)"/><ellipse cx="41" cy="31" rx="4.5" ry="7.5" transform="rotate(-15 41 31)"/><circle cx="9.5" cy="23.5" r="2.4" fill="${TIE}"/><circle cx="38.5" cy="23.5" r="2.4" fill="${TIE}"/>`,
    front: `<path d="${STRAIGHT}"/>`,
  },
  bun: { back: `<circle cx="24" cy="8" r="6"/>`, front: `<path d="${SWEPT}"/><ellipse cx="24" cy="12.6" rx="4.2" ry="1.7" fill="${TIE}"/>` },
};

// Over the smile, in the hair colour (but the glasses).
const FACE = {
  glasses: '<g fill="none" stroke="#3a3340" stroke-width="1.4"><circle cx="19" cy="28.5" r="4"/><circle cx="29" cy="28.5" r="4"/><path d="M23 28.2L25 28.2M15 28L10 26.5M33 28L38 26.5"/></g>',
  moustache: (hair) => `<path d="M24 32.2Q20 30.6 17.5 33.4Q20.5 34.6 24 33.4Q27.5 34.6 30.5 33.4Q28 30.6 24 32.2Z" fill="${hair}"/>`,
  beard: (hair) => `<path d="M9.5 28Q10 39.5 17 41.5Q24 44 31 41.5Q38 39.5 38.5 28Q36 35 31 36.5Q27.5 33.8 24 33.8Q20.5 33.8 17 36.5Q12 35 9.5 28Z" fill="${hair}"/>`,
};

export function hairIcon(style, skin, hair, face = 'none') {
  const s = STYLES[style] ?? STYLES.short;
  const ears = s.ears === false ? '' : `<circle cx="9.5" cy="28" r="3" fill="${skin}"/><circle cx="38.5" cy="28" r="3" fill="${skin}"/>`;
  const svg = [
    '<svg class="hair-icon" viewBox="0 0 48 48" aria-hidden="true">',
    `<g fill="${hair}">${s.back ?? ''}</g>`,
    ears,
    `<circle cx="24" cy="26" r="15" fill="${skin}" stroke="rgba(0,0,0,0.12)"/>`,
    `<g fill="${hair}">${s.front}</g>`,
    '<ellipse cx="19" cy="28.5" rx="1.8" ry="2.3" fill="#2b2530"/><ellipse cx="29" cy="28.5" rx="1.8" ry="2.3" fill="#2b2530"/>',
    '<ellipse cx="14.5" cy="32.5" rx="2.4" ry="1.4" fill="#ff9ab0" opacity="0.75"/><ellipse cx="33.5" cy="32.5" rx="2.4" ry="1.4" fill="#ff9ab0" opacity="0.75"/>',
    '<path d="M21.5 34Q24 36.3 26.5 34" fill="none" stroke="#7a3b3b" stroke-width="1.3" stroke-linecap="round"/>',
    face.includes('beard') ? FACE.beard(hair) : '',
    face === 'moustache' || face.includes('beard') ? FACE.moustache(hair) : '',
    face.includes('glasses') ? FACE.glasses : '',
    '</svg>',
  ].join('');
  const t = document.createElement('template');
  t.innerHTML = svg;
  return t.content.firstElementChild;
}
