// Minimal client for RSVP page
// Configure FORM_ENDPOINT to a Formspree / Getform / Basin endpoint if you want serverless processing
const FORM_ENDPOINT = ""; // e.g. "https://formspree.io/f/yourid" or "https://getform.io/f/yourid"
const CSV_PATH = 'attendees.csv'; // repo-hosted CSV; editable by maintainers

async function fetchAttendees(){
  try{
    const res = await fetch(CSV_PATH);
    if(!res.ok) throw new Error('No attendees file');
    const text = await res.text();
    return parseCSV(text);
  }catch(e){
    return [];
  }
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

function renderAttendees(list){
  const container = document.getElementById('attendees-list');
  if(!container) return;
  if(!list.length) { container.innerHTML = '<p>No responses yet.</p>'; return }
  const ul = document.createElement('ul');
  list.forEach(a=>{
    const li = document.createElement('li');
    li.className='attendee';
    li.textContent = `${a.name || '—'} — ${a.answer || '—'}`;
    ul.appendChild(li);
  });
  container.innerHTML=''; container.appendChild(ul);
}

function findByName(list,name){
  if(!name) return null;
  name = name.trim().toLowerCase();
  return list.find(a=> (a.name||'').toLowerCase() === name) || null;
}

async function init(){
  const attendees = await fetchAttendees();
  renderAttendees(attendees);

  const nameInput = document.getElementById('name');
  const form = document.getElementById('rsvp-form');
  const status = document.getElementById('status');

  if(nameInput){
    nameInput.addEventListener('input',()=>{
      const found = findByName(attendees,nameInput.value);
      if(found){
        const radios = document.querySelectorAll('input[name="answer"]');
        radios.forEach(r=> r.checked = (r.value === (found.answer||'').toLowerCase()));
        status.textContent = `Loaded existing response for ${found.name}: ${found.answer}`;
      } else {
        status.textContent='';
      }
    });
  }

  if(form){
    form.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const formData = new FormData(form);
      const name = (formData.get('name')||'').toString().trim();
      const answer = (formData.get('answer')||'').toString();
      if(!name){ status.textContent='Please provide your name.'; return }
      status.textContent = 'Saving…';

      // Attempt serverless submit if configured
      if(FORM_ENDPOINT){
        try{
          const payload = new URLSearchParams();
          payload.append('name', name);
          payload.append('answer', answer);
          const res = await fetch(FORM_ENDPOINT, {method:'POST',body:payload,headers:{'Accept':'application/json'}});
          if(!res.ok) throw new Error('submit failed');
          status.textContent = 'Saved (via form endpoint). Thank you!';
          setTimeout(async ()=>{ const list = await fetchAttendees(); renderAttendees(list); },1500);
          return;
        }catch(err){
          console.warn('submit failed',err);
          status.textContent = 'Saved locally (preview). Submission endpoint not configured or failed.';
        }
      } else {
        status.innerHTML = 'No submit endpoint configured. To collect responses, set FORM_ENDPOINT in app.js to a Formspree/Getform/Basin endpoint. Alternatively, maintainers can add rows to attendees.csv manually.';
      }

      attendees.push({name:name,answer:answer});
      renderAttendees(attendees);
    });

    const cancel = document.getElementById('btn-cancel');
    if(cancel) cancel.addEventListener('click',()=>{ form.reset(); document.getElementById('status').textContent=''; });
  }
}

// Run
init();
