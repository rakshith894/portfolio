'use client';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowRight,
  Code2,
  FolderOpen,
  Mail,
  ScrollText,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { destinations, type Destination } from '@/lib/nocturne';
const labels: Record<Destination, string> = {
  about: 'About',
  projects: 'Projects',
  skills: 'Skills',
  resume: 'Résumé',
  contact: 'Contact',
};
const icons = {
  about: UserRound,
  projects: FolderOpen,
  skills: Code2,
  resume: ScrollText,
  contact: Mail,
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
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="archive-dialog portfolio-dialog">
        <div className="eyebrow">NOCTURNE / QUICK PORTFOLIO</div>
        <DialogTitle className="dialog-heading">
          Rakshith. Beyond the atmosphere.
        </DialogTitle>
        <DialogDescription>
          A clear view of the person and the work. Explore at your own pace.
        </DialogDescription>
        <Tabs defaultValue={section}>
          <TabsList
            className="portfolio-tabs"
            variant="line"
            aria-label="Portfolio sections"
          >
            {destinations.map((d) => {
              const Icon = icons[d];
              return (
                <TabsTrigger key={d} value={d}>
                  <Icon size={14} />
                  {labels[d]}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <TabsContent className="portfolio-content" value="about">
            <span className="section-index">01 / THE PERSON</span>
            <h3>Code with character.</h3>
            <p>
              I’m Rakshith, a creative developer exploring the space where
              thoughtful interfaces meet immersive digital worlds.
            </p>
            <p>
              Nocturne is an experiment in making a portfolio feel like a place:
              something to explore, remember, and return to.
            </p>
            <div className="content-caption">
              INTRODUCTION DRAFT · READY TO PERSONALIZE
            </div>
          </TabsContent>
          <TabsContent className="portfolio-content" value="projects">
            <span className="section-index">02 / SELECTED WORK</span>
            <article className="project-preview">
              <Image
                unoptimized
                width={320}
                height={350}
                src="/graveyard.webp"
                alt="Moonlit graveyard and Gothic mansion from Nocturne"
              />
              <div>
                <span className="project-status">IN DEVELOPMENT</span>
                <h3>Nocturne</h3>
                <p>
                  A moonlit island with a walking guide, a boat to sail,
                  a Gothic mansion, and six underground galleries.
                </p>
                <div className="technology-tags">
                  <span>React</span>
                  <span>TypeScript</span>
                  <span>Three.js</span>
                </div>
                <Button
                  variant="ghost"
                  className="project-link"
                  onClick={onEnter}
                >
                  Explore the island <ArrowRight size={14} />
                </Button>
              </div>
            </article>
            <p className="content-caption">
              MORE PROJECTS, LIVE DEMOS, AND GITHUB LINKS WILL BE ADDED WITH
              RAKSHITH’S WORK.
            </p>
          </TabsContent>
          <TabsContent className="portfolio-content" value="skills">
            <span className="section-index">03 / THE CRAFT</span>
            <h3>The technology behind Nocturne.</h3>
            <p>
              This project brings together React and TypeScript for the
              interface, Three.js for the world, and responsive CSS for the
              entrance and controls.
            </p>
            <div className="skill-rows">
              <div>
                <span>Interface</span>
                <strong>React · TypeScript · CSS</strong>
              </div>
              <div>
                <span>Immersion</span>
                <strong>Three.js · WebGL · Animation</strong>
              </div>
              <div>
                <span>Interaction</span>
                <strong>Point & click · Guided navigation · Voice</strong>
              </div>
            </div>
            <p className="content-caption">
              THE ISLAND DEMONSTRATES CHARACTER ANIMATION AND INTERACTIVE NAVIGATION.
              RAKSHITH’S VERIFIED SKILL PROFILE WILL BE ADDED LATER.
            </p>
          </TabsContent>
          <TabsContent className="portfolio-content" value="resume">
            <span className="section-index">04 / EXPERIENCE</span>
            <h3>A story still being written.</h3>
            <p>
              Rakshith’s résumé will be available here once his experience,
              education, and downloadable document have been added.
            </p>
            <div className="pending-content">
              <ScrollText size={22} />
              <div>
                <strong>Résumé coming soon</strong>
                <span>Professional details are awaiting personalization.</span>
              </div>
            </div>
          </TabsContent>
          <TabsContent className="portfolio-content" value="contact">
            <span className="section-index">05 / START A CONVERSATION</span>
            <h3>Good things begin with hello.</h3>
            <p>
              Contact details and social profiles will appear here once Rakshith
              adds his preferred ways to connect.
            </p>
            <div className="pending-content">
              <Mail size={22} />
              <div>
                <strong>Contact details coming soon</strong>
                <span>
                  Email, GitHub, and LinkedIn links are not connected yet.
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <div className="portfolio-bottom">
          <span>THE STORY IS OPTIONAL. THE WORK IS ALWAYS ACCESSIBLE.</span>
          <Button variant="ghost" onClick={onClose}>
            Back to Nocturne <ArrowRight size={14} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
