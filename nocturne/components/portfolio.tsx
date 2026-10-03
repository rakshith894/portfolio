'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Destination } from '@/lib/nocturne';
import savedProfile from '@/content/profile.json';
import savedSkills from '@/content/skills.json';
import savedProjects from '@/content/hall-projects.json';
import { readSkills, SKILL_COLORS } from '@/lib/skill-gallery';
import { readHallProjects } from '@/lib/hall-projects';
import {
  validateContactProfile,
  type ContactProfile,
} from '@/lib/contact-profile';
import { ResumeActions } from '@/components/resume-actions';
const sections = ['about', 'contact', 'skills', 'projects'] as const;
const labels = {
  about: 'About',
  contact: 'Contact',
  skills: 'Skills',
  projects: 'Projects',
};
export default function Portfolio({
  section,
  onClose,
  onEnter,
}: {
  section: Destination;
  onClose: () => void;
  onEnter: () => void;
}) {
  const [current, setCurrent] = useState(
    section === 'resume' ? 'about' : section,
  );
  const [animKey, setAnimKey] = useState(0);
  const [profile, setProfile] = useState<ContactProfile>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('nocturne_custom_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          const valid = validateContactProfile(parsed);
          if (valid) return valid;
        }
      } catch {}
    }
    return savedProfile;
  });
  const [skills, setSkills] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('nocturne_custom_skills');
        if (stored) {
          const parsed = JSON.parse(stored);
          const custom = readSkills(parsed);
          if (custom && custom.length > 0) return custom;
        }
      } catch {}
    }
    return readSkills(savedSkills);
  });
  const [projects, setProjects] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('nocturne_custom_projects');
        if (stored) {
          const custom = readHallProjects(stored);
          if (custom && custom.length > 0) return custom.filter((p) => p.url);
        }
      } catch {}
    }
    return readHallProjects(JSON.stringify(savedProjects)).filter(
      (project) => project.url,
    );
  });
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const controller = new AbortController();
    void Promise.all(
      ['profile', 'skills', 'projects'].map(async (kind) => {
        const response = await fetch(`/__nocturne/${kind}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          profile?: unknown;
          skills?: unknown;
          projects?: unknown;
        };
        if (kind === 'profile') {
          const value = validateContactProfile(data.profile);
          if (value) setProfile(value);
        }
        if (kind === 'skills') setSkills(readSkills(data.skills));
        if (kind === 'projects')
          setProjects(
            readHallProjects(JSON.stringify(data.projects)).filter(
              (project) => project.url,
            ),
          );
      }),
    ).catch(() => {});
    return () => controller.abort();
  }, []);

  function handleTabChange(value: string) {
    setCurrent(value as typeof current);
    setAnimKey((k) => k + 1);
  }

  const index = sections.indexOf(current as (typeof sections)[number]);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="archive-dialog portfolio-dialog">
        <div className="portfolio-glow-ring" aria-hidden />
        <div className="eyebrow portfolio-eyebrow">NOCTURNE / QUICK PORTFOLIO</div>
        <DialogTitle className="dialog-heading portfolio-title-anim">
          {profile.name}. The person and the work.
        </DialogTitle>
        <DialogDescription className="portfolio-desc-anim">
          About &amp; contact → Skills → Projects. Everything in one place.
        </DialogDescription>
        <Tabs value={current} onValueChange={handleTabChange}>
          <TabsList
            className="portfolio-tabs"
            variant="line"
            aria-label="Portfolio sections"
          >
            {sections.map((id) => (
              <TabsTrigger key={id} value={id}>
                {labels[id]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent className="portfolio-content" value="about">
            <div key={`about-${animKey}`} className="portfolio-section-reveal">
              <span className="section-index">01 / ABOUT</span>
              {profile.photo && (
                <div className="portrait-glow-wrap">
                  <span className="portrait-orbit" aria-hidden />
                  <Image
                    unoptimized
                    className="quick-portrait"
                    src={profile.photo}
                    width={100}
                    height={100}
                    alt={profile.name}
                  />
                </div>
              )}
              <h3>{profile.role}</h3>
              <p className="preserve-copy">{profile.bio}</p>
              <ResumeActions url={profile.resume} name={profile.name} />
            </div>
          </TabsContent>
          <TabsContent className="portfolio-content" value="contact">
            <div key={`contact-${animKey}`} className="portfolio-section-reveal">
              <span className="section-index">02 / CONTACT</span>
              <h3>Start a conversation.</h3>
              <div className="quick-contact">
                {profile.email && (
                  <a href={'mailto:' + profile.email}>{profile.email}</a>
                )}
                {profile.phone && (
                  <a href={'tel:' + profile.phone}>{profile.phone}</a>
                )}
                {profile.location && <p>{profile.location}</p>}
                {(['website', 'github', 'linkedin'] as const).map(
                  (key) =>
                    profile[key] && (
                      <a
                        key={key}
                        href={profile[key]}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {key} ↗
                      </a>
                    ),
                )}
                {!profile.email &&
                  !profile.phone &&
                  !profile.location &&
                  !profile.website &&
                  !profile.github &&
                  !profile.linkedin && (
                    <p>Contact details have not been added yet.</p>
                  )}
              </div>
            </div>
          </TabsContent>
          <TabsContent className="portfolio-content" value="skills">
            <div key={`skills-${animKey}`} className="portfolio-section-reveal">
              <span className="section-index">03 / SKILLS</span>
              <h3>Tools, ideas, and experience.</h3>
              {skills.length ? (
                skills.map((skill, i) => (
                  <article
                    className="quick-skill"
                    key={skill.id}
                    style={{
                      borderColor: SKILL_COLORS[skill.color],
                      animationDelay: `${i * 55}ms`,
                    }}
                  >
                    <h4>{skill.title}</h4>
                    <p className="preserve-copy">{skill.description}</p>
                  </article>
                ))
              ) : (
                <p>Skills have not been added yet.</p>
              )}
            </div>
          </TabsContent>
          <TabsContent className="portfolio-content" value="projects">
            <div key={`projects-${animKey}`} className="portfolio-section-reveal">
              <span className="section-index">04 / PROJECTS</span>
              <h3>Selected work.</h3>
              {projects.length ? (
                projects.map((project, i) => (
                  <article
                    className="project-preview"
                    key={project.id}
                    style={{ animationDelay: `${i * 75}ms` }}
                  >
                    {project.cover && (
                      <Image
                        unoptimized
                        src={project.cover}
                        width={320}
                        height={200}
                        alt={project.title}
                      />
                    )}
                    <div>
                      <h4>{project.title}</h4>
                      <p className="preserve-copy">{project.description}</p>
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open project ↗
                      </a>
                    </div>
                  </article>
                ))
              ) : (
                <p>Projects have not been added yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <div className="portfolio-bottom">
          <Button variant="ghost" onClick={onEnter}>
            Explore the island
          </Button>
          {index < sections.length - 1 ? (
            <Button
              variant="outline"
              onClick={() => {
                const next = sections[index + 1];
                setCurrent(next);
                setAnimKey((k) => k + 1);
              }}
            >
              Next: {labels[sections[index + 1]]} →
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Back to Nocturne
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
