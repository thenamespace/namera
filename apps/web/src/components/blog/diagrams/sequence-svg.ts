import { LAYOUT, estW, type Layout } from "./sequence-layout";
export type ThemeColors = {
  text: string;
  textMuted: string;
  line: string;
  lifeline: string;
  arrow: string;
  successArrow: string;
  errorCode: string;
  actorFill: string;
  actorStroke: string;
  blockStroke: string;
  blockHeaderBg: string;
  badgeBg: string;
  badgeText: string;
};

export function render(lo: Layout, th: ThemeColors, id: string): string {
  const L = LAYOUT;
  const o: string[] = [];
  const sz = L.arrowSize;
  const br = L.badgeR;

  o.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lo.w} ${lo.h}" width="${
      lo.w
    }" height="${lo.h}" style="font-family:ui-monospace,monospace">`,
  );

  // Gradient for last (success) message line — use userSpaceOnUse to avoid
  // zero-height bounding box issues on horizontal <line> elements.
  const lastMsg = lo.messages.find((m) => m.isLast);
  if (lastMsg) {
    o.push(
      `<defs><linearGradient id="grad-success-${id}" gradientUnits="userSpaceOnUse" x1="${
        lastMsg.x1
      }" y1="0" x2="${lastMsg.x2}" y2="0"><stop offset="0%" stop-color="${
        th.line
      }"/><stop offset="85%" stop-color="${th.successArrow}"/></linearGradient></defs>`,
    );
  }

  // Lifelines
  for (const ll of lo.lifelines) {
    o.push(
      `<line x1="${ll.x}" y1="${ll.y1}" x2="${ll.x}" y2="${ll.y2}" stroke="${
        th.lifeline
      }" stroke-width="${L.lifelineStroke}" stroke-dasharray="6 4"/>`,
    );
  }

  // Blocks
  for (const b of lo.blocks) {
    const tw = estW(b.label, L.blockLabelFontSize) + 20;
    o.push(
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${
        th.blockStroke
      }" stroke-width="1"/>`,
    );
    o.push(
      `<rect x="${b.x}" y="${b.y}" width="${tw}" height="18" fill="${th.blockHeaderBg}" stroke="${
        th.blockStroke
      }" stroke-width="1"/>`,
    );
    o.push(
      `<text x="${b.x + 8}" y="${b.y + 9}" dy="0.35em" font-size="${
        L.blockLabelFontSize
      }" font-weight="${L.blockLabelFontWeight}" fill="${th.textMuted}">${esc(b.label)}</text>`,
    );
  }

  // Actors
  for (const a of lo.actors) {
    o.push(
      `<rect x="${a.boxX}" y="${a.boxY}" width="${a.boxW}" height="${a.boxH}" rx="4" fill="${
        th.actorFill
      }" stroke="${th.actorStroke}" stroke-width="1"/>`,
    );
    o.push(
      `<text x="${a.cx}" y="${a.boxY + a.boxH / 2}" text-anchor="middle" dy="0.35em" font-size="${
        L.actorFontSize
      }" font-weight="${L.actorFontWeight}" fill="${th.text}">${esc(a.label)}</text>`,
    );
  }

  // Messages
  for (const m of lo.messages) {
    const da = m.dashed ? ' stroke-dasharray="6 4"' : "";
    const goingRight = m.x2 > m.x1;
    const lineEndX = goingRight ? m.x2 - sz : m.x2 + sz;
    const lineStroke = m.isLast ? `url(#grad-success-${id})` : th.line;
    // Solid arrows (->>): filled triangle; dashed arrows (-->>): outline triangle
    const arrowFill = m.isLast
      ? m.dashed
        ? th.actorFill
        : th.successArrow
      : m.dashed
        ? th.actorFill
        : th.line;
    const arrowStroke = m.isLast ? th.successArrow : th.line;

    // Self-calls need a return path instead of a zero-length horizontal line.
    if (m.x1 === m.x2) {
      o.push(
        `<path data-step="${m.si}" d="M ${m.x1} ${m.y - 18} h 44 v 18 H ${m.x2 + sz}" fill="none" stroke="${th.line}" stroke-width="${L.messageStroke}"${da}/>`,
      );
    } else
      o.push(
        `<line data-step="${m.si}" x1="${m.x1}" y1="${m.y}" x2="${lineEndX}" y2="${m.y}" stroke="${
          lineStroke
        }" stroke-width="${L.messageStroke}"${da}/>`,
      );

    // Arrow
    const tipX = m.x2;
    const baseX = goingRight ? tipX - sz : tipX + sz;
    o.push(
      `<polygon data-step-arrow="${m.si}" points="${tipX},${m.y} ${baseX},${m.y - sz / 2} ${
        baseX
      },${m.y + sz / 2}" fill="${arrowFill}" stroke="${
        arrowStroke
      }" stroke-width="1.2" stroke-linejoin="round"/>`,
    );

    // Compute label text width to place badge to its left
    const labelW = estW(m.label, L.labelFontSize);
    const totalLabelW = labelW + (m.num ? br * 2 + 6 : 0);
    const groupLeft = m.labelX - totalLabelW / 2;

    // Badge (subtle bg color, not blue)
    if (m.num) {
      const bcx = groupLeft + br;
      const bcy = m.labelY;
      o.push(
        `<circle data-step-label="${m.si}" cx="${bcx}" cy="${bcy}" r="${br}" fill="${
          th.badgeBg
        }"/>`,
      );
      o.push(
        `<text data-step-label="${m.si}" x="${bcx}" y="${
          bcy
        }" text-anchor="middle" dy="0.35em" font-size="${
          L.badgeFontSize
        }" font-weight="600" fill="${th.badgeText}">${m.num}</text>`,
      );
    }

    // Label text (to the right of badge)
    const textX = m.num ? groupLeft + br * 2 + 6 + labelW / 2 : m.labelX;
    o.push(
      `<text data-step-label="${m.si}" x="${textX}" y="${
        m.labelY
      }" text-anchor="middle" dy="0.35em" font-size="${L.labelFontSize}" font-weight="${
        L.labelFontWeight
      }" fill="${th.textMuted}">${highlightLabel(m.label, th)}</text>`,
    );
  }

  // Notes — rounded box with wrapped text, no italic
  for (const nt of lo.notes) {
    const lineH = L.noteFontSize + 4;
    // Recenter box now that boxW includes badge space
    const centeredBoxX = nt.x - nt.boxW / 2;
    const textStartY = nt.boxY + L.noteBoxPadY + L.noteFontSize;

    o.push(
      `<rect data-step-note="${nt.si}" x="${centeredBoxX}" y="${nt.boxY}" width="${
        nt.boxW
      }" height="${nt.boxH}" rx="6" fill="${th.actorFill}" stroke="${
        th.actorStroke
      }" stroke-width="1"/>`,
    );

    if (nt.num) {
      const bx = centeredBoxX + L.noteBoxPadX + br;
      const by = nt.boxY + nt.boxH / 2;
      o.push(
        `<circle data-step-note="${nt.si}" cx="${bx}" cy="${by}" r="${br}" fill="${th.badgeBg}"/>`,
      );
      o.push(
        `<text data-step-note="${nt.si}" x="${bx}" y="${
          by
        }" text-anchor="middle" dy="0.35em" font-size="${
          L.badgeFontSize
        }" font-weight="600" fill="${th.badgeText}">${nt.num}</text>`,
      );
    }

    const textX = nt.num ? centeredBoxX + L.noteBoxPadX + br * 2 + 6 : centeredBoxX + L.noteBoxPadX;
    for (const [li, line] of nt.lines.entries()) {
      o.push(
        `<text data-step-note="${nt.si}" x="${textX}" y="${textStartY + li * lineH}" font-size="${
          L.noteFontSize
        }" font-weight="${L.noteFontWeight}" fill="${th.textMuted}">${esc(line)}</text>`,
      );
    }
  }

  o.push("</svg>");
  return o.join("\n");
}

// Syntax highlight HTTP codes and methods in labels
function highlightLabel(label: string, th: ThemeColors): string {
  // Tokenize: split label into segments with optional color overrides
  const re = /(GET|POST|PUT|DELETE|PATCH|\b[45]\d{2}\b|\b2\d{2}\s*OK\b|\b2\d{2}\b)/g;
  let lastIdx = 0;
  let result = "";
  let match: RegExpExecArray | null = re.exec(label);
  while (match !== null) {
    // Text before match
    if (match.index > lastIdx) {
      result += esc(label.slice(lastIdx, match.index));
    }
    const tok = match[0];
    let color = th.textMuted;
    if (/^(GET|POST|PUT|DELETE|PATCH)$/.test(tok)) color = th.arrow;
    else if (/^[45]\d{2}$/.test(tok)) color = th.errorCode;
    else if (/^2\d{2}/.test(tok)) color = th.successArrow;
    result += `<tspan fill="${color}">${esc(tok)}</tspan>`;
    lastIdx = match.index + tok.length;
    match = re.exec(label);
  }
  // Remaining text
  if (lastIdx < label.length) {
    result += esc(label.slice(lastIdx));
  }
  return result;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
