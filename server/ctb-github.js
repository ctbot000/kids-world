// CTB's task board is the project's GitHub issues, read and written with the
// GitHub CLI (gh, logged in on this computer): a task is an open issue with
// the label "ctb", written by the account gh is logged in as (so nobody else
// can hand the workers a task, or slip words into one, on a public repo); a
// worker labels it "ctb: working" while on it, then "ctb: pr" once its pull
// request is open, or "ctb: stuck" when it could not finish. A task a worker
// proposes is an issue first, labelled "ctb: proposal", and waits there
// until it is labelled "ctb: approved" (on GitHub, or with Approve on the
// admin page; only the repository's own people can label an issue): the
// signal to start, when it becomes a "ctb" task.
import { execFile } from 'node:child_process';

export const LABELS = {
  task: 'ctb',
  working: 'ctb: working',
  pr: 'ctb: pr',
  stuck: 'ctb: stuck',
  proposal: 'ctb: proposal',
  approved: 'ctb: approved',
  bug: 'ctb: bug',
  request: 'ctb: request',
};
const LABEL_LOOKS = {
  [LABELS.task]: ['1f6feb', 'A task for CTB’s workers'],
  [LABELS.working]: ['fbca04', 'A CTB worker is on it'],
  [LABELS.pr]: ['0e8a16', 'A CTB worker opened a pull request for it'],
  [LABELS.stuck]: ['d93f0b', 'A CTB worker could not finish it'],
  [LABELS.proposal]: ['c5def5', 'A task a CTB worker proposes'],
  [LABELS.approved]: ['5319e7', 'A proposal approved: CTB’s workers may start it'],
  [LABELS.request]: ['f9d0c4', 'An idea a player sent in the game, accepted by a CTB worker'],
  [LABELS.bug]: ['d73a4a', 'A problem a player told of in the game, taken on by a CTB worker'],
};
const FIELDS = 'number,title,body,labels,author,createdAt,url';

// gh, its answer as text; throws with what gh said when it fails.
export function gh(args, { cwd, input = null, timeout = 60000 } = {}) {
  return new Promise((done, fail) => {
    const child = execFile('gh', args, { cwd, timeout, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' } }, (error, stdout, stderr) => {
      if (error) fail(new Error(`gh ${args[0]} ${args[1] ?? ''}: ${(stderr || error.message).trim().split('\n')[0]}`));
      else done(stdout);
    });
    if (input !== null) child.stdin.end(input);
  });
}

// An issue as the workers see it.
const issueOf = (i) => ({ number: i.number, title: i.title, body: i.body ?? '', labels: (i.labels ?? []).map((l) => l.name), author: i.author?.login ?? '', createdAt: i.createdAt, url: i.url });

export class GitHub {
  // repo: owner/name. run: gh itself, or a stand-in for tests.
  constructor({ repo, run = gh }) {
    this.repo = repo;
    this.run = run;
    this.me = '';
  }

  // Who gh is logged in as, and the labels made: '' when ready, or what is wrong.
  async problem() {
    try {
      this.me = (await this.run(['api', 'user', '--jq', '.login'])).trim();
    } catch (error) {
      return `the GitHub CLI is not logged in (${error.message})`;
    }
    try {
      const have = new Set(JSON.parse(await this.run(['label', 'list', '-R', this.repo, '--limit', '200', '--json', 'name'])).map((l) => l.name));
      for (const [name, [color, description]] of Object.entries(LABEL_LOOKS)) {
        if (!have.has(name)) await this.run(['label', 'create', name, '-R', this.repo, '--color', color, '--description', description]);
      }
    } catch (error) {
      return `could not reach ${this.repo} on GitHub (${error.message})`;
    }
    return '';
  }

  async list(label, state = 'open', limit = 100) {
    const out = await this.run(['issue', 'list', '-R', this.repo, '--state', state, '--label', label, '--limit', String(limit), '--json', FIELDS]);
    return JSON.parse(out).map(issueOf);
  }

  // The open tasks, oldest first, written by the account the workers run as.
  async tasks() {
    const all = await this.list(LABELS.task);
    return all.filter((i) => !this.me || i.author === this.me).sort((a, b) => a.number - b.number);
  }

  // The open proposals, oldest first.
  async proposals() {
    return (await this.list(LABELS.proposal)).filter((i) => !this.me || i.author === this.me).sort((a, b) => a.number - b.number);
  }

  // Players' ideas filed as issues, open or closed, as their news needs
  // them: { number, closed, completed (closed as done, not turned down),
  // labels }.
  async requests(limit = 200) {
    const out = await this.run(['issue', 'list', '-R', this.repo, '--state', 'all', '--label', LABELS.request, '--limit', String(limit), '--json', 'number,state,stateReason,labels']);
    return JSON.parse(out).map((i) => ({ number: i.number, closed: i.state === 'CLOSED', completed: i.state === 'CLOSED' && i.stateReason !== 'NOT_PLANNED', labels: (i.labels ?? []).map((l) => l.name) }));
  }

  // A new issue's number.
  async create({ title, body, labels }) {
    const args = ['issue', 'create', '-R', this.repo, '--title', title, '--body-file', '-'];
    for (const l of labels) args.push('--label', l);
    const url = (await this.run(args, { input: body || ' ' })).trim();
    return { number: Number(/\/(\d+)\s*$/.exec(url)?.[1] ?? 0), url };
  }

  async label(number, { add = [], remove = [] }) {
    const args = ['issue', 'edit', String(number), '-R', this.repo];
    for (const l of add) args.push('--add-label', l);
    for (const l of remove) args.push('--remove-label', l);
    if (add.length || remove.length) await this.run(args);
  }

  async comment(number, body) {
    await this.run(['issue', 'comment', String(number), '-R', this.repo, '--body-file', '-'], { input: body });
  }

  async close(number, body = '') {
    const args = ['issue', 'close', String(number), '-R', this.repo, '--reason', 'not planned'];
    if (body) args.push('--comment', body);
    await this.run(args);
  }

  // A pull request from a branch already pushed: its URL.
  async pullRequest({ branch, title, body, base = 'main' }) {
    return (await this.run(['pr', 'create', '-R', this.repo, '--head', branch, '--base', base, '--title', title, '--body-file', '-'], { input: body })).trim();
  }

  // The workers' latest pull requests, for the admin page.
  async pulls(limit = 15) {
    const out = await this.run(['pr', 'list', '-R', this.repo, '--state', 'all', '--search', 'head:ctb/', '--limit', String(limit), '--json', 'number,title,url,state,headRefName,createdAt']);
    return JSON.parse(out).filter((p) => p.headRefName.startsWith('ctb/'));
  }
}

// owner/name from a remote's URL (https or ssh), or ''.
export function repoOf(url) {
  return /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(String(url).trim())?.[1] ?? '';
}
