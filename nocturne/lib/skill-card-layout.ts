/** Measured word wrapping for canvas labels, with grapheme-safe long-word breaks. */
export function wrapSkillText(text: string, measure: (text: string) => number, width: number, maxLines: number) {
  const lines: string[] = [];
  const graphemes = (value: string) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment);
  let line = '';
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const candidate = line ? line + ' ' + word : word;
    if (measure(candidate) <= width) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    if (measure(word) <= width) { line = word; continue; }
    for (const letter of graphemes(word)) {
      if (line && measure(line + letter) > width) { lines.push(line); line = ''; }
      line += letter;
    }
  }
  if (line) lines.push(line);
  const truncated = lines.length > maxLines;
  const visible = lines.slice(0, maxLines);
  if (truncated && visible.length) {
    const last = graphemes(visible[visible.length - 1]);
    while (last.length && measure(last.join('') + '…') > width) last.pop();
    visible[visible.length - 1] = last.join('').trimEnd() + '…';
  }
  return { lines: visible, truncated };
}
