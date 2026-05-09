// RSVP client with plus-one support
const CSV_PATH = 'attendees.csv';
const CONFIG_PATH = 'data/config.json';
const EVENT_PATH = 'data/event.json';

let config = { formEndpoint: '', address: '' };
let attendees = [];

async function loadJSON(path){
  try{ const res = await fetch(path); if(!res.ok) throw new Error('not found'); return await res.json(); }catch(e){ return null; }
}

async function fetchAttendees(){
  try{
    const res = await fetch(CSV_PATH);
    if(!res.ok) throw new Error('No attendees file');
    const text = await res.text();
    attendees = parseCSV(text);
    return attendees;
  }catch(e){ attendees = []; return []; }
}

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<=1) return [];
  const headers = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(line=>{
    const cols = line.split(',');
    const obj={};
    headers.forEach((h,i)=>obj[h]=cols[i]?cols[i].trim():"");
    return obj;
  });
}

function updateNameDatalist(){
  const dl = document.getElementById('names-list'); if(!dl) return; dl.innerHTML = '';
  const names = Array.from(new Set(attendees.map(a=>a.name).filter(Boolean)));
  names.forEach(n=>{ const opt = document.createElement('option'); opt.value = n; dl.appendChild(opt); });
}

function renderAttendees(list){
  const container = document.getElementById('attendees-list'); if(!container) return;
  if(!list.length){ container.innerHTML = '<p>No responses yet.</p>'; updateNameDatalist(); return }
  const ul = document.createElement('ul');
  list.forEach(a=>{
    const li = document.createElement('li'); li.className='attendee';
    const plus = a.plus_one ? ` (plus: ${a.plus_one})` : '';
    li.textContent = `${a.name || '—'} — ${a.answer || '—'}${plus}`;
    ul.appendChild(li);
  });
  container.innerHTML=''; container.appendChild(ul); updateNameDatalist();
}

function findByName(list,name){ if(!name) return null; const key = name.trim().toLowerCase(); return list.find(a=> (a.name||'').toLowerCase() === key) || null; }

function upsertAttendee(name, answer, plusOne){
  plusOne = (plusOne||'').toString().trim();
  const key = name.trim().toLowerCase();
  const now = new Date().toISOString();
  const idx = attendees.findIndex(a=> (a.name||'').toLowerCase() === key);
  if(idx >= 0){ attendees[idx].answer = answer; attendees[idx].plus_one = plusOne; attendees[idx].created_at = now; }
  else { attendees.push({ name: name, answer: answer, plus_one: plusOne, created_at: now }); }
}

async function init(){
  const loadedConfig = await loadJSON(CONFIG_PATH); if(loadedConfig) config = Object.assign(config, loadedConfig);
  const event = (await loadJSON(EVENT_PATH)) || { title: 'Housewarming', date: '', description: '' };
  const titleEl = document.getElementById('event-title'); if(titleEl && event.title) titleEl.textContent = event.title;
  const metaEl = document.querySelector('.event-detail .meta') || document.querySelector('.event-card .meta');
  if(metaEl) metaEl.textContent = `${event.date || ''}${event.date && config.address ? ' — ' : ''}${config.address || ''}`.trim();
  const descEl = document.querySelector('.event-detail .desc') || document.querySelector('.event-card .desc'); if(descEl && event.description) descEl.textContent = event.description;

  await fetchAttendees(); renderAttendees(attendees);

  const nameInput = document.getElementById('name'); const form = document.getElementById('rsvp-form'); const status = document.getElementById('status');

  if(nameInput){ nameInput.addEventListener('input',()=>{ const val = nameInput.value; const found = findByName(attendees,val); if(found){ const radios = document.querySelectorAll('input[name="answer"]'); radios.forEach(r=> r.checked = (r.value === (found.answer||'').toLowerCase())); if(status) status.textContent = `Loaded existing response for ${found.name}: ${found.answer}`; const plusEl = document.getElementById('plus_one'); if(plusEl) plusEl.value = found.plus_one || ''; } else { if(status) status.textContent=''; const radios = document.querySelectorAll('input[name="answer"]'); radios.forEach(r=> r.checked = false); const plusEl = document.getElementById('plus_one'); if(plusEl) plusEl.value = ''; } }); }

  if(form){ form.addEventListener('submit', async (ev)=>{ ev.preventDefault(); const formData = new FormData(form); const name = (formData.get('name')||'').toString().trim(); const answer = (formData.get('answer')||'').toString(); const plusOne = (formData.get('plus_one')||'').toString().trim(); if(!name){ if(status) status.textContent='Please provide your name.'; return } if(status) status.textContent = 'Saving…';

    if(config && config.formEndpoint){ try{ const payload = new URLSearchParams(); payload.append('name', name); payload.append('answer', answer); payload.append('plus_one', plusOne); const res = await fetch(config.formEndpoint, {method:'POST',body:payload,headers:{'Accept':'application/json'}}); if(!res.ok) throw new Error('submit failed'); upsertAttendee(name, answer, plusOne); renderAttendees(attendees); if(status) status.textContent = 'Saved (via form endpoint). Thank you!'; return; }catch(err){ console.warn('submit failed',err); if(status) status.textContent = 'Saved locally (preview). Submission endpoint not configured or failed.'; } }

    upsertAttendee(name, answer, plusOne); renderAttendees(attendees); }); const cancel = document.getElementById('btn-cancel'); if(cancel) cancel.addEventListener('click',()=>{ form.reset(); const s = document.getElementById('status'); if(s) s.textContent=''; }); }
}

init();
