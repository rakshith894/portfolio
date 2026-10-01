import type { ContactProfile } from './contact-profile.ts';
import type { GallerySkill } from './skill-gallery.ts';
import {
  HALL_FRAMES,
  HALL_PAGE_SIZE,
  type HallProject,
} from './hall-projects.ts';

export type TourStop = {
  id: string;
  section: 'About & contact' | 'Skills' | 'Projects';
  title: string;
  text: string;
  point: { x: number; z: number; y: number };
  page?: number;
};
export function portfolioStops(
  profile: ContactProfile,
  skills: GallerySkill[],
  projects: HallProject[],
): TourStop[] {
  const contact = [
    profile.email && `Email: ${profile.email}.`,
    profile.phone && `Phone: ${profile.phone}.`,
    profile.location && `Based in ${profile.location}.`,
    ...(['website', 'github', 'linkedin'] as const).map(
      (key) => profile[key] && `${key}: ${profile[key]}.`,
    ),
  ]
    .filter(Boolean)
    .join(' ');
  const about: TourStop = {
    id: 'about',
    section: 'About & contact',
    title: profile.name,
    text: `${profile.name}. ${profile.role}. ${profile.bio} ${contact || 'Contact details have not been added yet.'}`,
    point: { x: 0, z: -3.8, y: 0 },
  };
  const skillStops: TourStop[] = skills.length
    ? skills.map((skill, index) => ({
        id: skill.id,
        section: 'Skills',
        title: skill.title,
        text: `${skill.title}. ${skill.description || 'An explanation will be added soon.'}`,
        point: { x: 5.5, z: -4.4, y: 0 },
        page: Math.floor(index / 6),
      }))
    : [
        {
          id: 'skills-empty',
          section: 'Skills',
          title: 'Skills Room',
          text: 'This is the Skills Room. Skills have not been added yet. New skills and their explanations will appear here when published.',
          point: { x: 5.5, z: -4.4, y: 0 },
        },
      ];
  const projectStops: TourStop[] = projects.flatMap((project, index) => {
    if (!project.url) return [];
    const frame = HALL_FRAMES[index % HALL_PAGE_SIZE];
    return [
      {
        id: project.id,
        section: 'Projects',
        title: project.title,
        text: `${project.title}. ${project.description || 'Open the project to explore the work.'}`,
        point: {
          x: frame.x > 0 ? frame.x - 1.5 : frame.x + 1.5,
          z: frame.z,
          y: 5,
        },
        page: Math.floor(index / HALL_PAGE_SIZE),
      },
    ];
  });
  if (!projectStops.length)
    projectStops.push({
      id: 'projects-empty',
      section: 'Projects',
      title: 'The project collection',
      text: 'Welcome to the Projects Room. Projects have not been added yet. Each published project will be introduced here.',
      point: { x: 2, z: -5, y: 5 },
    });
  return [about, ...skillStops, ...projectStops];
}

/** Keep utterances short without truncating long names or descriptions. */
export function narrationChunks(text: string, limit = 220) {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length) {
    let end = Math.min(limit, rest.length);
    if (end < rest.length) {
      const space = rest.lastIndexOf(' ', end);
      if (space > 0) end = space;
    }
    chunks.push(rest.slice(0, end));
    rest = rest.slice(end).trimStart();
  }
  return chunks;
}

export type TourStatus = {
  phase: 'travelling' | 'reading' | 'paused' | 'complete' | 'error';
  stop: TourStop;
  index: number;
  total: number;
  caption: string;
} | null;
export function createPortfolioTour(deps: {
  stops: () => TourStop[];
  travel: (stop: TourStop) => Promise<boolean>;
  stopTravel: () => void;
  speak: (text: string, done: () => void) => boolean;
  silence: () => void;
  report: (status: TourStatus) => void;
  present: (stop: TourStop | null) => void;
}) {
  let version = 0,
    index = 0,
    status: TourStatus = null,
    timer: ReturnType<typeof setTimeout> | undefined;
  let order: TourStop['section'][] = ['About & contact', 'Skills', 'Projects'];
  const stopsNow = () =>
    deps
      .stops()
      .sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
  const emit = (next: TourStatus) => {
    status = next;
    deps.report(next);
  };
  function invalidate() {
    version++;
    clearTimeout(timer);
    deps.silence();
    deps.stopTravel();
  }
  function read(stop: TourStop, token: number) {
    const chunks = narrationChunks(stop.text);
    let cursor = 0;
    const next = () => {
      if (token !== version) return;
      const caption = chunks[cursor++];
      if (!caption) {
        timer = setTimeout(() => {
          if (token === version) void visit(index + 1);
        }, 1400);
        return;
      }
      emit({
        phase: 'reading',
        stop,
        index,
        total: stopsNow().length,
        caption,
      });
      let finished = false;
      const done = () => {
        if (finished || token !== version) return;
        finished = true;
        clearTimeout(timer);
        timer = setTimeout(next, 250);
      };
      // Reading fallback also recovers browsers whose speech engine never fires end.
      const duration = Math.max(4500, caption.split(/\s+/).length * 520);
      timer = setTimeout(done, duration + 6000);
      if (!deps.speak(caption, done)) {
        clearTimeout(timer);
        timer = setTimeout(done, duration);
      }
    };
    next();
  }
  async function visit(nextIndex: number) {
    invalidate();
    index = nextIndex;
    const token = version,
      stops = stopsNow(),
      stop = stops[index];
    if (!stop) {
      deps.present(null);
      if (status)
        emit({
          ...status,
          phase: 'complete',
          caption:
            'Tour complete. Keep exploring, or open the quick portfolio.',
        });
      return;
    }
    emit({
      phase: 'travelling',
      stop,
      index,
      total: stops.length,
      caption: `Follow the glowing path to ${stop.section.toLowerCase()}.`,
    });
    try {
      const arrived = await deps.travel(stop);
      if (token !== version) return;
      if (!arrived) {
        emit({
          phase: 'error',
          stop,
          index,
          total: stops.length,
          caption:
            'The path was interrupted. Retry this stop or continue exploring.',
        });
        return;
      }
      // Read the latest saved content at arrival, not a script frozen at tour start.
      const latest =
        stopsNow().find(
          (item) => item.id === stop.id && item.section === stop.section,
        ) ?? stop;
      deps.present(latest);
      read(latest, token);
    } catch {
      if (token === version)
        emit({
          phase: 'error',
          stop,
          index,
          total: stops.length,
          caption: 'This stop could not be reached. Retry or leave the tour.',
        });
    }
  }
  return {
    start: (section: TourStop['section'] = 'About & contact') => {
      order =
        section === 'Projects'
          ? ['Projects', 'Skills', 'About & contact']
          : section === 'Skills'
            ? ['Skills', 'Projects', 'About & contact']
            : ['About & contact', 'Skills', 'Projects'];
      void visit(0);
    },
    next: () => {
      void visit(index + 1);
    },
    replay: () => {
      void visit(index);
    },
    pause: () => {
      if (!status || status.phase === 'complete') return;
      invalidate();
      emit({
        ...status,
        phase: 'paused',
        caption: 'Tour paused. Resume to replay this stop.',
      });
    },
    stop: () => {
      invalidate();
      deps.present(null);
      emit(null);
    },
    get active() {
      return status !== null && status.phase !== 'complete';
    },
  };
}
