// Brings the English word quizzes in from the Kids Dictionary
// (github.com/ctbot000/kids-dictionary): every word's page there ends in a
// short quiz on what the word means, three answers to each question and the
// right ones under Answers. This reads them all and writes them out as
// public/js/shared/english-words.js, the English Words quiz's bank
// (quiz.js). Run it again when the dictionary grows:
//
//   node scripts/dictionary.mjs            (downloads the dictionary)
//   node scripts/dictionary.mjs <folder>   (a checkout of it, instead)
//
// The pages are plain enough Markdown to read line by line: a "# 🍎 apple"
// title, the Korean meaning in bold under "## 한국어 뜻", and under "## Quiz"
// numbered questions, each with its answers as bullets, then the right
// answers numbered the same in a <details> block.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'ctbot000/kids-dictionary';
const OUT = new URL('../public/js/shared/english-words.js', import.meta.url);

// One word's page: { word, emoji, ko, quiz: [{ q, a }] }, the right answer
// first in a, as quiz.js has its banks. Throws on a page it cannot follow, so
// a change in the dictionary's layout shows up here and not as a broken quiz.
export function readWord(text, file = 'a page') {
  const lines = text.split(/\r?\n/);
  const title = lines.find((l) => l.startsWith('# '))?.slice(2).trim();
  if (!title) throw new Error(`${file}: no title`);
  // An emoji before the word, if the page has one.
  const m = title.match(/^(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}\p{Emoji_Modifier}]*)\s+(.+)$/u);
  const [emoji, word] = m ? [m[1], m[2]] : ['', title];
  const section = (name) => {
    const at = lines.findIndex((l) => l.trim() === `## ${name}`);
    if (at < 0) return [];
    const end = lines.findIndex((l, i) => i > at && l.startsWith('## '));
    return lines.slice(at + 1, end < 0 ? undefined : end);
  };
  const ko = section('한국어 뜻').join(' ').match(/\*\*(.+?)\*\*/)?.[1];
  if (!ko) throw new Error(`${file}: no Korean meaning`);
  const quiz = [];
  const right = [];
  let inAnswers = false;
  for (const line of section('Quiz')) {
    if (line.includes('<details>')) inAnswers = true;
    const num = line.match(/^\d+\.\s+(.+)$/);
    const bullet = line.match(/^\s+-\s+(.+)$/);
    if (num && inAnswers) right.push(num[1].trim());
    else if (num) quiz.push({ q: num[1].trim(), a: [] });
    else if (bullet && !inAnswers && quiz.length) quiz.at(-1).a.push(bullet[1].trim());
  }
  if (!quiz.length || right.length !== quiz.length) throw new Error(`${file}: ${quiz.length} questions but ${right.length} answers`);
  quiz.forEach((ask, i) => {
    const at = ask.a.indexOf(right[i]);
    if (at < 0 || ask.a.length < 2) throw new Error(`${file}: “${right[i]}” is not one of the answers to “${ask.q}”`);
    ask.a.unshift(...ask.a.splice(at, 1));
  });
  return { word, emoji, ko, quiz };
}

// The dictionary's words folder: the one given, or a fresh download.
function wordsFolder(given) {
  if (given) return { dir: join(given, 'words'), done: () => {} };
  const tmp = mkdtempSync(join(tmpdir(), 'kids-dictionary-'));
  const tgz = join(tmp, 'dict.tar.gz');
  execFileSync('curl', ['-fsSL', '-o', tgz, `https://codeload.github.com/${REPO}/tar.gz/HEAD`]);
  execFileSync('tar', ['-xzf', tgz, '-C', tmp, '--strip-components=1']);
  return { dir: join(tmp, 'words'), done: () => rmSync(tmp, { recursive: true, force: true }) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { dir, done } = wordsFolder(process.argv[2]);
  try {
    const words = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => readWord(readFileSync(join(dir, f), 'utf8'), f));
    const body = words.map((w) => `  ${JSON.stringify(w)},`).join('\n');
    writeFileSync(
      OUT,
      `// Made by scripts/dictionary.mjs from the Kids Dictionary
// (https://github.com/${REPO}): each word, its emoji, its Korean meaning and
// its quiz, the right answer to each question first. Run the script again
// rather than changing this by hand.
export const ENGLISH_WORDS = [
${body}
];
`,
    );
    console.log(`${words.length} words, ${words.reduce((n, w) => n + w.quiz.length, 0)} questions`);
  } finally {
    done();
  }
}
