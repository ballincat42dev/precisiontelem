'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useDropzone } from 'react-dropzone';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function TelemetrySessions() {
  const supabase = createClientComponentClient();
  const [sessions, setSessions] = useState<any[]>([]);
  const [lapData, setLapData] = useState<any[]>([]);
  const [channels, setChannels] = useState<string[]>(['Speed','Throttle','Brake','RPM','Gear','Steering']);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    (async () => {
      // Ensure app_user row exists if logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('app_user').upsert({ id: user.id, email: user.email || null, display_name: user.user_metadata?.name || null });

      const { data, error } = await supabase.from('session')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) setSessions(data);
    })();
  }, []);

  const onDrop = async (files: File[]) => {
    if (!files?.length) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.ibt')) {
      alert('Please upload an .ibt file');
      return;
    }
    const teamId = prompt('Enter team ID to upload into (UUID):') || '';
    if (!teamId) return;

    const res = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: f.name, teamId })
    });
    if (!res.ok) { alert('Failed to get upload URL'); return; }
    const { url } = await res.json();
    const put = await fetch(url, { method: 'PUT', body: f });
    if (!put.ok) { alert('Upload failed'); return; }
    alert('Upload received. Parsing will begin shortly.');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  const loadLap = async (sessionId: string, lap: number) => {
    const res = await fetch(`/api/sessions/${sessionId}/lap/${lap}`);
    if (!res.ok) { alert('No lap data yet'); return; }
    const json = await res.json();
    setLapData(json.rows || []);
  };

  const filtered = sessions.filter(s => {
    const q = filter.toLowerCase();
    return [s.driver_name, s.track_name, s.car_name].some(v => (v||'').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="card">
        <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-8 text-center ${isDragActive ? 'bg-neutral-100' : ''}`}>
          <input {...getInputProps()} />
          <p className="text-lg font-medium">Drag & drop IBT files here, or click to browse</p>
          <p className="text-sm text-neutral-500">Files parse automatically after upload</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <input className="input" placeholder="Filter by track, driver, car..." value={filter} onChange={e=>setFilter(e.target.value)} />
        </div>
        <div className="overflow-x-auto rounded-xl">
          <table className="table">
            <thead>
              <tr className="tr">
                <th className="th">Driver</th>
                <th className="th">Track</th>
                <th className="th">Car</th>
                <th className="th">Date</th>
                <th className="th">Laps</th>
                <th className="th">View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s:any) => (
                <tr key={s.id} className="tr">
                  <td className="td">{s.driver_name || '—'}</td>
                  <td className="td">{s.track_name || '—'}</td>
                  <td className="td">{s.car_name || '—'}</td>
                  <td className="td">{new Date(s.started_at || s.created_at).toLocaleString()}</td>
                  <td className="td">{s.lap_count ?? '—'}</td>
                  <td className="td">
                    <button className="btn" onClick={() => loadLap(s.id, 1)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lapData?.length > 0 && (
        <div className="card">
          <div className="flex flex-wrap gap-2 mb-4">
            {['Speed','Throttle','Brake','Steering','RPM','Gear'].map((c) => (
              <button key={c}
                className={channels.includes(c) ? 'btn' : 'btn-outline'}
                onClick={() => setChannels((prev) => prev.includes(c) ? prev.filter(x => x!==c) : [...prev, c])}
              >{c}</button>
            ))}
          </div>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lapData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="TimeMs" tickFormatter={(v:any) => `${(v/1000).toFixed(1)}s`} />
                <YAxis yAxisId="left" />
                <Tooltip />
                <Legend />
                {channels.map((c) => (
                  <Line key={c} yAxisId="left" type="monotone" dataKey={c} dot={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
