'use client';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import Image from 'next/image';
import { ArrowUpRight, Mail, Phone, MapPin, Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PROFILE_LIMITS,
  validateContactProfile,
  type ContactProfile,
} from '@/lib/contact-profile';
import { useLiveEffects } from '@/lib/live-effects';
import { ResumeActions } from '@/components/resume-actions';

type Props = {
  profile: ContactProfile;
  canEdit: boolean;
  onSave: (profile: ContactProfile) => void;
  onClose: () => void;
};
export function ContactApparitionDialog({
  profile,
  canEdit,
  onSave,
  onClose,
}: Props) {
  const [liveEffects] = useLiveEffects();
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [draft, setDraft] = useState(profile);
  const [revealed, setRevealed] = useState(0);
  const fields = [
    'name',
    'role',
    'bio',
    'email',
    'phone',
    'location',
    'website',
    'github',
    'linkedin',
  ] as const;
  const total = fields.reduce(
    (sum, key) => sum + Array.from(profile[key] || '').length,
    0,
  );
  useEffect(() => {
    const reduced = !liveEffects;
    let frame = 0;
    const start = performance.now();
    // Fixed 60 chars/sec — independent of total length so short and long
    // profiles both feel deliberately paced rather than rushed or sluggish.
    const speed = 60;
    const tick = (time: number) => {
      const count = reduced
        ? total
        : Math.min(total, Math.floor(((time - start) / 1000) * speed));
      setRevealed(count);
      if (count < total) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [profile, total, liveEffects]);
  function typed(key: (typeof fields)[number]) {
    const offset = fields
      .slice(0, fields.indexOf(key))
      .reduce((sum, field) => sum + Array.from(profile[field] || '').length, 0);
    const characters = Array.from(profile[key] || '');
    const count = Math.max(0, revealed - offset);
    return (
      <>
        <span className="sr-only">{profile[key]}</span>
        <span aria-hidden="true">
          {characters.slice(0, count).join('')}
          <span className="hologram-unrevealed">
            {characters.slice(count).join('')}
          </span>
        </span>
      </>
    );
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    const value = validateContactProfile(draft);
    if (!value) {
      setError('Check your name, email, phone, and full website URLs.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/__nocturne/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      const result = (await response.json()) as {
        error?: string;
        profile?: ContactProfile;
      };
      if (response.ok && result.profile) {
        onSave(result.profile);
        setEditing(false);
        return;
      }
      throw new Error(result.error || 'Could not save profile to the project.');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save profile.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file || !canEdit) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError('Choose a PNG, JPEG, or WebP photo smaller than 5 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Decode first so a malformed file cannot replace the visible portrait.
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('Invalid image'));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      try {
        const response = await fetch('/__nocturne/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
        });
        const result = (await response.json()) as {
          error?: string;
          photo?: string;
        };
        if (response.ok && result.photo) {
          setDraft((current) => ({ ...current, photo: result.photo! }));
          return;
        }
        throw new Error(result.error || 'Could not save the uploaded photo.');
      } catch {
        throw new Error('Local editor unavailable. Photo was not saved.');
      }
    } catch {
      setError(
        'That photo could not be opened. Try a different PNG, JPEG, or WebP image.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function uploadResume(file: File | undefined) {
    if (!file || !canEdit || busy) return;
    if (file.type !== 'application/pdf' || file.size > 5 * 1024 * 1024) {
      setError('Choose a PDF résumé smaller than 5 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const resume = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('Invalid PDF'));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      try {
        const response = await fetch('/__nocturne/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume }),
        });
        const result = (await response.json()) as {
          resume?: string;
          error?: string;
        };
        if (response.ok && result.resume) {
          setDraft((current) => ({ ...current, resume: result.resume }));
          return;
        }
        throw new Error(result.error || 'Could not save the uploaded resume.');
      } catch {
        throw new Error('Local editor unavailable. Resume was not saved.');
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'The résumé could not be uploaded.',
      );
    } finally {
      setBusy(false);
    }
  }
  // Periodically add a glitch class to the dialog for the CSS glitch animation
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!liveEffects) return;
    const effectLayer = dialogRef.current;
    let t: ReturnType<typeof setTimeout>;
    let removal: ReturnType<typeof setTimeout>;
    const glitch = () => {
      const el = dialogRef.current?.closest(
        '[data-slot="dialog-content"]',
      ) as HTMLElement | null;
      if (el) {
        el.classList.add('holo-glitching');
        removal = setTimeout(() => el.classList.remove('holo-glitching'), 350);
      }
      t = setTimeout(glitch, 4000 + Math.random() * 5000);
    };
    t = setTimeout(glitch, 2500);
    return () => {
      clearTimeout(t);
      clearTimeout(removal);
      effectLayer
        ?.closest('[data-slot="dialog-content"]')
        ?.classList.remove('holo-glitching');
    };
  }, [liveEffects]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className={`contact-apparition-dialog${editing ? ' is-editing' : ''}`}
      >
        {/* ── Live hologram effects layer ── */}
        <div className="holo-fx" aria-hidden="true" ref={dialogRef}>
          <div className="holo-scanline" />
          <div className="holo-shimmer" />
          {/* Corner brackets */}
          <span className="holo-corner hc-tl" />
          <span className="holo-corner hc-tr" />
          <span className="holo-corner hc-bl" />
          <span className="holo-corner hc-br" />
          {/* Rising particles */}
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="holo-particle"
              style={{ '--hi': i } as React.CSSProperties}
            />
          ))}
          {/* Horizontal data trace lines */}
          <span className="holo-trace holo-trace-1" />
          <span className="holo-trace holo-trace-2" />
        </div>

        <div className="apparition-scroll">
          {(editing ? draft.photo : profile.photo) && (
            <div className="apparition-portrait">
              <Image
                src={editing ? draft.photo : profile.photo}
                width={240}
                height={240}
                unoptimized
                alt={`${profile.name}'s portrait`}
              />
            </div>
          )}
          <div className="apparition-introduction">
            <span className="hall-project-eyebrow">
              THE PERSON BEHIND THE WORLD
            </span>
            <DialogTitle>{typed('name')}</DialogTitle>
            <DialogDescription>{typed('role')}</DialogDescription>
          </div>
          {editing && canEdit ? (
            <form className="hall-project-editor" onSubmit={submit}>
              <fieldset disabled={busy}>
                <label>
                  Your photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void upload(event.target.files?.[0])}
                  />
                </label>
                {draft.photo && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDraft({ ...draft, photo: '' })}
                  >
                    Remove photo
                  </Button>
                )}
                <label>
                  Your résumé (PDF, up to 5 MB)
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) =>
                      void uploadResume(event.target.files?.[0])
                    }
                  />
                </label>
                {draft.resume && (
                  <div className="resume-editor-status">
                    <span>
                      Résumé ready. Save your profile to publish this choice.
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDraft({ ...draft, resume: '' })}
                    >
                      Remove résumé
                    </Button>
                  </div>
                )}
                <div className="apparition-editor-grid">
                  {(
                    [
                      'name',
                      'role',
                      'email',
                      'phone',
                      'location',
                      'website',
                      'github',
                      'linkedin',
                    ] as const
                  ).map((key) => (
                    <label key={key}>
                      {
                        {
                          name: 'Name',
                          role: 'Role / headline',
                          email: 'Email',
                          phone: 'Phone',
                          location: 'Location',
                          website: 'Website',
                          github: 'GitHub URL',
                          linkedin: 'LinkedIn URL',
                        }[key]
                      }
                      <input
                        type={
                          key === 'email'
                            ? 'email'
                            : ['website', 'github', 'linkedin'].includes(key)
                              ? 'url'
                              : 'text'
                        }
                        value={draft[key]}
                        maxLength={PROFILE_LIMITS[key]}
                        required={key === 'name'}
                        onChange={(event) =>
                          setDraft({ ...draft, [key]: event.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  About you
                  <textarea
                    rows={5}
                    maxLength={PROFILE_LIMITS.bio}
                    value={draft.bio}
                    onChange={(event) =>
                      setDraft({ ...draft, bio: event.target.value })
                    }
                  />
                </label>
                <div className="hall-project-editor-actions">
                  <Button type="submit">
                    <Save />
                    {busy ? 'Saving…' : 'Save profile'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDraft(profile);
                      setError('');
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="hall-storage-note">
                  Edit locally, then publish to update the profile visitors see.
                  Blank contact fields stay hidden.
                </p>
              </fieldset>
            </form>
          ) : (
            <div className="apparition-details">
              <p className="apparition-bio">{typed('bio')}</p>
              <div className="apparition-contact-links">
                {profile.email && (
                  <a href={`mailto:${profile.email}`}>
                    <Mail size={18} />
                    {typed('email')}
                  </a>
                )}
                {profile.phone && (
                  <a href={`tel:${profile.phone.replace(/[^+\d]/g, '')}`}>
                    <Phone size={18} />
                    {typed('phone')}
                  </a>
                )}
                {profile.location && (
                  <p>
                    <MapPin size={18} />
                    {typed('location')}
                  </p>
                )}
                {(['website', 'github', 'linkedin'] as const).map(
                  (key) =>
                    profile[key] && (
                      <a
                        key={key}
                        href={profile[key]}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {typed(key)}
                        <ArrowUpRight size={18} />
                      </a>
                    ),
                )}
              </div>
              <ResumeActions url={profile.resume} name={profile.name} />
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft(profile);
                    setEditing(true);
                  }}
                >
                  <Pencil />
                  Edit photo, résumé &amp; contact
                </Button>
              )}
            </div>
          )}
          {error && (
            <p className="hall-project-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
