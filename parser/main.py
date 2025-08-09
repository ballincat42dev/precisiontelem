import os, re, json, logging
from fastapi import FastAPI, Request, HTTPException
import requests

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
logging.basicConfig(level=LOG_LEVEL)
log = logging.getLogger('parser')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE')
RAW_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET_RAW', 'telemetry-raw')
PARSED_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET_PARSED', 'telemetry-parsed')
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET')

if not SUPABASE_URL or not SERVICE_KEY:
    log.warning('SUPABASE_URL or SUPABASE_SERVICE_ROLE not set; requests will fail.')

app = FastAPI()

def supabase_headers():
    return { 'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}' }

def storage_url(bucket: str, path: str) -> str:
    return f'{SUPABASE_URL}/storage/v1/object/{bucket}/{path}'

def download_from_storage(bucket: str, path: str) -> bytes:
    url = storage_url(bucket, path)
    r = requests.get(url, headers=supabase_headers())
    if r.status_code != 200:
        raise HTTPException(status_code=500, detail=f'Failed to download {bucket}/{path}: {r.text}')
    return r.content

def upload_to_storage(bucket: str, path: str, data: bytes, content_type='application/json'):
    url = storage_url(bucket, path)
    r = requests.post(url, headers={**supabase_headers(), 'x-upsert': 'true', 'content-type': content_type}, data=data)
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=f'Failed to upload {bucket}/{path}: {r.text}')

def postgrest(path: str, json_body: dict, method='POST'):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    r = requests.request(method, url, headers={**supabase_headers(), 'Content-Type':'application/json', 'Prefer':'return=representation'}, json=json_body)
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=f'Postgrest error: {r.text}')
    return r.json()

def parse_path(info: dict):
    # Supabase webhooks typically include: { "type":"OBJECT_CREATED", "record": {"bucket_id":"telemetry-raw","name":"<path>"}, ... }
    rec = info.get('record') or {}
    bucket = rec.get('bucket_id') or info.get('bucket', RAW_BUCKET)
    name = rec.get('name') or info.get('path')
    if not name:
        raise HTTPException(status_code=400, detail='Missing path in webhook payload')
    # Expect name like: teamId/sessionId.ibt
    m = re.match(r'(?P<team>[0-9a-fA-F-]+)/(?P<session>[0-9a-fA-F-]+)\.ibt$', name)
    if not m:
        raise HTTPException(status_code=400, detail='Unexpected object path; expected teamId/sessionId.ibt')
    return bucket, name, m.group('team'), m.group('session')

def parse_ibt(raw_bytes: bytes):
    """
    TODO: Replace stub with real IBT parsing.
    Return (meta: dict, laps: list[dict]).
    """
    # Stub produces a tiny demo lap so the pipeline is testable.
    meta = {
        "track_name": "DemoTrack",
        "car_name": "DemoCar",
        "driver_name": "Unknown",
        "started_at": "2025-01-01T00:00:00Z",
        "channels": ["TimeMs","Speed","Throttle","Brake","RPM","Gear","Steering"]
    }
    lap_rows = []
    t = 0
    for i in range(300):  # 300 samples -> ~30s at 10ms
        lap_rows.append({
            "TimeMs": t,
            "Speed": 50 + i*0.1,
            "Throttle": (i % 100)/100.0,
            "Brake": 0.0 if i < 260 else (i-260)/40.0,
            "RPM": 4000 + (i*10),
            "Gear": 3 if i < 150 else 4,
            "Steering": 0.1
        })
        t += 10
    laps = [{"lap_number": 1, "rows": lap_rows}]
    return meta, laps

@app.post('/webhook/storage')
async def on_storage_event(req: Request):
    if WEBHOOK_SECRET:
        if req.headers.get('x-webhook-secret') != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail='Unauthorized webhook')

    payload = await req.json()
    bucket, name, team_id, session_id = parse_path(payload)
    if bucket != RAW_BUCKET:
        return {"ok": True, "skipped": True}

    log.info(f'Processing {bucket}/{name} team={team_id} session={session_id}')

    raw_bytes = download_from_storage(bucket, name)
    meta, laps = parse_ibt(raw_bytes)

    # Upload artifacts
    meta_out = { **meta, "team_id": team_id, "session_id": session_id }
    meta_path = f'{team_id}/{session_id}/meta.json'
    upload_to_storage(PARSED_BUCKET, meta_path, json.dumps(meta_out).encode('utf-8'))

    # Per-lap JSON
    for lap in laps:
        lap_path = f'{team_id}/{session_id}/laps/{lap["lap_number"]}.json'
        upload_to_storage(PARSED_BUCKET, lap_path, json.dumps(lap["rows"]).encode('utf-8'))

    # Update DB: session (ready), lap index, channel list
    postgrest('session?id=eq.' + session_id, {
        "parsed_key": f"{PARSED_BUCKET}/{team_id}/{session_id}/",
        "track_name": meta.get("track_name"),
        "car_name": meta.get("car_name"),
        "driver_name": meta.get("driver_name"),
        "started_at": meta.get("started_at"),
        "lap_count": len(laps),
        "status": "ready"
    }, method='PATCH')

    for lap in laps:
        postgrest('lap', {
            "team_id": team_id,
            "session_id": session_id,
            "lap_number": lap["lap_number"],
            "lap_time_ms": (lap["rows"][-1]["TimeMs"] - lap["rows"][0]["TimeMs"]) if lap["rows"] else None,
            "is_valid": True,
            "best": True if lap["lap_number"] == 1 else False
        }, method='POST')

    for ch in meta.get("channels", []):
        postgrest('channel', {
            "team_id": team_id,
            "session_id": session_id,
            "name": ch,
            "unit": None
        }, method='POST')

    return {"ok": True, "team_id": team_id, "session_id": session_id}
