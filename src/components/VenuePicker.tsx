import { useState } from 'react';
import { db } from '../db/db';
import { CURRENCIES, type Venue } from '../db/schema';
import { Sheet } from './ui';

export function VenueSheet({ venue, onClose, onSaved }: { venue?: Venue; onClose: () => void; onSaved?: (id: number) => void }) {
  const [v, setV] = useState<Venue>(venue ?? { name: '', city: '', country: 'Finland', defaultCurrency: 'EUR' });
  const set = (p: Partial<Venue>) => setV({ ...v, ...p });
  return (
    <Sheet title={venue ? 'Edit venue' : 'New venue'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!v.name.trim()) return;
          const id = (await db.venues.put({ ...v, name: v.name.trim(), city: v.city.trim(), country: v.country.trim() })) as number;
          onSaved?.(id);
          onClose();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input autoFocus value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="Casino Helsinki" />
        </label>
        <div className="grid2">
          <label className="field">
            <span>City</span>
            <input value={v.city} onChange={(e) => set({ city: e.target.value })} placeholder="Helsinki" />
          </label>
          <label className="field">
            <span>Country</span>
            <input value={v.country} onChange={(e) => set({ country: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Currency at this venue</span>
          <select value={v.defaultCurrency} onChange={(e) => set({ defaultCurrency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!v.name.trim()}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function VenuePicker({ venues, value, onChange }: { venues: Venue[]; value?: number; onChange: (v: Venue | undefined) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <label className="field">
      <span>Venue</span>
      <select
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value === '__new') return setAdding(true);
          onChange(venues.find((v) => v.id === Number(e.target.value)));
        }}
      >
        <option value="">—</option>
        {venues.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
            {v.city ? `, ${v.city}` : ''}
          </option>
        ))}
        <option value="__new">+ New venue…</option>
      </select>
      {adding && (
        <VenueSheet
          onClose={() => setAdding(false)}
          onSaved={async (id) => onChange(await db.venues.get(id))}
        />
      )}
    </label>
  );
}
