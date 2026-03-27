'use client';

const COLOR_MAP: Record<string, string> = {
  a: 'text-green-400',
  b: 'text-cyan-400',
  c: 'text-red-400',
  e: 'text-yellow-300',
  '7': 'text-white/40',
  f: 'text-white',
  '6': 'text-amber-400',
  d: 'text-pink-400',
  '9': 'text-blue-400',
};

export function formatColoredText(text: string, defaultClass = 'text-white') {
  const parts: React.ReactNode[] = [];
  let current = '';
  let currentClass = defaultClass;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '§') {
      current += text[i];
      continue;
    }
    if (!text[i + 1]) {
      continue;
    }
    if (current) parts.push(<span key={parts.length} className={currentClass}>{current}</span>);
    const code = text[i + 1];
    currentClass = COLOR_MAP[code] ?? 'text-white';
    current = '';
    i++;
  }
  if (current) parts.push(<span key={parts.length} className={currentClass}>{current}</span>);
  return parts.length === 1 ? parts[0] : parts;
}
