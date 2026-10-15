'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const editorSource = fs.readFileSync(path.join(root, 'website.js'), 'utf8');
const editorHtml = fs.readFileSync(path.join(root, 'website.html'), 'utf8');

function makeElement() {
  const handlers = {};
  const classes = new Set();
  return {
    handlers,
    dataset: {},
    textContent: '',
    innerHTML: '',
    disabled: false,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      }
    },
    addEventListener(name, callback) { handlers[name] = callback; },
    querySelectorAll() { return []; }
  };
}

async function createWebsite(initialItem) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };
  let saved = initialItem ? { ...initialItem } : null;
  let failNextSave = false;
  let confirmValue=true;
  let pendingSaveGate=null;
  const confirmationMessages=[];
  const submissions = [];
  const tabs=['team','resources','models','discern'].map(key=>{
    const tab=makeElement();tab.dataset.siteTab=key;return tab;
  });

  const sandbox = {
    window: {
      location: { hostname: 'pathway.openbiblecmc.org', search: '' },
      addEventListener() {},
      confirm(message) { confirmationMessages.push(message);return confirmValue; }
    },
    document: {
      getElementById: element,
      querySelectorAll(selector) { return selector==='[data-site-tab]'?tabs:[]; }
    },
    dcAuth: {
      requireUser: async () => ({ id: 'qa-user' }),
      getProfile: async () => ({ account_role: 'cmc_admin' }),
      renderRoleNavigation() {},
      getSupabaseClient: async () => ({
        auth: { getSession: async () => ({ data: { session: { access_token: 'qa-token' } } }) }
      })
    },
    fetch: async (url, options = {}) => {
      assert.equal(url, '/.netlify/functions/site-content-admin');
      if (options.method !== 'POST') {
        return { ok: true, json: async () => ({ ok: true, content: saved ? [saved] : [] }) };
      }
      const body = JSON.parse(options.body);
      submissions.push(body);
      const gate=pendingSaveGate;
      pendingSaveGate=null;
      if(gate)await gate;
      if (failNextSave) {
        failNextSave = false;
        return { ok: false, json: async () => ({ ok: false, error: 'Temporary failure' }) };
      }
      const publish = body.action === 'publish';
      saved = {
        ...(saved || {}),
        content_key: body.content_key,
        draft_data: body.data,
        ...(publish ? { published_data: body.data, published_at: '2026-10-15T12:00:00.000Z' } : {})
      };
      return { ok: true, json: async () => ({ ok: true, item: saved, published: publish }) };
    }
  };

  await vm.runInNewContext(editorSource, sandbox);
  return {
    status: () => element('websiteDraftStatus').textContent,
    message: () => element('websiteMessage').textContent,
    submissions,
    confirmationMessages,
    setConfirm(value){confirmValue=value;},
    blockNextSave(promise){pendingSaveGate=promise;},
    tab(key){const entry=tabs.find(tab=>tab.dataset.siteTab===key);entry.handlers.click();},
    getTitle:()=>element('websiteSectionTitle').textContent,
    isDisabled:id=>element(id).disabled,
    setDraft(data) {
      element('websiteEditor').dataset.value = JSON.stringify(data);
      element('websiteEditor').handlers.input();
    },
    async click(id) {
      assert.equal(typeof element(id).handlers.click, 'function', id + ' click handler missing');
      await element(id).handlers.click();
    },
    failNext() { failNextSave = true; }
  };
}

async function run() {
  assert.match(editorHtml, /website\.js\?v=2/, 'HTML must load the updated Website editor');

  const publishedContent = {
    content_key: 'team',
    draft_data: { team: [] },
    published_data: { team: [] },
    published_at: '2026-10-14T12:00:00.000Z'
  };
  const app = await createWebsite(publishedContent);
  assert.equal(app.status(), 'Published', 'An unchanged published section should be labelled Published');

  app.setDraft({ team: [{ name: 'QA Test Person', title: 'Example', region: 'Test Region' }] });
  assert.equal(app.status(), 'Unsaved changes');
  await app.click('saveWebsiteDraft');
  assert.equal(app.status(), 'Draft saved · Unpublished edits',
    'Saving edits to a published section must not imply the changes are live');
  assert.equal(app.message(), 'Draft saved.');

  app.setConfirm(false);
  await app.click('publishWebsiteSection');
  assert.equal(app.submissions.length,1,'Declining publication must not submit changes');
  app.setConfirm(true);
  await app.click('publishWebsiteSection');
  assert.match(app.confirmationMessages.at(-1),/public CMC website/);
  assert.equal(app.status(), 'Published', 'A successful publish must report Published');
  assert.match(app.message(), /^Published\./);
  assert.deepEqual(app.submissions.map(item=>item.action), ['draft', 'publish']);

  app.setDraft({ team: [{ name: 'Another QA Test Person' }] });
  app.failNext();
  await app.click('saveWebsiteDraft');
  assert.equal(app.status(), 'Unsaved changes',
    'A failed save must not claim success or clear unsaved status');
  assert.equal(app.message(), 'Temporary failure');

  const inFlight=await createWebsite(publishedContent);
  inFlight.setDraft({team:[{name:'Saved version'}]});
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  inFlight.blockNextSave(gate);
  const pending=inFlight.click('saveWebsiteDraft');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(inFlight.isDisabled('saveWebsiteDraft'),true);
  assert.equal(inFlight.isDisabled('publishWebsiteSection'),true);
  await inFlight.click('saveWebsiteDraft');
  assert.equal(inFlight.submissions.length,1,'Repeated save click must not start a second request');
  inFlight.setDraft({team:[{name:'Newer unsaved version'}]});
  inFlight.tab('resources');
  assert.equal(inFlight.getTitle(),'CMC team','Tab changes must be blocked while saving');
  assert.match(inFlight.message(),/wait for the current save/i);
  release();
  await pending;
  assert.equal(inFlight.status(),'Unsaved changes','In-flight edits must remain unsaved after older response');
  assert.match(inFlight.message(),/New edits are still unsaved/);
  assert.equal(inFlight.isDisabled('saveWebsiteDraft'),false);
  await inFlight.click('saveWebsiteDraft');
  assert.equal(inFlight.submissions.length,2);
  assert.equal(inFlight.submissions[1].data.team[0].name,'Newer unsaved version');
  assert.equal(inFlight.status(),'Draft saved · Unpublished edits');

  const empty = await createWebsite(null);
  assert.equal(empty.status(), 'Not saved yet', 'An empty section is not a saved draft');
  const draft = await createWebsite({ content_key: 'team', draft_data: { team: [] } });
  assert.equal(draft.status(), 'Draft saved');

  console.log('Website editor status transitions: draft, published, unpublished edits, empty and error passed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
