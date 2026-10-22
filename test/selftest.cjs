// Offline smoke test for the browser half: fakes the module loader, React, the host
// context and the session APIs so the bundle can be registered, rendered and driven.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const file = path.join(__dirname, '..', 'lib', 'client.js');
  const source = fs.readFileSync(file, 'utf8');

  const listeners = [];
  const storage = new Map();
  let captured = null;

  const sandbox = {
    window: {
      __ModuleLoader__: { load(def) { captured = def; } },
      addEventListener: (type, fn) => listeners.push([type, fn]),
      removeEventListener: (type, fn) => {
        const at = listeners.findIndex(([t, f]) => t === type && f === fn);
        if (at >= 0) listeners.splice(at, 1);
      },
      localStorage: {
        getItem: (key) => (storage.has(key) ? storage.get(key) : null),
        setItem: (key, value) => storage.set(key, value),
      },
    },
    document: { addEventListener: () => {}, removeEventListener: () => {} },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    AbortController,
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'client.js' });
  if (!captured) throw new Error('module loader was not called');

  // ---- fake React with persistent hook state and deferred effects ----
  const hookStates = [];
  let hookIndex = 0;
  let effects = [];
  let cleanups = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => {
      const i = hookIndex++;
      if (!(i in hookStates)) hookStates[i] = typeof initial === 'function' ? initial() : initial;
      return [hookStates[i], (next) => {
        hookStates[i] = typeof next === 'function' ? next(hookStates[i]) : next;
      }];
    },
    useRef: (initial) => {
      const i = hookIndex++;
      if (!(i in hookStates)) hookStates[i] = { current: initial };
      return hookStates[i];
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect: (fn) => { effects.push(fn); },
    useSyncExternalStore: (subscribe, getSnapshot) => { subscribe(() => {}); return getSnapshot(); },
  };

  // ---- fake session data ----
  const now = Date.now();
  const sessions = {
    byId: {
      'session-a': { id: 'session-a', title: '做一个 C# 控制台项目', updatedAt: now - 60000, cwd: 'D:\\VSProject\\记忆' },
      'session-b': { id: 'session-b', title: 'Unity 穿墙修复', updatedAt: now - 7200000, cwd: 'D:\\UnityProject\\杀' },
      'session-c': { id: 'session-c', title: '大肥鱼插画', updatedAt: now - 300000, cwd: 'D:\\VSProject\\记忆' },
      'session-d': { id: 'session-d', updatedAt: now - 1000000, cwd: 'D:\\UnityProject\\杀' },
    },
  };
  sessions.list = { getSnapshot: () => sessions, subscribe: () => () => {} };

  const workspaceRows = [
    { workspaceId: 'w1', cwd: 'D:\\VSProject\\记忆', sessionIds: ['session-a', 'session-c'] },
    // session-b is deliberately absent from the registry so its label must fall back to cwd
    { workspaceId: 'w2', cwd: 'D:\\UnityProject\\杀', sessionIds: ['session-d'] },
  ];
  const workspaces = {
    list: {
      // the live snapshot is a plain array — keep the fixture identical to reality
      getSnapshot: () => workspaceRows,
      subscribe: () => () => {},
    },
  };

  const prompts = [];
  sessions.using = async (id, options, operation) => {
    const call = { id, options };
    prompts.push(call);
    return operation({
      binding: {
        session: {
          prompt: async (content, mode) => {
            call.content = content;
            call.mode = mode;
            return { ok: true };
          },
        },
      },
    });
  };

  const searchQueries = [];
  sessions.search = async (query) => {
    searchQueries.push(query);
    let items = [];
    if (query.includes('鱼')) items = [{ id: 'session-c', snippet: '画了一只大肥鱼' }];
    else if (query === 'Bow' || query === '背包') items = [{ id: 'session-b', snippet: 'Bow 需要从背包取 arrow' }];
    return { ok: true, value: { items, hasMore: false } };
  };

  const dictionaries = {};
  const opened = [];
  const panels = [];
  const registrations = [];

  const ctx = {
    sessions,
    workspaces,
    uiWorkspace: { openSession: (id) => opened.push(id) },
    layout: { selectPanel: (id) => panels.push(id) },
    locale: {
      register: (ns, dict) => { dictionaries[ns] = dict; },
      bind: (ns) => (key) => (dictionaries[ns] && dictionaries[ns].zh[key]) || key,
    },
    effect: (fn) => fn(),
    slots: {
      inject(name, factory) { factory(); },
      register(definition, Component) { registrations.push({ definition, Component }); return definition; },
    },
  };

  const mod = captured.factory((name) => {
    if (name === 'react') return React;
    throw new Error('unexpected require: ' + name);
  });

  const checks = [];
  checks.push(['exports.apply is a function', typeof mod.apply === 'function']);
  checks.push(['inject declares sessions/locale/layout',
    ['sessions', 'locale', 'layout'].every((s) => mod.inject.includes(s))]);

  mod.apply(ctx);

  const mainPanel = registrations.find((r) => r.definition.name === 'main');
  const side = registrations.find((r) => r.definition.name === 'sidebar.panellist');
  checks.push(['registers a main page keyed by panel id', !!mainPanel && mainPanel.definition.key === 'session-overview']);
  checks.push(['registers a sidebar panellist row', !!side && side.definition.id === 'session-overview']);
  checks.push(['row sits below plugins(0) and schedules(10)', side.definition.order === 20]);

  const props = mainPanel.definition.inject();

  function expand(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(expand);
    if (typeof node.type === 'function') return expand(node.type({ ...node.props }));
    return { ...node, children: (node.children || []).map(expand) };
  }

  function render() {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    effects = [];
    hookIndex = 0;
    const tree = expand(mainPanel.Component(props));
    effects.forEach((fn) => {
      const cleanup = fn();
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    });
    return tree;
  }

  function findAll(node, predicate, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) { node.forEach((item) => findAll(item, predicate, out)); return out; }
    if (predicate(node)) out.push(node);
    (node.children || []).forEach((child) => findAll(child, predicate, out));
    return out;
  }

  const asText = (node) => JSON.stringify(node);
  const flatText = (node) =>
    typeof node === 'string' ? node
      : Array.isArray(node) ? node.map(flatText).join('')
        : (node && node.children ? flatText(node.children) : '');

  // ---- pure ranking helpers ----
  const rows = [
    sessions.byId['session-a'], sessions.byId['session-b'], sessions.byId['session-c'], sessions.byId['session-d'],
  ];
  const contentRanked = mod.__test.rankCandidates('构建为什么失败', rows, [{ id: 'session-b' }]);
  checks.push(['content hit ranks first', contentRanked[0].id === 'session-b' && contentRanked[0].reason === 'content']);
  const titleRanked = mod.__test.rankCandidates('大肥鱼', rows, []);
  checks.push(['local title match ranks first', titleRanked[0].id === 'session-c']);
  checks.push(['weak query picks nothing', mod.__test.pickBest(mod.__test.rankCandidates('嗯', rows, [])) === null]);
  checks.push(['clear winner is picked', mod.__test.pickBest(contentRanked).id === 'session-b']);

  const labels = mod.__test.buildWorkspaceLabels([
    { workspaceId: 'a', cwd: 'D:/A/记忆', sessionIds: ['s1'] },
    { workspaceId: 'b', cwd: 'D:/B/记忆', sessionIds: ['s2'] },
    { workspaceId: 'c', cwd: 'D:/C/唯一', sessionIds: ['s3'] },
  ]);
  checks.push(['same-named workspaces get qualified',
    labels.get('s1') !== labels.get('s2') && labels.get('s1').includes('记忆') && labels.get('s1').includes('A')]);
  checks.push(['unique workspace keeps a short label', labels.get('s3') === '唯一']);

  // keyword extraction: a long sentence is reduced to literal search terms
  const keywords = mod.__test.extractKeywords('实现Bow类，Bow使用的arrow需要在背包中寻找', 10);
  checks.push(['keywords keep ascii identifiers', keywords.includes('Bow') && keywords.includes('arrow')]);
  checks.push(['keywords reach cjk bigrams deep in the sentence', keywords.includes('背包')]);
  checks.push(['keywords are deduped and capped',
    new Set(keywords.map((k) => k.toLowerCase())).size === keywords.length && keywords.length <= 10]);

  // ---- page basics ----
  let tree = render();
  checks.push(['page lists every session', ['做一个 C# 控制台项目', 'Unity 穿墙修复', '大肥鱼插画'].every((s) => asText(tree).includes(s))]);
  checks.push(['workspace cards wrap sessions', asText(tree).includes('记忆') && asText(tree).includes('杀')]);
  checks.push(['workspace grid defaults to 2 columns', asText(tree).includes('repeat(2, minmax(0, 1fr))')]);
  checks.push(['session grid defaults to 3 columns', asText(tree).includes('repeat(3, minmax(0, 1fr))')]);
  checks.push(['no native select elements', findAll(tree, (n) => n.type === 'select').length === 0]);
  checks.push(['composer has a textarea', findAll(tree, (n) => n.type === 'textarea').length === 1]);

  const sendButton = () => findAll(tree, (n) => n.type === 'button' && flatText(n.children).includes('发送'))[0];
  const checkboxes = () => findAll(tree, (n) => n.type === 'input' && n.props.type === 'checkbox');
  const type = (value) => {
    findAll(tree, (n) => n.type === 'textarea')[0].props.onChange({ target: { value } });
    tree = render();
  };
  const press = async (key) => {
    const handlers = listeners.filter(([type]) => type === 'keydown').map(([, fn]) => fn);
    for (const fn of handlers) fn({ key, preventDefault() {} });
    await wait(0);
    tree = render();
  };

  checks.push(['send is disabled while empty', !!sendButton() && sendButton().props.disabled === true]);
  checks.push(['send button uses the themed fill/foreground pair',
    String(sendButton().props.style.background).includes('button-primary-fill')
    && String(sendButton().props.style.color).includes('label-primary-foreground')]);
  checks.push(['ask-before-send defaults to on', checkboxes().length === 2 && checkboxes()[0].props.checked === true]);
  checks.push(['show-workspace defaults to on', checkboxes()[1].props.checked === true]);

  // ---- ask flow: first Enter only proposes a destination ----
  type('帮我看下这个构建错误');
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  checks.push(['first Enter only asks', prompts.length === 0 && flatText(tree).includes('将投递到')]);
  checks.push(['ask strip names the fallback session', flatText(tree).includes('将投递到 做一个 C# 控制台项目')]);
  checks.push(['ask strip explains the key', flatText(tree).includes('回车确认 · Esc 取消')]);
  checks.push(['button turns into confirm', flatText(sendButton().children).includes('确认发送')]);

  await press('Escape');
  checks.push(['Esc cancels the proposal', prompts.length === 0 && !flatText(tree).includes('将投递到')]);
  checks.push(['draft survives the cancel', findAll(tree, (n) => n.type === 'textarea')[0].props.value === '帮我看下这个构建错误']);

  // ---- second Enter confirms ----
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  checks.push(['confirmed send goes to the proposed session', prompts.length === 1 && prompts[0].id === 'session-a']);
  checks.push(['prompt carries one trimmed text block',
    JSON.stringify(prompts[0].content) === JSON.stringify([{ type: 'text', text: '帮我看下这个构建错误' }])]);
  checks.push(['prompt uses queue mode', prompts[0].mode === 'queue']);
  checks.push(['composer cleared after send', findAll(tree, (n) => n.type === 'textarea')[0].props.value === '']);
  checks.push(['success status shown', flatText(tree).includes('已发送')]);

  // ---- ask flow with a real match ----
  type('再画一条鱼');
  await wait(350);
  tree = render();
  checks.push(['search is consulted for the draft', searchQueries.some((q) => q.includes('鱼'))]);
  checks.push(['chip shows the suggested session', flatText(tree).includes('推荐 · 大肥鱼插画')]);
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  checks.push(['proposal names the matched session', flatText(tree).includes('将投递到 大肥鱼插画')]);
  checks.push(['proposal explains the match', flatText(tree).includes('按对话内容匹配')]);
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  checks.push(['confirmed send goes to the matched session', prompts[1].id === 'session-c']);

  // ---- a long sentence must still route by its keywords ----
  type('实现Bow类，Bow使用的arrow需要在背包中寻找');
  await wait(350);
  tree = render();
  checks.push(['long sentence routes to the keyword match', flatText(tree).includes('推荐 · Unity 穿墙修复')]);
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  checks.push(['confirm searches deeper terms too', searchQueries.includes('背包')]);
  checks.push(['proposal names the keyword-matched session', flatText(tree).includes('将投递到 Unity 穿墙修复')]);
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  checks.push(['long sentence sends to the keyword match', prompts.length === 3 && prompts[2].id === 'session-b']);

  // ---- manual lock skips the question ----
  tree = render();
  const recentChips = findAll(tree, (n) => n.type === 'button' && n.props && n.props['data-recent']);
  checks.push(['recent row labels itself', flatText(tree).includes('最近使用')]);
  checks.push(['recent row lists the newest sessions', recentChips.length === 4]);
  checks.push(['recent chips are ordered by recency',
    recentChips.map((n) => n.props['data-recent']).join(',') === 'session-a,session-c,session-d,session-b']);
  checks.push(['untitled chip carries a workspace tag',
    flatText(findAll(tree, (n) => n.props && n.props['data-recent'] === 'session-d')[0]).includes('杀')]);
  checks.push(['chip stacks workspace above the title',
    findAll(findAll(tree, (n) => n.props && n.props['data-recent'] === 'session-d')[0], (n) => n.type === 'span').length === 2]);
  checks.push(['workspace falls back to the session cwd',
    flatText(findAll(tree, (n) => n.props && n.props['data-recent'] === 'session-b')[0]).includes('杀')]);

  // the workspace tag is optional
  checkboxes()[1].props.onChange({ target: { checked: false } });
  tree = render();
  checks.push(['hiding workspaces removes the tag',
    !flatText(findAll(tree, (n) => n.props && n.props['data-recent'] === 'session-d')[0]).includes('杀')
    && findAll(findAll(tree, (n) => n.props && n.props['data-recent'] === 'session-d')[0], (n) => n.type === 'span').length === 0]);
  checks.push(['workspace choice is persisted', storage.get('dsh-session-overview:workspace') === '0']);
  checkboxes()[1].props.onChange({ target: { checked: true } });
  tree = render();
  checks.push(['turning it back on restores the tag',
    flatText(findAll(tree, (n) => n.props && n.props['data-recent'] === 'session-d')[0]).includes('杀')]);
  recentChips.find((n) => n.props['data-recent'] === 'session-b').props.onClick();
  tree = render();
  checks.push(['recent chip pins that session', flatText(tree).includes('已锁定 · Unity 穿墙修复')]);
  const activeChip = findAll(tree, (n) => n.type === 'button' && n.props && n.props['data-recent'] === 'session-b')[0];
  checks.push(['pinned recent chip is highlighted', String(activeChip.props.style.border || '').includes('brand')]);

  type('这个不用问，直接发');
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  checks.push(['locked target skips the confirmation', prompts[3].id === 'session-b']);

  // ---- turning the option off restores direct sending ----
  checkboxes()[0].props.onChange({ target: { checked: false } });
  tree = render();
  checks.push(['option can be turned off', checkboxes()[0].props.checked === false]);
  checks.push(['choice is persisted', storage.get('dsh-session-overview:ask') === '0']);
  type('关闭后直接发');
  sendButton().props.onClick();
  await wait(0);
  tree = render();
  checks.push(['disabled option sends directly', prompts.length === 5 && prompts[4].id === 'session-b']);

  // ---- picker still offers auto + sessions ----
  findAll(tree, (n) => n.type === 'button' && flatText(n.children).includes('▾'))[0].props.onClick();
  tree = render();
  const options = findAll(tree, (n) => n.props && n.props.role === 'option');
  checks.push(['picker offers auto plus every session', options.length === 5 && flatText(options[0]) === '自动匹配']);
  options.find((o) => flatText(o.children).includes('大肥鱼插画')).props.onClick();
  tree = render();
  checks.push(['picker pins the chosen session', flatText(tree).includes('已锁定 · 大肥鱼插画')]);

  // ---- layout pickers ----
  const groups = findAll(tree, (n) => n.props && n.props.role === 'group');
  checks.push(['two column pickers', groups.length === 2]);
  findAll(groups[0], (n) => n.type === 'button' && flatText(n.children) === '4')[0].props.onClick();
  const saved = JSON.parse(storage.get('dsh-session-overview:layout') || '{}');
  checks.push(['picking a column count persists', saved.workspaceCols === 4]);

  // ---- card click + Esc ----
  tree = render();
  const card = findAll(tree, (n) => n.type === 'button' && String(n.props.title || '').startsWith('session-'))[0];
  card.props.onClick();
  checks.push(['card click opens the session', opened.length > 0]);

  panels.length = 0;
  await press('Escape');
  checks.push(['Escape returns to the conversation', panels[panels.length - 1] === null]);

  const icon = side.Component({ size: 18, active: false });
  const parts = (icon && icon.children) || [];
  checks.push(['icon renders two solid blocks',
    !!icon && icon.type === 'svg' && parts.length === 2
    && parts.every((part) => part.type === 'rect' && part.props.height >= 5)]);

  let ok = true;
  for (const [name, passed] of checks) {
    console.log((passed ? 'PASS  ' : 'FAIL  ') + name);
    ok = ok && passed;
  }
  return ok;
}

main().then((ok) => process.exit(ok ? 0 : 1)).catch((error) => {
  console.error(error);
  process.exit(1);
});
