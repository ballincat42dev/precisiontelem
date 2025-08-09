'use client';
import { useState } from 'react';

export default function Admin() {
  const [base, setBase] = useState('Precision');
  const [created, setCreated] = useState<any | null>(null);
  const [teamId, setTeamId] = useState('');
  const [emailOrId, setEmailOrId] = useState('');
  const [message, setMessage] = useState('');

  const createTeam = async () => {
    setMessage('');
    const res = await fetch('/api/admin/create-team', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ base })
    });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || 'Error');
    setCreated(json.team);
    setTeamId(json.team.id);
  };

  const addMember = async () => {
    setMessage('');
    const res = await fetch('/api/admin/add-member', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ teamId, emailOrId })
    });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || 'Error');
    setMessage('Member added.');
  };

  return (
    <div className="space-y-8">
      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Create Team</h2>
        <div className="flex items-center gap-3">
          <input className="input" value={base} onChange={e=>setBase(e.target.value)} placeholder="Base name (e.g., Precision)" />
          <button className="btn" onClick={createTeam}>Create next team label</button>
        </div>
        {created && (
          <div className="mt-3 text-sm">
            Created: <b>{created.name}</b> (id: <code>{created.id}</code>)
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Add Member to Team</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input className="input" value={teamId} onChange={e=>setTeamId(e.target.value)} placeholder="Team ID (UUID)" />
          <input className="input" value={emailOrId} onChange={e=>setEmailOrId(e.target.value)} placeholder="Member email or user ID" />
          <button className="btn" onClick={addMember}>Add Member</button>
        </div>
        {message && <p className="text-sm mt-2">{message}</p>}
        <p className="text-xs text-neutral-500 mt-2">Note: user must sign in at least once so an app_user row exists if using email.</p>
      </div>
    </div>
  );
}
