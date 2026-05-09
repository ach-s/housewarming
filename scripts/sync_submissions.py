#!/usr/bin/env python3
import os, sys, csv, json, requests

FORM_API_URL = os.environ.get('FORM_API_URL')
FORM_API_TOKEN = os.environ.get('FORM_API_TOKEN')
ATT_FILE = 'attendees.csv'

if not FORM_API_URL:
    print('FORM_API_URL not set; exiting')
    sys.exit(0)

headers = {'Accept':'application/json'}
if FORM_API_TOKEN:
    headers['Authorization'] = f'Bearer {FORM_API_TOKEN}'

print('Fetching submissions from', FORM_API_URL)
resp = requests.get(FORM_API_URL, headers=headers, timeout=30)
if resp.status_code != 200:
    print('Failed to fetch submissions:', resp.status_code, resp.text)
    sys.exit(1)

try:
    data = resp.json()
except Exception as e:
    print('Response not JSON:', e)
    sys.exit(1)

# Normalize potential shapes
submissions = []
if isinstance(data, list):
    submissions = data
elif isinstance(data, dict):
    # try common keys
    for k in ('submissions','data','items'):
        if k in data and isinstance(data[k], list):
            submissions = data[k]
            break
    else:
        # if dict with fields for single submission
        if 'name' in data and 'answer' in data:
            submissions = [data]

print(f'Found {len(submissions)} submissions')

# read existing rows
existing = []
if os.path.exists(ATT_FILE):
    with open(ATT_FILE, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            existing.append(r)

existing_set = set()
for r in existing:
    key = ( (r.get('name') or '').strip().lower(), (r.get('answer') or '').strip().lower(), (r.get('created_at') or '').strip() )
    existing_set.add(key)

new_rows = []
for s in submissions:
    # attempt to extract fields
    name = s.get('name') or s.get('fullname') or s.get('your_name') or ''
    answer = s.get('answer') or s.get('response') or s.get('rsvp') or ''
    created = s.get('created_at') or s.get('submitted_at') or s.get('date') or ''
    name = name.strip()
    answer = answer.strip()
    created = created.strip() or ''
    if not name:
        continue
    key = (name.lower(), answer.lower(), created)
    if key in existing_set:
        continue
    # add default created if missing
    if not created:
        from datetime import datetime
        created = datetime.utcnow().isoformat()
    new_rows.append({'name': name, 'answer': answer, 'created_at': created})

if not new_rows:
    print('No new submissions to add')
    sys.exit(0)

# append to CSV
fieldnames = ['name','answer','created_at']
write_header = not os.path.exists(ATT_FILE) or os.path.getsize(ATT_FILE) == 0
with open(ATT_FILE, 'a', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    if write_header:
        writer.writeheader()
    for r in new_rows:
        writer.writerow(r)

print(f'Appended {len(new_rows)} rows to {ATT_FILE}')

