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
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Code2,
  Compass,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';

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
  const [profile, setProfile] = useState<ContactProfile>(savedProfile);
  const [skills, setSkills] = useState(() => readSkills(savedSkills));
  const [projects, setProjects] = useState(() =>
    readHallProjects(JSON.stringify(savedProjects)).filter(
      (project) => project.url,
    ),
  );

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
      <DialogContent className="portfolio-dialog">
        {/* ── Subtle Atmospheric Layer ── */}
        <div className="holo-fx" aria-hidden="true">
          {/* Corner brackets */}
          <span className="holo-corner hc-tl" />
          <span className="holo-corner hc-tr" />
          <span className="holo-corner hc-bl" />
          <span className="holo-corner hc-br" />
        </div>

        <div className="portfolio-scroll">
          {/* Header area */}
          <div className="portfolio-header">
            <div className="portfolio-header-badges">
              <div className="portfolio-eyebrow-badge">
                <span className="portfolio-pulse-dot" />
                <span>NOCTURNE SYSTEM · QUICK PORTFOLIO</span>
              </div>
              <div className="portfolio-status-pill">
                <span className="portfolio-status-beacon" />
                <span>LIVE OVERVIEW</span>
              </div>
            </div>

            <DialogTitle className="portfolio-dialog-title">
              {profile.name}{' '}
              <span className="portfolio-title-role">/ {profile.role}</span>
            </DialogTitle>

            <DialogDescription className="portfolio-dialog-desc">
              {profile.location ? `${profile.location} · ` : ''}Explore
              background, skill stack, contacts, and selected works in one
              place.
            </DialogDescription>
          </div>

          {/* Navigation Tabs */}
          <Tabs
            value={current}
            onValueChange={handleTabChange}
            className="portfolio-tabs-wrapper"
          >
            <TabsList
              className="portfolio-tabs"
              variant="line"
              aria-label="Portfolio sections"
            >
              <TabsTrigger value="about" className="portfolio-tab-trigger">
                <User size={13} />
                <span>About</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="portfolio-tab-trigger">
                <Mail size={13} />
                <span>Contact</span>
              </TabsTrigger>
              <TabsTrigger value="skills" className="portfolio-tab-trigger">
                <Code2 size={13} />
                <span>Skills ({skills.length})</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="portfolio-tab-trigger">
                <Briefcase size={13} />
                <span>Projects ({projects.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab: About */}
            <TabsContent className="portfolio-tab-content" value="about">
              <div
                key={`about-${animKey}`}
                className="portfolio-section-reveal"
              >
                <div className="portfolio-about-card">
                  <div className="portfolio-about-hero">
                    {profile.photo && (
                      <div className="portfolio-portrait-frame">
                        <span
                          className="portrait-orbit-ring ring-1"
                          aria-hidden
                        />
                        <span
                          className="portrait-orbit-ring ring-2"
                          aria-hidden
                        />
                        <Image
                          unoptimized
                          className="quick-portrait"
                          src={profile.photo}
                          width={110}
                          height={110}
                          alt={profile.name}
                        />
                      </div>
                    )}
                    <div className="portfolio-about-meta">
                      <span className="section-index">
                        01 / ABOUT THE CREATOR
                      </span>
                      <h3>{profile.name}</h3>
                      <div className="portfolio-role-tag">
                        <Sparkles size={12} />
                        <span>{profile.role}</span>
                      </div>
                      {profile.location && (
                        <div className="portfolio-location-tag">
                          <MapPin size={12} />
                          <span>{profile.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="portfolio-bio-block">
                    <p className="preserve-copy">{profile.bio}</p>
                  </div>

                  <ResumeActions url={profile.resume} name={profile.name} />
                </div>
              </div>
            </TabsContent>

            {/* Tab: Contact */}
            <TabsContent className="portfolio-tab-content" value="contact">
              <div
                key={`contact-${animKey}`}
                className="portfolio-section-reveal"
              >
                <span className="section-index">02 / START A CONVERSATION</span>
                <h3>Direct Communications</h3>
                <p className="portfolio-content-sub">
                  Reach out for collaborations, discussions, or opportunities.
                </p>

                <div className="portfolio-contact-grid">
                  {profile.email && (
                    <a
                      href={`mailto:${profile.email}`}
                      className="contact-card"
                    >
                      <div className="contact-icon email-icon">
                        <Mail size={18} />
                      </div>
                      <div className="contact-info">
                        <span className="contact-label">Email Address</span>
                        <span className="contact-value">{profile.email}</span>
                      </div>
                      <ArrowUpRight size={16} className="contact-arrow" />
                    </a>
                  )}

                  {profile.phone && (
                    <a
                      href={`tel:${profile.phone.replace(/[^+\d]/g, '')}`}
                      className="contact-card"
                    >
                      <div className="contact-icon phone-icon">
                        <Phone size={18} />
                      </div>
                      <div className="contact-info">
                        <span className="contact-label">Telephone</span>
                        <span className="contact-value">{profile.phone}</span>
                      </div>
                      <ArrowUpRight size={16} className="contact-arrow" />
                    </a>
                  )}

                  {profile.location && (
                    <div className="contact-card non-link">
                      <div className="contact-icon location-icon">
                        <MapPin size={18} />
                      </div>
                      <div className="contact-info">
                        <span className="contact-label">Current Location</span>
                        <span className="contact-value">
                          {profile.location}
                        </span>
                      </div>
                    </div>
                  )}

                  {(['website', 'github', 'linkedin'] as const).map(
                    (key) =>
                      profile[key] && (
                        <a
                          key={key}
                          href={profile[key]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="contact-card"
                        >
                          <div className="contact-icon web-icon">
                            {key === 'website' ? (
                              <Globe size={18} />
                            ) : (
                              <ExternalLink size={18} />
                            )}
                          </div>
                          <div className="contact-info">
                            <span className="contact-label">
                              {key.toUpperCase()}
                            </span>
                            <span className="contact-value">
                              {profile[key]}
                            </span>
                          </div>
                          <ArrowUpRight size={16} className="contact-arrow" />
                        </a>
                      ),
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Skills */}
            <TabsContent className="portfolio-tab-content" value="skills">
              <div
                key={`skills-${animKey}`}
                className="portfolio-section-reveal"
              >
                <span className="section-index">
                  03 / ARSENAL &amp; CAPABILITIES
                </span>
                <h3>Tools, ideas, and experience.</h3>
                <p className="portfolio-content-sub">
                  Technologies, paradigms, and competencies honed over
                  real-world projects.
                </p>

                {skills.length ? (
                  <div className="portfolio-skills-grid">
                    {skills.map((skill, i) => (
                      <article
                        className="quick-skill-card"
                        key={skill.id}
                        style={
                          {
                            borderLeftColor: SKILL_COLORS[skill.color],
                            '--skill-color': SKILL_COLORS[skill.color],
                            animationDelay: `${i * 45}ms`,
                          } as React.CSSProperties
                        }
                      >
                        <div className="skill-card-top">
                          <span
                            className="skill-category-dot"
                            style={{
                              backgroundColor: SKILL_COLORS[skill.color],
                            }}
                          />
                          <h4>{skill.title}</h4>
                        </div>
                        <p className="preserve-copy">{skill.description}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state-text">
                    Skills have not been added yet.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Tab: Projects */}
            <TabsContent className="portfolio-tab-content" value="projects">
              <div
                key={`projects-${animKey}`}
                className="portfolio-section-reveal"
              >
                <span className="section-index">04 / SELECTED WORKS</span>
                <h3>Featured Projects</h3>
                <p className="portfolio-content-sub">
                  Selected systems, creations, and interactive builds.
                </p>

                {projects.length ? (
                  <div className="portfolio-projects-list">
                    {projects.map((project, i) => (
                      <article
                        className="quick-project-card"
                        key={project.id}
                        style={{ animationDelay: `${i * 65}ms` }}
                      >
                        {project.cover && (
                          <div className="project-cover-wrap">
                            <Image
                              unoptimized
                              src={project.cover}
                              width={320}
                              height={200}
                              alt={project.title}
                              className="project-cover-img"
                            />
                          </div>
                        )}
                        <div className="project-details">
                          <h4>{project.title}</h4>
                          <p className="preserve-copy">{project.description}</p>
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="project-action-link"
                          >
                            <span>Open project</span>
                            <ArrowUpRight size={14} />
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state-text">
                    Projects have not been added yet.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Bottom Bar */}
          <div className="portfolio-bottom">
            <Button
              variant="ghost"
              onClick={onEnter}
              className="portfolio-explore-btn"
            >
              <Compass size={15} />
              <span>Explore the 3D Island</span>
            </Button>
            {index < sections.length - 1 ? (
              <Button
                variant="outline"
                onClick={() => {
                  const next = sections[index + 1];
                  setCurrent(next);
                  setAnimKey((k) => k + 1);
                }}
                className="portfolio-next-btn"
              >
                <span>Next: {labels[sections[index + 1]]}</span>
                <ArrowRight size={14} />
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={onClose}
                className="portfolio-close-btn"
              >
                <span>Back to Nocturne</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
