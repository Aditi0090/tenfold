/** Charity management: add, edit, delete, media, events (PRD §11.03). */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import Modal from '../../components/Modal.jsx';
import Loader from '../../components/Loader.jsx';
import CharityCover from '../../components/CharityCover.jsx';
import { useToast } from '../../components/Toast.jsx';

const EMPTY = { name: '', slug: '', tagline: '', description: '', category: '', location: '', website: '', image_url: '', featured: false, active: true, events: [] };
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function AdminCharities() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('charities').select('*').order('name');
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const payload = { ...edit, slug: edit.slug || slugify(edit.name), events: (edit.events || []).filter((x) => x.title) };
    delete payload.id; delete payload.created_at;
    const q = edit.id ? supabase.from('charities').update(payload).eq('id', edit.id) : supabase.from('charities').insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast(error.message.includes('slug') ? 'That web address (slug) is already used.' : error.message, 'error');
    toast(edit.id ? 'Charity updated' : 'Charity added');
    setEdit(null); load();
  }

  async function remove(c) {
    if (!window.confirm(`Delete ${c.name}? Members who chose it will need to pick another. Past donations are kept. To hide it instead, untick "Visible".`)) return;
    const { error } = await supabase.from('charities').delete().eq('id', c.id);
    if (error) return toast(error.message, 'error');
    toast('Charity deleted'); load();
  }

  async function uploadImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Choose an image file.', 'error');
    setBusy(true);
    const path = `${Date.now()}-${slugify(file.name)}`;
    const { error } = await supabase.storage.from('charity-media').upload(path, file, { contentType: file.type });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    const { data } = supabase.storage.from('charity-media').getPublicUrl(path);
    setEdit((x) => ({ ...x, image_url: data.publicUrl }));
  }

  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setEvent = (i, k, v) => setEdit({ ...edit, events: edit.events.map((ev, j) => (j === i ? { ...ev, [k]: v } : ev)) });

  if (!rows) return <Loader />;
  return (
    <>
      <div className="spread"><h1 style={{ fontSize: 'var(--t-2xl)' }}>Charities</h1>
        <button className="btn btn-primary" onClick={() => setEdit({ ...EMPTY })}>Add charity</button></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Charity</th><th>Cause</th><th>Status</th><th className="num">Events</th><th /></tr></thead>
        <tbody>{rows.map((c) => (
          <tr key={c.id}>
            <td><b>{c.name}</b><div className="small muted">/{c.slug}</div></td>
            <td>{c.category || '—'}</td>
            <td className="row" style={{ gap: 6 }}>
              <span className={`pill ${c.active ? 'pill-ok' : ''}`}>{c.active ? 'Visible' : 'Hidden'}</span>
              {c.featured && <span className="pill pill-rose">Featured</span>}</td>
            <td className="num">{(c.events || []).length}</td>
            <td className="row" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...EMPTY, ...c, events: c.events || [] })}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>Delete</button></td>
          </tr>
        ))}</tbody>
      </table></div>

      {edit && (
        <Modal title={edit.id ? `Edit ${edit.name}` : 'Add a charity'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <div className="field"><label htmlFor="cn">Name</label><input id="cn" className="input" required value={edit.name} onChange={set('name')} /></div>
            <div className="field"><label htmlFor="cs">Web address</label><input id="cs" className="input" placeholder={slugify(edit.name) || 'auto from name'} value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })} />
              <span className="hint">/charities/{edit.slug || slugify(edit.name)}</span></div>
            <div className="field"><label htmlFor="ct">One-line summary</label><input id="ct" className="input" value={edit.tagline || ''} onChange={set('tagline')} /></div>
            <div className="field"><label htmlFor="cd">Description</label><textarea id="cd" className="input" value={edit.description || ''} onChange={set('description')} /></div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field"><label htmlFor="cc">Cause</label><input id="cc" className="input" value={edit.category || ''} onChange={set('category')} /></div>
              <div className="field"><label htmlFor="cl">Location</label><input id="cl" className="input" value={edit.location || ''} onChange={set('location')} /></div>
            </div>
            <div className="field"><label htmlFor="cw">Website</label><input id="cw" className="input" type="url" value={edit.website || ''} onChange={set('website')} /></div>
            <div className="field"><label>Image</label>
              <CharityCover charity={edit} style={{ maxWidth: 260 }} />
              <div className="row">
                <label className="btn btn-ghost btn-sm">{busy ? 'Uploading…' : 'Upload image'}<input type="file" accept="image/*" hidden onChange={(e) => uploadImage(e.target.files?.[0])} /></label>
                <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="or paste an image URL" value={edit.image_url || ''} onChange={set('image_url')} />
              </div></div>
            <div className="field"><label>Upcoming events</label>
              {(edit.events || []).map((ev, i) => (
                <div className="row" key={i} style={{ marginBottom: 8 }}>
                  <input className="input" style={{ flex: 2, minWidth: 140 }} placeholder="Event, e.g. Charity golf day" value={ev.title || ''} onChange={(e) => setEvent(i, 'title', e.target.value)} />
                  <input className="input" style={{ flex: 1, minWidth: 140 }} type="date" value={ev.date || ''} onChange={(e) => setEvent(i, 'date', e.target.value)} />
                  <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Location" value={ev.location || ''} onChange={(e) => setEvent(i, 'location', e.target.value)} />
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setEdit({ ...edit, events: edit.events.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit({ ...edit, events: [...(edit.events || []), { title: '', date: '', location: '' }] })}>Add event</button>
            </div>
            <div className="row" style={{ marginBottom: 16 }}>
              <label className="check"><input type="checkbox" checked={edit.active} onChange={set('active')} /> Visible to members</label>
              <label className="check"><input type="checkbox" checked={edit.featured} onChange={set('featured')} /> Feature on homepage</label>
            </div>
            <button className="btn btn-primary" disabled={busy}>{edit.id ? 'Save changes' : 'Add charity'}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
