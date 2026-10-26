// What the AI friend knows of its friends' personalities: asked "What's my
// MBTI?", it tells a friend it knows well enough, and asks one it does not a
// few two-choice questions first — at least two for each of the four letters,
// a third where those two disagree — one at a time, between other talk. What
// they answered is saved in the keeper's data folder, by name (all that the
// islands it visits tell it of a player), so it remembers them next time and
// carries on with the questions where they left off.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const PEOPLE_FILE = 'ai-friend-people.json';

const MBTI_ASK = /mbti|엠비티아이|personality type|성격 ?유형/iu;

export const isMbtiAsk = (text) => MBTI_ASK.test(text);

// What each type means, in English and in Korean: a small model answers in
// the language of the example it is given.
const MEANINGS = {
  INTJ: ['a clever planner with big ideas', '큰 꿈을 세우는 똑똑한 계획가'],
  INTP: ['a curious thinker who loves puzzles', '퍼즐을 좋아하는 호기심 많은 생각쟁이'],
  ENTJ: ['a brave leader who gets things done', '척척 해내는 용감한 대장'],
  ENTP: ['a quick inventor full of new ideas', '새 아이디어가 가득한 발명가'],
  INFJ: ['a kind dreamer who understands friends', '친구 마음을 잘 아는 다정한 꿈쟁이'],
  INFP: ['a gentle dreamer with a big heart', '마음이 넓은 따뜻한 꿈쟁이'],
  ENFJ: ['a warm helper who cheers everyone on', '모두를 응원하는 따뜻한 도우미'],
  ENFP: ['a happy explorer who loves new friends', '새 친구를 좋아하는 신나는 탐험가'],
  ISTJ: ['a steady builder you can count on', '믿음직하고 꼼꼼한 건축가'],
  ISFJ: ['a caring friend who looks after others', '친구들을 잘 챙기는 다정한 친구'],
  ESTJ: ['a great organizer who keeps things going', '척척 정리하는 멋진 반장'],
  ESFJ: ['a friendly host who makes everyone welcome', '모두를 반겨 주는 친절한 주인'],
  ISTP: ['a handy maker who likes to see how things work', '뚝딱뚝딱 잘 만드는 손재주꾼'],
  ISFP: ['a creative artist who loves pretty things', '예쁜 것을 좋아하는 예술가'],
  ESTP: ['a bold adventurer who loves action', '모험을 좋아하는 씩씩한 모험가'],
  ESFP: ['a fun star who makes every day a party', '매일을 파티로 만드는 신나는 스타'],
};

export const meaningOf = (type) => ({ en: MEANINGS[type][0], ko: MEANINGS[type][1] });

// The four letters, each with its two sides and three questions whose first
// choice leans to the first side. Asked in this order: the first question of
// each letter, then the second of each, then the third where it is a tie.
const AXES = [
  {
    key: 'EI',
    questions: [
      { en: ['After a busy day, what makes you happy?', 'playing with lots of friends', 'quiet time on your own'], ko: ['바쁜 하루가 끝나면 뭐가 더 좋아?', '친구들이랑 왁자지껄 노는 것', '혼자 조용히 쉬는 것'] },
      { en: ['At a party with new kids, what do you do?', 'talk to lots of them', 'stay with one or two friends you know'], ko: ['처음 보는 친구가 많은 파티에서 너는?', '여러 친구한테 말을 건다', '아는 친구 한두 명이랑 있는다'] },
      { en: ['Got a good idea? What do you do first?', 'tell everyone right away', 'think it over quietly'], ko: ['좋은 생각이 나면 먼저 어떻게 해?', '바로 친구들한테 말한다', '머릿속으로 조용히 생각해 본다'] },
    ],
  },
  {
    key: 'SN',
    questions: [
      { en: ['Which stories do you like more?', 'stories about real things', 'stories full of magic and made-up worlds'], ko: ['어떤 이야기가 더 좋아?', '진짜 있었던 일 이야기', '마법이랑 상상 속 세상 이야기'] },
      { en: ['When you build something, how do you do it?', 'follow the steps, one by one', 'make up your own new idea'], ko: ['뭔가 만들 때 너는?', '순서대로 차근차근 따라 한다', '나만의 새로운 생각으로 만든다'] },
      { en: ['On a walk, what do you do?', 'spot little things, like bugs and flowers', 'daydream about what could be'], ko: ['산책할 때 너는?', '벌레나 꽃 같은 작은 것들을 본다', '이런저런 상상을 한다'] },
    ],
  },
  {
    key: 'TF',
    questions: [
      { en: ["A friend's tower falls down. What first?", 'work out why it fell', 'check that your friend is OK'], ko: ['친구의 블록 탑이 무너졌어. 먼저 뭘 할래?', '왜 무너졌는지 알아본다', '친구가 괜찮은지 먼저 본다'] },
      { en: ['Picking a game to play, what matters more?', 'the rules are fair', 'everyone is happy'], ko: ['같이 할 놀이를 고를 때 뭐가 더 중요해?', '규칙이 공평한 것', '모두 기분 좋은 것'] },
      { en: ['In a game, what makes you happiest?', 'winning', 'everyone having fun together'], ko: ['게임할 때 언제 제일 기뻐?', '내가 이겼을 때', '다 같이 재미있게 놀았을 때'] },
    ],
  },
  {
    key: 'JP',
    questions: [
      { en: ['On a day off, what do you like?', 'planning the day ahead', 'seeing what happens'], ko: ['쉬는 날에 너는?', '미리 계획을 세운다', '그때그때 하고 싶은 걸 한다'] },
      { en: ['Homework or play first?', 'homework first, then play', 'play first, homework later'], ko: ['숙제랑 놀기 중에 뭐 먼저 해?', '숙제 먼저 하고 논다', '먼저 놀고 숙제는 나중에'] },
      { en: ['What is your room like most days?', 'neat and tidy', 'a fun little mess'], ko: ['네 방은 보통 어때?', '깔끔하게 정리되어 있다', '조금 어질러져 있다'] },
    ],
  },
];

// Every question, each with its id.
export const QUESTIONS = AXES.flatMap((axis) => axis.questions.map((q, i) => ({ id: `${axis.key}${i}`, ...q })));

// Their answers so far: "EI0" → "a" or "b".
function leanOf(answers, axis) {
  let lean = 0;
  let count = 0;
  for (let i = 0; i < axis.questions.length; i++) {
    const a = answers[`${axis.key}${i}`];
    if (a === 'a') lean++;
    if (a === 'b') lean--;
    if (a) count++;
  }
  return { lean, count };
}

// Their type, once each letter has two answers that agree or three.
export function typeOf(answers = {}) {
  let type = '';
  for (const axis of AXES) {
    const { lean, count } = leanOf(answers, axis);
    if (count < 2 || lean === 0) return '';
    type += lean > 0 ? axis.key[0] : axis.key[1];
  }
  return type;
}

// The next question to ask ({ id, en, ko }), or null once their type is known.
export function nextQuestion(answers = {}) {
  for (let round = 0; round < 3; round++) {
    for (const axis of AXES) {
      const { lean, count } = leanOf(answers, axis);
      if (count >= 2 && lean !== 0) continue;
      const id = `${axis.key}${round}`;
      if (!answers[id]) return { id, ...axis.questions[round] };
    }
  }
  return null;
}

// How many questions are left at most, the one being asked counted.
export function questionsLeft(answers = {}) {
  let left = 0;
  for (const axis of AXES) {
    const { lean, count } = leanOf(answers, axis);
    if (count < 2) left += 2 - count;
    else if (lean === 0) left += 1;
  }
  return left;
}

export const questionText = (q, lang) => {
  const [ask, a, b] = lang === 'Korean' ? q.ko : q.en;
  return lang === 'Korean' ? `${ask} ① ${a}? ② ${b}?` : `${ask} (1) ${a}, or (2) ${b}?`;
};

const keyOf = (name) => String(name).trim().toLowerCase();

// Everyone it has asked, kept in file: name → { name, answers, at }.
export class People {
  constructor({ file = null, log = () => {}, now = () => Date.now() } = {}) {
    this.file = file;
    this.log = log;
    this.now = now;
    this.people = new Map();
    this.saving = Promise.resolve();
  }

  async load() {
    if (!this.file) return this;
    try {
      const kept = JSON.parse(await readFile(this.file, 'utf8'));
      for (const p of Object.values(kept?.people ?? {})) {
        if (p && typeof p.name === 'string' && p.answers && typeof p.answers === 'object') this.people.set(keyOf(p.name), { name: p.name, answers: { ...p.answers }, at: p.at ?? 0 });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') this.log(`AI friend: what it knows of its friends, in ${this.file}, could not be read (${error.message}).`);
    }
    return this;
  }

  answersOf(name) {
    return this.people.get(keyOf(name))?.answers ?? {};
  }

  typeOf(name) {
    return typeOf(this.answersOf(name));
  }

  answer(name, id, pick) {
    const key = keyOf(name);
    const p = this.people.get(key) ?? { name, answers: {}, at: 0 };
    p.answers[id] = pick;
    p.at = this.now();
    this.people.set(key, p);
    return this.save();
  }

  save() {
    if (!this.file) return this.saving;
    const text = `${JSON.stringify({ people: Object.fromEntries(this.people) }, null, 1)}\n`;
    const file = this.file;
    this.saving = this.saving.then(async () => {
      try {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(`${file}.tmp`, text);
        await rename(`${file}.tmp`, file);
      } catch (error) {
        this.log(`AI friend: what it knows of its friends could not be saved (${error.message}).`);
      }
    });
    return this.saving;
  }
}

// Reading a child's answer to a question: what they meant, in a few words
// (a small model picks better having said it first), then which choice.
export const PICK_SCHEMA = {
  type: 'object',
  properties: { meant: { type: 'string' }, pick: { type: 'string', enum: ['a', 'b', 'none'] } },
  required: ['meant', 'pick'],
};

export function pickMessages(q, text) {
  const [ask, a, b] = q.en;
  return [
    { role: 'system', content: 'You read what a child said in a game chat, to see which of two choices they picked. Answer with JSON only.' },
    {
      role: 'user',
      content: `The question was: "${ask}" (in Korean: "${q.ko[0]}")\nChoice a, also "1" or "①": ${a} (${q.ko[1]})\nChoice b, also "2" or "②": ${b} (${q.ko[2]})\n\nThe child said: "${text}"\n\nFirst say in "meant", in a few English words, what the child meant. Then "pick": "a" if that is choice a, "b" if that is choice b, or "none" if they did not answer the question (talked about something else, or said both or neither).\nAnswer {"meant": "...", "pick": "a" | "b" | "none"}.`,
    },
  ];
}

// A quick read of answers like "1", "②" or the choice's own words, before
// asking the model.
export function plainPick(q, text) {
  const t = text.trim().toLowerCase().replace(/[.!~?]+$/u, '');
  if (/^(1|①|a|1번|첫 ?번째)$/u.test(t)) return 'a';
  if (/^(2|②|b|2번|두 ?번째)$/u.test(t)) return 'b';
  return '';
}

// The line telling the model to tell them their type, with an example in
// their language.
// lead says why: they asked, or they just answered the last question.
export function tellLine(lead, type, lang) {
  const { en, ko } = meaningOf(type);
  const like = lang === 'Korean' ? `너의 MBTI는 ${type}! ${ko}야! 그냥 재미로 보는 거야!` : `Your MBTI is ${type}: you are ${en}! Just for fun!`;
  return `${lead} From their answers to your questions, their own MBTI is ${type} (${en}); yours is not asked. Tell them in your own words, like "${like}"`;
}
