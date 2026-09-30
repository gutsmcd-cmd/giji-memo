import './base.css';
import './style.css';
import { h, toast, copyText, uid, langToggle, confirmDialog, showSaveBanner, hideSaveBanner } from './ui';
import { dicts, type Lang, type Dict } from './i18n';
import { askPersist, idbLoad, idbSave, idbPutNow } from './db';

const DB = 'giji-memo';

interface ActionItem { id: string; text: string; who: string }
interface Meeting {
  id: string;
  title: string;
  date: string;
  attendees: string;
  agenda: string;
  decisions: string;
  actions: ActionItem[];
  updated: number;
}
interface State { lang: Lang; meetings: Meeting[] }

let state: State = { lang: 'ja', meetings: [] };
let t: Dict = dicts.ja;
let view: 'list' | 'edit' = 'list';
let currentId: string | null = null;
const app = document.getElementById('app')!;

function isLang(v: unknown): v is Lang { return v === 'ja' || v === 'en'; }
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function normalize(raw: unknown): State {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const meetings: Meeting[] = [];
  if (Array.isArray(o.meetings)) {
    for (const item of o.meetings) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      if (typeof r.id !== 'string') continue;
      const actions: ActionItem[] = [];
      if (Array.isArray(r.actions)) {
        for (const a of r.actions) {
          if (!a || typeof a !== 'object') continue;
          const ar = a as Record<string, unknown>;
          if (typeof ar.id !== 'string') continue;
          actions.push({
            id: ar.id,
            text: typeof ar.text === 'string' ? ar.text : '',
            who: typeof ar.who === 'string' ? ar.who : '',
          });
        }
      }
      meetings.push({
        id: r.id,
        title: typeof r.title === 'string' ? r.title : '',
        date: typeof r.date === 'string' ? r.date : todayISO(),
        attendees: typeof r.attendees === 'string' ? r.attendees : '',
        agenda: typeof r.agenda === 'string' ? r.agenda : '',
        decisions: typeof r.decisions === 'string' ? r.decisions : '',
        actions,
        updated: typeof r.updated === 'number' ? r.updated : Date.now(),
      });
    }
  }
  return { lang: isLang(o.lang) ? o.lang : 'ja', meetings };
}

let saveChain: Promise<void> = Promise.resolve();
let saveQueued = false;
function queueSave(): void {
  saveQueued = true;
  saveChain = saveChain.then(async () => {
    if (!saveQueued) return;
    saveQueued = false;
    try {
      await idbSave(DB, state);
      hideSaveBanner();
    } catch {
      showSaveBanner();
    }
  }).catch(() => { showSaveBanner(); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) queueSave(); });
window.addEventListener('pagehide', () => { idbPutNow(DB, state); queueSave(); });

function setLang(l: Lang): void {
  state.lang = l;
  t = dicts[l];
  document.documentElement.lang = l;
  document.title = t.app;
  queueSave();
  render();
}
function current(): Meeting | null {
  return state.meetings.find((m) => m.id === currentId) ?? null;
}
function touch(m: Meeting): void { m.updated = Date.now(); }

function sorted(): Meeting[] {
  return [...state.meetings].sort((a, b) => (a.date === b.date ? b.updated - a.updated : a.date < b.date ? 1 : -1));
}
function openNew(): void {
  const m: Meeting = {
    id: uid(), title: '', date: todayISO(), attendees: '', agenda: '', decisions: '', actions: [], updated: Date.now(),
  };
  state.meetings.unshift(m);
  currentId = m.id;
  view = 'edit';
  queueSave();
  render();
}
function openMeeting(id: string): void {
  currentId = id;
  view = 'edit';
  render();
}
async function deleteMeeting(id: string): Promise<void> {
  const ok = await confirmDialog(t.deleteAsk, t.deleteBody, t.del, t.cancel, true);
  if (!ok) return;
  state.meetings = state.meetings.filter((m) => m.id !== id);
  if (currentId === id) { currentId = null; view = 'list'; }
  queueSave();
  render();
}
function meetingText(m: Meeting): string {
  const whoWrap = (who: string) => (state.lang === 'ja' ? `（${who}）` : ` (${who})`);
  const actions = m.actions
    .filter((a) => a.text.trim() || a.who.trim())
    .map((a) => `- ${a.text.trim()}${a.who.trim() ? whoWrap(a.who.trim()) : ''}`)
    .join('\n');
  return [
    m.title.trim() || t.untitled,
    `${t.date}: ${m.date}`,
    `${t.attendees}: ${m.attendees.trim()}`,
    '',
    `■ ${t.agenda}`,
    m.agenda.trim(),
    '',
    `■ ${t.decisions}`,
    m.decisions.trim(),
    '',
    `■ ${t.actions}`,
    actions,
  ].join('\n');
}

function field(label: string, node: HTMLElement): HTMLElement {
  return h('label', { class: 'field' }, label, node);
}

function render(): void {
  if (view === 'edit' && current()) renderEdit(current()!);
  else { view = 'list'; renderList(); }
  window.scrollTo(0, 0);
}

function renderList(): void {
  const rows = sorted();
  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('h1', {}, t.app),
      langToggle(state.lang, setLang),
    ),
    h('main', {},
      h('p', { class: 'subhead' }, t.sub),
      h('button', { class: 'btn primary block', type: 'button', onclick: openNew }, t.newMeeting),
      h('h2', { class: 'sec' }, t.listTitle),
      rows.length === 0
        ? h('p', { class: 'empty' }, t.empty)
        : h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
            ...rows.map((m) => h('div', { class: 'meet-row' },
              h('button', { class: 'meet grow', type: 'button', onclick: () => openMeeting(m.id) },
                h('div', { class: 'meet-title' }, m.title.trim() || t.untitled),
                h('div', { class: 'meet-sub' }, `${m.date}${m.attendees.trim() ? ' · ' + m.attendees.trim() : ''}`),
              ),
              h('button', {
                class: 'icon-btn', type: 'button', 'aria-label': t.del,
                onclick: () => { void deleteMeeting(m.id); },
              }, '×'),
            )),
          ),
    ),
    h('p', { class: 'foot' }, t.privacy),
  );
}

function renderEdit(m: Meeting): void {
  const bind = (key: 'title' | 'attendees' | 'agenda' | 'decisions') => (e: Event) => {
    m[key] = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    touch(m);
    queueSave();
  };
  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('button', { class: 'top-back', type: 'button', onclick: () => { view = 'list'; render(); } }, t.back),
      h('h1', {}, t.app),
      langToggle(state.lang, setLang),
    ),
    h('main', {},
      h('p', { class: 'subhead' }, t.sub),
      field(t.titlePh, h('input', { class: 'input', type: 'text', value: m.title, placeholder: t.titlePh, autocomplete: 'off', oninput: bind('title') })),
      field(t.date, h('input', {
        class: 'input', type: 'date', value: m.date,
        oninput: (e: Event) => { m.date = (e.target as HTMLInputElement).value; touch(m); queueSave(); },
      })),
      field(t.attendees, h('input', { class: 'input', type: 'text', value: m.attendees, placeholder: t.attendeesPh, autocomplete: 'off', oninput: bind('attendees') })),
      field(t.agenda, h('textarea', { class: 'input', value: m.agenda, oninput: bind('agenda') })),
      field(t.decisions, h('textarea', { class: 'input', value: m.decisions, oninput: bind('decisions') })),
      h('h2', { class: 'sec' }, t.actions),
      h('div', { class: 'stack' }, ...m.actions.map((a) => actionRow(m, a))),
      h('button', {
        class: 'btn block', type: 'button',
        onclick: () => {
          m.actions.push({ id: uid(), text: '', who: '' });
          touch(m);
          queueSave();
          render();
        },
      }, t.addAction),
      h('button', {
        class: 'btn primary block', type: 'button',
        onclick: async () => {
          const ok = await copyText(meetingText(m));
          toast(ok ? t.copied : t.copyFail);
        },
      }, t.copy),
      h('button', { class: 'btn danger block', type: 'button', onclick: () => { void deleteMeeting(m.id); } }, t.del),
    ),
    h('p', { class: 'foot' }, t.privacy),
  );
}

function actionRow(m: Meeting, a: ActionItem): HTMLElement {
  return h('div', { class: 'action' },
    h('input', {
      class: 'input grow', type: 'text', value: a.text, placeholder: t.actionPh, autocomplete: 'off', 'aria-label': t.actionPh,
      oninput: (e: Event) => { a.text = (e.target as HTMLInputElement).value; touch(m); queueSave(); },
    }),
    h('input', {
      class: 'input who', type: 'text', value: a.who, placeholder: t.whoPh, autocomplete: 'off', 'aria-label': t.whoPh,
      oninput: (e: Event) => { a.who = (e.target as HTMLInputElement).value; touch(m); queueSave(); },
    }),
    h('button', {
      class: 'icon-btn', type: 'button', 'aria-label': t.del,
      onclick: () => {
        m.actions = m.actions.filter((x) => x.id !== a.id);
        touch(m);
        queueSave();
        render();
      },
    }, '×'),
  );
}

async function boot(): Promise<void> {
  await askPersist();
  try { state = normalize(await idbLoad(DB)); }
  catch { state = { lang: 'ja', meetings: [] }; showSaveBanner(); }
  t = dicts[state.lang];
  document.documentElement.lang = state.lang;
  document.title = t.app;
  render();
}
void boot();
