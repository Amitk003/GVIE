/**
 * The field screen.
 *
 * A worker picks a photo, fills in the project and the place, and presses send.
 * Before anything leaves the phone we show what we honestly know: the hash, the
 * seal reading, and any problem with the place.
 */

'use client';

import { useState } from 'react';
import { TrustBadge as TrustBadgeComponent, type TrustBadgeProps } from './TrustBadge';
import { badgeForSeal, prepareCapture } from '../lib/capture';

const TEMPO_PHASES = ['Baseline_Before', 'Interim_Work', 'Outcome_After'] as const;

type Props = {
  onSend: (body: Record<string, unknown>) => Promise<void>;
};

export function CaptureForm({ onSend }: Props) {
  const [projId, setProjId] = useState('');
  const [geoCoords, setGeoCoords] = useState('');
  const [tempoPhase, setTempoPhase] = useState<(typeof TEMPO_PHASES)[number]>('Baseline_Before');
  const [baseAssetId, setBaseAssetId] = useState('');
  const [badge, setBadge] = useState<TrustBadgeProps | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onPick(file: File) {
    setSent(false);
    const buffer = await file.arrayBuffer();
    const result = await prepareCapture({
      file: buffer,
      projId,
      tempoPhase,
      geoCoords: geoCoords.trim() === '' ? null : geoCoords.trim(),
      baseAssetId: baseAssetId.trim() === '' ? null : baseAssetId.trim(),
    });
    setBadge(badgeForSeal(result.seal));
    setErrors(result.errors);
    if (result.ok && result.body) {
      await send(result.body);
    }
  }

  async function send(body: Record<string, unknown>) {
    setSending(true);
    try {
      await onSend(body);
      setSent(true);
      setErrors([]);
    } catch (error) {
      setSent(false);
      setErrors([error instanceof Error ? error.message : 'the photo did not go up']);
    } finally {
      setSending(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '16px', maxWidth: '520px' }}>
      <h1 style={{ fontSize: '22px', margin: 0 }}>Add proof of work</h1>

      <label style={fieldStyle}>
        Project
        <input
          value={projId}
          onChange={(event) => setProjId(event.target.value)}
          placeholder="WATER-01"
          style={inputStyle}
        />
      </label>

      <label style={fieldStyle}>
        Place, as latitude and longitude
        <input
          value={geoCoords}
          onChange={(event) => setGeoCoords(event.target.value)}
          placeholder="12.97, 77.59"
          style={inputStyle}
        />
      </label>

      <label style={fieldStyle}>
        Which stage is this photo
        <select
          value={tempoPhase}
          onChange={(event) =>
            setTempoPhase(event.target.value as (typeof TEMPO_PHASES)[number])
          }
          style={inputStyle}
        >
          {TEMPO_PHASES.map((phase) => (
            <option key={phase} value={phase}>
              {phase.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>

      {tempoPhase === 'Outcome_After' ? (
        <label style={fieldStyle}>
          Before photo id, if you have it
          <input
            value={baseAssetId}
            onChange={(event) => setBaseAssetId(event.target.value)}
            placeholder="gvie/WATER-01/before_1"
            style={inputStyle}
          />
        </label>
      ) : null}

      <label style={fieldStyle}>
        Photo
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onPick(file);
          }}
          style={inputStyle}
        />
      </label>

      {badge ? <TrustBadgeComponent {...badge} /> : null}

      {errors.length > 0 ? (
        <ul data-testid="capture-errors" style={{ color: '#a52020', margin: 0, paddingLeft: '18px' }}>
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {sent ? (
        <p data-testid="capture-sent" style={{ color: '#1b7f4d', margin: 0 }}>
          Sent. Our team will check the seal before anything is called Verified.
        </p>
      ) : null}

      {sending ? <p style={{ margin: 0 }}>Sending...</p> : null}
    </section>
  );
}

const fieldStyle = { display: 'grid', gap: '6px', fontSize: '14px' } as const;

const inputStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cccccc',
  fontSize: '15px',
} as const;
