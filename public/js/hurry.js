// The waits a player never notices, for automated tests that have no time
// for them: before the page first calls the keeper, before it tries again
// after a blip, between saves of your island, and between asking for a list
// again. A test sets window.kidsWorldHurry to true before the page starts,
// and each of those waits is a tenth as long; everyone else waits as long
// as ever.
export const hurried = (ms) => (globalThis.kidsWorldHurry === true ? ms / 10 : ms);
