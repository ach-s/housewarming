// RSVP client (Supabase + plain fetch / PostgREST)
const CONFIG_PATH = 'data/config.json';
const EVENT_PATH = 'data/event.json';

let config = { supabaseUrl: '', supabaseAnonKey: '', address: '' };
let attendees = [];

async function loadJSON(path){
  try { const r = await fetch(path); if(!r.ok) throw 0; return await r.json(); } catch { return null; }
}

function supabaseHeaders(){
  return { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` };
}

function configured(){ return Boolean(config.supabaseUrl && config.supabaseAnonKey); }

// Rows come back ordered by created_at desc; keep first row per (lowercased) name
// so the displayed list reflects each person's most recent RSVP.
function dedupeByName(rows){
  const seen = new Set();
  const out = [];
  for(const row of rows){
    const key = (row.name || '').trim().toLowerCase();
    if(!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function fetchAttendees(){
  if(!configured()){ attendees = []; return []; }
  try {
    const url = `${config.supabaseUrl}/rest/v1/attendees?select=name,answer,plus_one,created_at&order=created_at.desc`;
    const res = await fetch(url, { headers: supabaseHeaders() });
    if(!res.ok) throw new Error(`fetch failed: ${res.status}`);
    attendees = dedupeByName(await res.json());
    return attendees;
  } catch(e){ console.warn('fetchAttendees', e); attendees = []; return []; }
}

async function submitRSVP(name, answer, plusOne){
  const res = await fetch(`${config.supabaseUrl}/rest/v1/attendees`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ name, answer, plus_one: plusOne }),
  });
  if(!res.ok) throw new Error(`submit failed: ${res.status}`);
  return (await res.json())[0];
}

function updateNameDatalist(){
  const dl = document.getElementById('names-list'); if(!dl) return;
  dl.innerHTML = '';
  Array.from(new Set(attendees.map(a=>a.name).filter(Boolean))).forEach(n=>{
    const opt = document.createElement('option'); opt.value = n; dl.appendChild(opt);
  });
}

function renderAttendees(list){
  const container = document.getElementById('attendees-list'); if(!container) return;
  if(!list.length){ container.innerHTML = '<p>No responses yet.</p>'; updateNameDatalist(); return; }
  const ul = document.createElement('ul');
  list.forEach(a=>{
    const li = document.createElement('li'); li.className = 'attendee';
    const plus = a.plus_one ? ' (+1)' : '';
    li.textContent = `${a.name || '—'} — ${a.answer || '—'}${plus}`;
    ul.appendChild(li);
  });
  container.innerHTML = ''; container.appendChild(ul); updateNameDatalist();
}

function findByName(list, name){
  if(!name) return null;
  const key = name.trim().toLowerCase();
  return list.find(a => (a.name||'').toLowerCase() === key) || null;
}

async function init(){
  const loadedConfig = await loadJSON(CONFIG_PATH); if(loadedConfig) config = Object.assign(config, loadedConfig);
  const event = (await loadJSON(EVENT_PATH)) || { title: 'Housewarming', date: '', description: '' };
  const titleEl = document.getElementById('event-title'); if(titleEl && event.title) titleEl.textContent = event.title;
  const metaEl = document.querySelector('.event-detail .meta') || document.querySelector('.event-card .meta');
  if(metaEl) metaEl.textContent = `${event.date || ''}${event.date && config.address ? ' — ' : ''}${config.address || ''}`.trim();
  const descEl = document.querySelector('.event-detail .desc') || document.querySelector('.event-card .desc');
  if(descEl && event.description) descEl.textContent = event.description;

  await fetchAttendees(); renderAttendees(attendees);

  const nameInput = document.getElementById('name');
  const form = document.getElementById('rsvp-form');
  const status = document.getElementById('status');

  if(nameInput){
    nameInput.addEventListener('input', () => {
      const found = findByName(attendees, nameInput.value);
      const radios = document.querySelectorAll('input[name="answer"]');
      const plusEl = document.getElementById('plus_one');
      if(found){
        radios.forEach(r => r.checked = (r.value === (found.answer||'').toLowerCase()));
        if(plusEl) plusEl.checked = Boolean(found.plus_one);
        if(status) status.textContent = `Loaded existing response for ${found.name}: ${found.answer}`;
      } else {
        radios.forEach(r => r.checked = false);
        if(plusEl) plusEl.checked = false;
        if(status) status.textContent = '';
      }
    });
  }

  if(form){
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const name = (fd.get('name')||'').toString().trim();
      const answer = (fd.get('answer')||'').toString();
      const plusOne = document.getElementById('plus_one')?.checked === true;
      if(!name){ if(status) status.textContent = 'Please provide your name.'; return; }
      if(!answer){ if(status) status.textContent = 'Please choose Yes or No.'; return; }
      if(!configured()){ if(status) status.textContent = 'Submission is not configured.'; return; }
      if(status) status.textContent = 'Saving…';
      try {
        await submitRSVP(name, answer, plusOne);
        await fetchAttendees();
        renderAttendees(attendees);
        if(status) status.textContent = 'Saved. Thank you!';
      } catch(err){
        console.warn('submit failed', err);
        if(status) status.textContent = 'Could not save. Please try again.';
      }
    });

    const cancel = document.getElementById('btn-cancel');
    if(cancel) cancel.addEventListener('click', () => {
      form.reset();
      if(status) status.textContent = '';
    });
  }
}

init();
