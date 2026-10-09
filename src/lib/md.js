// Renderer de Markdown ligero para la tarjeta de Análisis (Hermes) — portado 1:1 desde
// dashboard-template.html. Soporta: ##/### headers, **bold**, `code`, listas - / * / 1.
import { escapeHtml } from './format.js';

export function mdInline(s) {
  s = escapeHtml(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

export function mdLite(text) {
  const lines = text.split(/\n/);
  let html = '';
  let paraBuf = [];
  function flushPara() {
    if (paraBuf.length) { html += '<p>' + paraBuf.join('<br>') + '</p>'; paraBuf = []; }
  }
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { flushPara(); i++; continue; }
    const h3 = trimmed.match(/^###\s+(.*)$/);
    const h2 = trimmed.match(/^##\s+(.*)$/);
    let ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    let olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (h2) { flushPara(); html += '<h4>' + mdInline(h2[1]) + '</h4>'; i++; continue; }
    if (h3) { flushPara(); html += '<h5>' + mdInline(h3[1]) + '</h5>'; i++; continue; }
    if (ulMatch) {
      flushPara();
      const uItems = [];
      while (i < lines.length && (ulMatch = lines[i].trim().match(/^[-*]\s+(.*)$/))) { uItems.push('<li>' + mdInline(ulMatch[1]) + '</li>'); i++; }
      html += '<ul>' + uItems.join('') + '</ul>';
      continue;
    }
    if (olMatch) {
      flushPara();
      const oItems = [];
      while (i < lines.length && (olMatch = lines[i].trim().match(/^\d+\.\s+(.*)$/))) { oItems.push('<li>' + mdInline(olMatch[1]) + '</li>'); i++; }
      html += '<ol>' + oItems.join('') + '</ol>';
      continue;
    }
    paraBuf.push(mdInline(trimmed));
    i++;
  }
  flushPara();
  return html;
}
