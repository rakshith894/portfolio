'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ResumeActions({ url, name }: { url?: string; name: string }) {
  const [preview, setPreview] = useState(false);
  if (!url) return <p className="content-caption">Résumé coming soon.</p>;
  return <section className="resume-actions" aria-label="Résumé">
    <div><Button variant="outline" onClick={() => setPreview(value => !value)} aria-expanded={preview}>{preview ? 'Close résumé' : 'View résumé'}</Button>
      <a className="resume-download" href={url} download={`${name.replace(/[^\p{L}\p{N} -]/gu, '').trim() || 'Portfolio'}-Resume.pdf`}>Download résumé ↓</a></div>
    {preview && <><iframe src={url} title={`${name}'s résumé`} className="resume-preview" /><a href={url} target="_blank" rel="noopener noreferrer">Open résumé in a new tab ↗</a></>}
  </section>;
}
