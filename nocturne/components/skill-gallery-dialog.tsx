'use client';
import { useState, type SubmitEvent } from 'react';
import { Plus, Pencil, Trash2, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { speakIsland } from '@/lib/island-commands';
import { skillPlacement } from '@/lib/skill-placement';
import { SKILL_COLORS, type GallerySkill } from '@/lib/skill-gallery';
type Props = {
  skills: GallerySkill[];
  selected: string | null;
  canEdit: boolean;
  onSelect: (id: string | null) => void;
  onSave: (skill: GallerySkill, remove?: boolean) => Promise<string | null>;
  onClose: () => void;
};
export function SkillGalleryDialog(props: Props) {
  const selected = props.skills.find((skill) => skill.id === props.selected);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="skill-gallery-dialog">
        <span className="hall-project-eyebrow">
          NOCTURNE / THE SKILLS GALLERY
        </span>
        <DialogTitle>Ideas in the air.</DialogTitle>
        <DialogDescription>
          A constellation of what I know, and how I use it.
        </DialogDescription>
        <nav className="skill-gallery-tabs" aria-label="Skills">
          {props.skills.map((skill) => (
            <Button
              key={skill.id}
              variant="ghost"
              aria-pressed={skill.id === selected?.id}
              style={
                {
                  '--skill-accent': SKILL_COLORS[skill.color],
                } as React.CSSProperties
              }
              onClick={() => props.onSelect(skill.id)}
            >
              <Sparkles />
              {skill.title}
            </Button>
          ))}
          {props.canEdit && (
            <Button variant="outline" onClick={() => props.onSelect(null)}>
              <Plus />
              Add skill
            </Button>
          )}
        </nav>
        {!props.canEdit && (
          <div className="skill-reading-list">
            {props.skills.map((skill, index) => (
              <article
                key={skill.id}
                style={
                  {
                    '--skill-accent': SKILL_COLORS[skill.color],
                  } as React.CSSProperties
                }
              >
                <span>{skillPlacement(index).area}</span>
                <h3>{skill.title}</h3>
                <p>
                  {skill.description || 'More about this skill is coming soon.'}
                </p>
                <Button
                  variant="ghost"
                  onClick={() =>
                    speakIsland(`${skill.title}. ${skill.description}`, {
                      rate: 1,
                    })
                  }
                >
                  Read aloud
                </Button>
              </article>
            ))}
          </div>
        )}
        {props.canEdit && (
          <SkillContent
            key={selected?.id ?? 'new'}
            {...props}
            skill={selected}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function SkillContent({
  skill,
  canEdit,
  onSave,
}: Props & { skill?: GallerySkill }) {
  const [editing, setEditing] = useState(!skill && canEdit),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [draft, setDraft] = useState<GallerySkill>(
    skill ?? {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      color: 'gold',
    },
  );
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const problem = await onSave(draft);
    setBusy(false);
    setError(problem ?? '');
    if (!problem) setEditing(false);
  }
  if (editing && canEdit)
    return (
      <form className="hall-project-editor" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Skill name
            <input
              name="skill-title"
              value={draft.title}
              maxLength={60}
              required
              placeholder="For example, a language or design skill"
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </label>
          <label>
            How you use it
            <textarea
              name="skill-description"
              rows={5}
              maxLength={1000}
              value={draft.description}
              placeholder="Explain what you can do, how you work, or something you have built with this skill."
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <fieldset className="skill-color-picker" aria-label="Hologram color">
            {Object.entries(SKILL_COLORS).map(([color, value]) => (
              <Button
                type="button"
                key={color}
                aria-label={`${color} hologram`}
                aria-pressed={draft.color === color}
                style={{ backgroundColor: value }}
                onClick={() =>
                  setDraft({ ...draft, color: color as GallerySkill['color'] })
                }
              />
            ))}
          </fieldset>
          {error && (
            <p className="hall-project-error" role="alert">
              {error}
            </p>
          )}
          <div className="hall-project-editor-actions">
            <Button type="submit">
              <Save />
              {busy ? 'Saving…' : 'Save skill'}
            </Button>
            {skill && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            )}
          </div>
          <p className="hall-storage-note">
            Saved locally. Publish your portfolio to share the new hologram.
          </p>
        </fieldset>
      </form>
    );
  if (!skill)
    return (
      <div className="hall-project-empty">
        <Sparkles />
        <h3>A little space for possibility.</h3>
        <p>New skills will appear here as floating cards.</p>
      </div>
    );
  return (
    <section
      className="skill-detail"
      style={
        { '--skill-accent': SKILL_COLORS[skill.color] } as React.CSSProperties
      }
    >
      <Sparkles />
      <h3>{skill.title}</h3>
      <p>{skill.description || 'More about this skill is coming soon.'}</p>
      {canEdit && (
        <div className="hall-project-editor-actions">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            Edit skill
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const problem = await onSave(skill, true);
              setBusy(false);
              setError(problem ?? '');
            }}
          >
            <Trash2 />
            Remove skill
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
