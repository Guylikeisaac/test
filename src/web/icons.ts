// Icon geometry from lucide-static v0.460.0 (ISC License, https://lucide.dev). Trusted local data only.
import { svg } from './dom.js';
type Shape = [tag: 'path' | 'polygon' | 'rect' | 'line' | 'circle', attrs: Record<string, string | number>];
const ICONS: Record<string, Shape[]> = {
  play: [['polygon', { points: '6 3 20 12 6 21 6 3' }]],
  pause: [['rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 }], ['rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }]],
  reset: [['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }], ['path', { d: 'M3 3v5h5' }]],
  flag: [['path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }], ['line', { x1: 4, x2: 4, y1: 22, y2: 15 }]],
  next: [['path', { d: 'M5 12h14' }], ['path', { d: 'm12 5 7 7-7 7' }]],
  back: [['path', { d: 'm12 19-7-7 7-7' }], ['path', { d: 'M19 12H5' }]],
  send: [['path', { d: 'm5 12 7-7 7 7' }], ['path', { d: 'M12 19V5' }]],
  info: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 16v-4' }], ['path', { d: 'M12 8h.01' }]],
  warning: [['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }], ['path', { d: 'M12 9v4' }], ['path', { d: 'M12 17h.01' }]],
};
export function icon(name: keyof typeof ICONS) {
  const node = svg('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'icon' });
  for (const [tag, attrs] of ICONS[name]) node.append(svg(tag, attrs));
  return node;
}
/** Labelled button with a leading or trailing icon; the label stays the accessible name. */
export function withIcon(button: HTMLButtonElement, name: keyof typeof ICONS, trailing = false) {
  const label = document.createElement('span'); label.className = 'label'; label.textContent = button.textContent;
  button.replaceChildren(...(trailing ? [label, icon(name)] : [icon(name), label])); return button;
}
