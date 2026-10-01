import type { HallProject } from './hall-projects.ts';

/** Measure text rather than squeezing it, including titles without word breaks. */
function lines(
  context: CanvasRenderingContext2D,
  value: string,
  width: number,
  limit: number,
) {
  const characters = Array.from(value.trim().replace(/\s+/g, ' '));
  const result: string[] = [];
  while (characters.length && result.length < limit) {
    let count = 0;
    while (
      count < characters.length &&
      context.measureText(characters.slice(0, count + 1).join('')).width <=
        width
    )
      count++;
    count = Math.max(1, count);
    if (count < characters.length && result.length === limit - 1) {
      while (
        count > 0 &&
        context.measureText(`${characters.slice(0, count).join('').trimEnd()}…`)
          .width > width
      )
        count--;
      result.push(`${characters.slice(0, count).join('').trimEnd()}…`);
      break;
    }
    if (count < characters.length) {
      const lastSpace = characters.slice(0, count + 1).lastIndexOf(' ');
      if (lastSpace > 0) count = lastSpace;
    }
    result.push(characters.splice(0, count).join('').trim());
    while (characters[0] === ' ') characters.shift();
  }
  return result;
}

/** Rich exhibition posters with optional uploaded screenshots. */
export function drawHallProjectCover(
  canvas: HTMLCanvasElement,
  project: HallProject | undefined,
  index: number,
  image?: HTMLImageElement,
) {
  const c = canvas.getContext('2d');
  if (!c) return;
  const w = canvas.width,
    h = canvas.height,
    pad = 54,
    contentWidth = w - pad * 2;
  const palettes = [
    ['#b1f0df', '#1a5b62'],
    ['#f0cd85', '#66502d'],
    ['#d6bcff', '#47366e'],
    ['#a2d5ff', '#244a71'],
    ['#ffbac9', '#66394f'],
    ['#c4e99b', '#3e5734'],
  ];
  const [accent, tint] = palettes[index % palettes.length];
  c.clearRect(0, 0, w, h);
  const background = c.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, tint);
  background.addColorStop(0.7, '#122530');
  background.addColorStop(1, '#070e1b');
  c.fillStyle = background;
  c.fillRect(0, 0, w, h);
  // A luminous geometric field makes even an empty case feel intentional.
  c.strokeStyle = accent + '25';
  c.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    c.beginPath();
    c.moveTo(w * 0.55, -100);
    c.lineTo((i * w) / 8, h * 0.63);
    c.stroke();
  }
  for (let i = 0; i < 7; i++) {
    c.beginPath();
    c.ellipse(
      w * 0.58,
      h * 0.22,
      75 + i * 27,
      38 + i * 14,
      -0.35,
      0,
      Math.PI * 2,
    );
    c.stroke();
  }
  if (image) {
    c.save();
    c.beginPath();
    c.rect(26, 112, w - 52, 304);
    c.clip();
    const scale = Math.max(
      (w - 52) / image.naturalWidth,
      304 / image.naturalHeight,
    );
    c.drawImage(
      image,
      w / 2 - (image.naturalWidth * scale) / 2,
      264 - (image.naturalHeight * scale) / 2,
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );
    c.restore();
    const fade = c.createLinearGradient(0, 300, 0, 434);
    fade.addColorStop(0, '#0a152000');
    fade.addColorStop(1, '#0a1520');
    c.fillStyle = fade;
    c.fillRect(26, 300, w - 52, 134);
  } else {
    c.fillStyle = accent + '66';
    c.font = 'italic 190px Georgia';
    c.textAlign = 'right';
    c.fillText(String(index + 1).padStart(2, '0'), w - 50, 330);
    c.textAlign = 'left';
    c.fillStyle = accent;
    c.font = '22px monospace';
    c.fillText(
      project?.url ? 'AN INTERACTIVE EXPERIENCE' : 'SPACE FOR SOMETHING GREAT',
      pad,
      358,
    );
  }
  c.strokeStyle = accent + '80';
  c.lineWidth = 2;
  c.strokeRect(20, 20, w - 40, h - 40);
  c.fillStyle = accent;
  c.font = '20px monospace';
  c.textAlign = 'left';
  c.fillText(project?.url ? 'SELECTED WORK' : 'THE COLLECTION', pad, 76);
  c.textAlign = 'right';
  c.fillText(String(index + 1).padStart(2, '0'), w - pad, 76);
  c.textAlign = 'left';
  c.fillStyle = '#f4f5e9';
  c.font = '58px Georgia';
  const title = project?.url
    ? project.title.trim() || 'Untitled project'
    : 'A new chapter awaits.';
  lines(c, title, contentWidth, 2).forEach((line, row) =>
    c.fillText(line, pad, 480 + row * 66),
  );
  c.font = '25px Arial';
  c.fillStyle = '#c1d6d4';
  lines(
    c,
    project?.description.trim() ||
      (project?.url
        ? 'Open the frame. Explore the live experience.'
        : 'Ideas become experiences. The next one belongs here.'),
    contentWidth,
    2,
  ).forEach((line, row) => c.fillText(line, pad, 604 + row * 33));
  c.strokeStyle = accent + '66';
  c.beginPath();
  c.moveTo(pad, h - 98);
  c.lineTo(w - pad, h - 98);
  c.stroke();
  let host = '';
  try {
    if (project?.url)
      host = new URL(project.url).hostname.replace(/^www\./, '');
  } catch {}
  c.font = '20px Arial';
  c.fillStyle = accent;
  c.fillText(lines(c, host, contentWidth - 50, 1)[0] || '', pad, h - 65);
  c.font = '18px monospace';
  c.fillText(project?.url ? 'OPEN TO EXPLORE  ↗' : 'COMING SOON', pad, h - 38);
}
