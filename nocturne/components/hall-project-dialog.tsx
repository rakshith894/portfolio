'use client';

import { useState, type SubmitEvent } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight,
  Pencil,
  Save,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  projectUrl,
  hallProjectPage,
  hallPageCount,
  HALL_PAGE_SIZE,
  type HallFrameId,
  type HallProject,
} from '@/lib/hall-projects';

type Props = {
  project: HallProject;
  projects: HallProject[];
  canEdit: boolean;
  busy: boolean;
  onRemove: (project: HallProject) => Promise<string | null>;
  onSelect: (id: HallFrameId) => void;
  onSave: (project: HallProject) => Promise<string | null>;
  onImportDrafts: () => Promise<string | null>;
  onClose: () => void;
  onAdd: () => Promise<string | null>;
};
export function HallProjectDialog(props: Props) {
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const page = Math.max(
    0,
    Math.floor(
      props.projects.findIndex((project) => project.id === props.project.id) /
        HALL_PAGE_SIZE,
    ),
  );
  const pages = hallPageCount(props.projects);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="hall-project-dialog">
        <div className="hall-project-heading">
          <span className="hall-project-eyebrow">
            NOCTURNE / THE MASTER HALL
          </span>
          <DialogTitle>{props.project.title || 'Your new frame'}</DialogTitle>
          <DialogDescription>
            Live projects, behind the glass.
          </DialogDescription>
        </div>
        <nav className="hall-frame-tabs" aria-label="Project frames">
          {hallProjectPage(props.projects, page).map((project, index) => (
            <Button
              key={project.id}
              variant="ghost"
              aria-pressed={project.id === props.project.id}
              onClick={() => props.onSelect(project.id)}
            >
              <span>
                {String(page * HALL_PAGE_SIZE + index + 1).padStart(2, '0')}
              </span>
              {project.title || 'Empty frame'}
            </Button>
          ))}
        </nav>
        <div className="hall-collection-controls">
          <Button
            variant="ghost"
            aria-label="Previous collection page"
            disabled={page === 0}
            onClick={() =>
              props.onSelect(props.projects[(page - 1) * HALL_PAGE_SIZE].id)
            }
          >
            <ChevronLeft />
          </Button>
          <output aria-live="polite">
            Collection {page + 1} / {pages}
          </output>
          <Button
            variant="ghost"
            aria-label="Next collection page"
            disabled={page >= pages - 1}
            onClick={() =>
              props.onSelect(props.projects[(page + 1) * HALL_PAGE_SIZE].id)
            }
          >
            <ChevronRight />
          </Button>
          {props.canEdit && (
            <Button
              variant="outline"
              disabled={props.busy}
              onClick={async () =>
                setImportMessage((await props.onAdd()) ?? '')
              }
            >
              <Plus />
              {props.busy ? 'Updating…' : 'Add frame'}
            </Button>
          )}
        </div>
        {props.canEdit && (
          <div className="hall-local-editor-note">
            <p>
              Local editor · Save here, then publish to update your shared
              portfolio.
            </p>
            <Button
              variant="ghost"
              disabled={importing}
              onClick={async () => {
                setImporting(true);
                const problem = await props.onImportDrafts();
                setImportMessage(
                  problem ||
                    'Browser drafts imported into your local project files. Publish when ready.',
                );
                setImporting(false);
              }}
            >
              {importing ? 'Importing…' : 'Import browser drafts'}
            </Button>
            {importMessage && <output>{importMessage}</output>}
          </div>
        )}
        {props.canEdit && (
          <FrameRemoval
            key={props.project.id}
            project={props.project}
            onRemove={props.onRemove}
            busy={props.busy}
          />
        )}
        <FrameContent
          key={`${props.project.id}:${props.project.url}`}
          {...props}
        />
      </DialogContent>
    </Dialog>
  );
}

function FrameRemoval({
  project,
  onRemove,
  busy,
}: Pick<Props, 'project' | 'onRemove' | 'busy'>) {
  const [confirming, setConfirming] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="hall-frame-removal">
      {confirming ? (
        <>
          <p>
            Remove{' '}
            {project.title ? '“' + project.title + '”' : 'this empty frame'}{' '}
            from the gallery? Its saved project details will be removed too.
          </p>
          <div>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                const problem = await onRemove(project);
                setError(problem ?? '');
              }}
            >
              <Trash2 />
              {busy ? 'Removing…' : 'Remove frame'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setError('');
              }}
            >
              Keep frame
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          <Trash2 />
          Remove this frame
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function FrameContent({ project, onSave, canEdit }: Props) {
  const [editing, setEditing] = useState(canEdit && !project.url);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [url, setUrl] = useState(project.url);
  const [description, setDescription] = useState(project.description);
  const [cover, setCover] = useState(project.cover ?? '');
  const [error, setError] = useState('');
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || saving) return;
    const valid = projectUrl(url);
    if (!valid) {
      setError('Enter a complete http:// or https:// website URL.');
      return;
    }
    if (!title.trim()) {
      setError('Add a project title.');
      return;
    }
    setSaving(true);
    const problem = await onSave({
      id: project.id,
      title: title.trim(),
      description: description.trim(),
      url: valid,
      ...(cover ? { cover } : {}),
    });
    setSaving(false);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setEditing(false);
  }
  async function upload(file: File | undefined) {
    if (!file || !canEdit) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError('Choose a PNG, JPEG or WebP screenshot smaller than 5 MB.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch('/__nocturne/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const result = (await response.json()) as {
        cover?: string;
        error?: string;
      };
      if (!response.ok || !result.cover)
        throw new Error(result.error ?? 'Could not upload your cover.');
      setCover(result.cover);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : 'Could not open that image.',
      );
    } finally {
      setSaving(false);
    }
  }
  if (canEdit && editing)
    return (
      <form
        className="hall-project-editor"
        onSubmit={submit}
        aria-busy={saving}
      >
        <fieldset disabled={saving}>
          <div className="hall-editor-intro">
            <h3>
              {project.url ? 'Edit this frame' : 'Make room for your work.'}
            </h3>
            <p>
              Add a live demo and a few words about the project. Its cover will
              appear behind the glass.
            </p>
          </div>
          <label>
            Project title
            <input
              autoComplete="off"
              name="title"
              value={title}
              maxLength={80}
              required
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Your project name"
            />
          </label>
          <label>
            Live demo URL
            <input
              autoComplete="off"
              name="url"
              type="url"
              value={url}
              maxLength={2048}
              required
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://your-project.com"
            />
          </label>
          <label>
            About the project
            <textarea
              name="description"
              value={description}
              maxLength={600}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What you built, how it works, and what makes it special."
            />
          </label>
          <div className="hall-cover-upload">
            {cover && (
              <Image
                src={cover}
                alt="Project cover preview"
                width={150}
                height={100}
                unoptimized
              />
            )}
            <label>
              Cover image / screenshot
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void upload(event.target.files?.[0])}
              />
            </label>
            {cover && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCover('')}
              >
                Remove cover
              </Button>
            )}
          </div>
          {error && (
            <p className="hall-project-error" role="alert">
              {error}
            </p>
          )}
          <div className="hall-project-editor-actions">
            <Button type="submit">
              <Save />
              {saving ? 'Saving…' : 'Save to frame'}
            </Button>
            {project.url && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setTitle(project.title);
                    setUrl(project.url);
                    setDescription(project.description);
                    setCover(project.cover ?? '');
                    setError('');
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
          <p className="hall-storage-note">
            Saved to your local portfolio files. Visitors see these changes
            after you publish.
          </p>
        </fieldset>
      </form>
    );
  if (!project.url)
    return (
      <div className="hall-project-empty">
        <span>THE COLLECTION IS GROWING</span>
        <h3>A new chapter awaits.</h3>
        <p>
          Another project will take its place behind this glass soon. Explore
          the other frames in the collection.
        </p>
      </div>
    );
  return (
    <div className="hall-project-preview">
      <div className="hall-project-description">
        <p>{project.description || 'Explore the live project below.'}</p>
        <div>
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => {
                setTitle(project.title);
                setUrl(project.url);
                setDescription(project.description);
                setCover(project.cover ?? '');
                setError('');
                setEditing(true);
              }}
            >
              <Pencil />
              Edit frame
            </Button>
          )}
          <a href={project.url} target="_blank" rel="noopener noreferrer">
            Open website <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      <LiveDemo key={project.url} project={project} />
      <p className="hall-storage-note">
        If the preview stays blank, this site may block embedding. Use Open
        website to view the demo.
      </p>
    </div>
  );
}

function LiveDemo({ project }: { project: HallProject }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="hall-demo-surface">
      {!loaded && (
        <output className="hall-demo-loading">Opening the live demo…</output>
      )}
      <iframe
        src={project.url}
        title={`${project.title} — live demo`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
