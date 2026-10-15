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

export function render(layout: Layout, theme: ThemeColors, id: string): string {
  const L = LAYOUT;
  const svg: string[] = [];
  const arrowSize = L.arrowSize;
  const badgeRadius = L.badgeR;

  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.w} ${layout.h}" width="${
      layout.w
    }" height="${layout.h}" style="font-family:ui-monospace,monospace">`,
  );

  // Gradient for last (success) message line — use userSpaceOnUse to avoid
  // zero-height bounding box issues on horizontal <line> elements.
  const lastMessage = layout.messages.find((message) => message.isLast);
  if (lastMessage) {
    svg.push(
      `<defs><linearGradient id="grad-success-${id}" gradientUnits="userSpaceOnUse" x1="${
        lastMessage.x1
      }" y1="0" x2="${lastMessage.x2}" y2="0"><stop offset="0%" stop-color="${
        theme.line
      }"/><stop offset="85%" stop-color="${theme.successArrow}"/></linearGradient></defs>`,
    );
  }

  for (const lifeline of layout.lifelines) {
    svg.push(
      `<line x1="${lifeline.x}" y1="${lifeline.y1}" x2="${lifeline.x}" y2="${lifeline.y2}" stroke="${
        theme.lifeline
      }" stroke-width="${L.lifelineStroke}" stroke-dasharray="6 4"/>`,
    );
  }

  for (const block of layout.blocks) {
    const tw = estW(block.label, L.blockLabelFontSize) + 20;
    svg.push(
      `<rect x="${block.x}" y="${block.y}" width="${block.w}" height="${block.h}" fill="none" stroke="${
        theme.blockStroke
      }" stroke-width="1"/>`,
    );
    svg.push(
      `<rect x="${block.x}" y="${block.y}" width="${tw}" height="18" fill="${theme.blockHeaderBg}" stroke="${
        theme.blockStroke
      }" stroke-width="1"/>`,
    );
    svg.push(
      `<text x="${block.x + 8}" y="${block.y + 9}" dy="0.35em" font-size="${
        L.blockLabelFontSize
      }" font-weight="${L.blockLabelFontWeight}" fill="${theme.textMuted}">${escapeSvgText(block.label)}</text>`,
    );
  }

  for (const actor of layout.actors) {
    svg.push(
      `<rect x="${actor.boxX}" y="${actor.boxY}" width="${actor.boxW}" height="${actor.boxH}" rx="4" fill="${
        theme.actorFill
      }" stroke="${theme.actorStroke}" stroke-width="1"/>`,
    );
    svg.push(
      `<text x="${actor.cx}" y="${actor.boxY + actor.boxH / 2}" text-anchor="middle" dy="0.35em" font-size="${
        L.actorFontSize
      }" font-weight="${L.actorFontWeight}" fill="${theme.text}">${escapeSvgText(actor.label)}</text>`,
    );
  }

  for (const message of layout.messages) {
    const dashAttribute = message.dashed ? ' stroke-dasharray="6 4"' : "";
    const goingRight = message.x2 > message.x1;
    const lineEndX = goingRight ? message.x2 - arrowSize : message.x2 + arrowSize;
    const lineStroke = message.isLast ? `url(#grad-success-${id})` : theme.line;
    // Solid arrows (->>): filled triangle; dashed arrows (-->>): outline triangle
    const arrowStroke = message.isLast ? theme.successArrow : theme.line;
    const arrowFill = message.dashed ? theme.actorFill : arrowStroke;

    // Self-calls need a return path instead of a zero-length horizontal line.
    if (message.x1 === message.x2) {
      svg.push(
        `<path data-step="${message.si}" d="M ${message.x1} ${message.y - 18} h 44 v 18 H ${message.x2 + arrowSize}" fill="none" stroke="${theme.line}" stroke-width="${L.messageStroke}"${dashAttribute}/>`,
      );
    } else {
      svg.push(
        `<line data-step="${message.si}" x1="${message.x1}" y1="${message.y}" x2="${lineEndX}" y2="${message.y}" stroke="${
          lineStroke
        }" stroke-width="${L.messageStroke}"${dashAttribute}/>`,
      );
    }

    const tipX = message.x2;
    const baseX = goingRight ? tipX - arrowSize : tipX + arrowSize;
    svg.push(
      `<polygon data-step-arrow="${message.si}" points="${tipX},${message.y} ${baseX},${message.y - arrowSize / 2} ${
        baseX
      },${message.y + arrowSize / 2}" fill="${arrowFill}" stroke="${
        arrowStroke
      }" stroke-width="1.2" stroke-linejoin="round"/>`,
    );

    const labelW = estW(message.label, L.labelFontSize);
    const totalLabelW = labelW + (message.num ? badgeRadius * 2 + 6 : 0);
    const groupLeft = message.labelX - totalLabelW / 2;

    if (message.num) {
      const bcx = groupLeft + badgeRadius;
      const bcy = message.labelY;
      svg.push(
        `<circle data-step-label="${message.si}" cx="${bcx}" cy="${bcy}" r="${badgeRadius}" fill="${
          theme.badgeBg
        }"/>`,
      );
      svg.push(
        `<text data-step-label="${message.si}" x="${bcx}" y="${
          bcy
        }" text-anchor="middle" dy="0.35em" font-size="${
          L.badgeFontSize
        }" font-weight="600" fill="${theme.badgeText}">${message.num}</text>`,
      );
    }

    const textX = message.num ? groupLeft + badgeRadius * 2 + 6 + labelW / 2 : message.labelX;
    svg.push(
      `<text data-step-label="${message.si}" x="${textX}" y="${
        message.labelY
      }" text-anchor="middle" dy="0.35em" font-size="${L.labelFontSize}" font-weight="${
        L.labelFontWeight
      }" fill="${theme.textMuted}">${highlightLabel(message.label, theme)}</text>`,
    );
  }

  for (const note of layout.notes) {
    const lineH = L.noteFontSize + 4;
    // Recenter box now that boxW includes badge space
    const centeredBoxX = note.x - note.boxW / 2;
    const textStartY = note.boxY + L.noteBoxPadY + L.noteFontSize;

    svg.push(
      `<rect data-step-note="${note.si}" x="${centeredBoxX}" y="${note.boxY}" width="${
        note.boxW
      }" height="${note.boxH}" rx="6" fill="${theme.actorFill}" stroke="${
        theme.actorStroke
      }" stroke-width="1"/>`,
    );

    if (note.num) {
      const bx = centeredBoxX + L.noteBoxPadX + badgeRadius;
      const by = note.boxY + note.boxH / 2;
      svg.push(
        `<circle data-step-note="${note.si}" cx="${bx}" cy="${by}" r="${badgeRadius}" fill="${theme.badgeBg}"/>`,
      );
      svg.push(
        `<text data-step-note="${note.si}" x="${bx}" y="${
          by
        }" text-anchor="middle" dy="0.35em" font-size="${
          L.badgeFontSize
        }" font-weight="600" fill="${theme.badgeText}">${note.num}</text>`,
      );
    }

    const textX = note.num
      ? centeredBoxX + L.noteBoxPadX + badgeRadius * 2 + 6
      : centeredBoxX + L.noteBoxPadX;
    for (const [li, line] of note.lines.entries()) {
      svg.push(
        `<text data-step-note="${note.si}" x="${textX}" y="${textStartY + li * lineH}" font-size="${
          L.noteFontSize
        }" font-weight="${L.noteFontWeight}" fill="${theme.textMuted}">${escapeSvgText(line)}</text>`,
      );
    }
  }

  svg.push("</svg>");
  return svg.join("\n");
}

function highlightLabel(label: string, theme: ThemeColors): string {
  const re = /(GET|POST|PUT|DELETE|PATCH|\b[45]\d{2}\b|\b2\d{2}\s*OK\b|\b2\d{2}\b)/g;
  let lastIndex = 0;
  let result = "";
  let match: RegExpExecArray | null = re.exec(label);
  while (match !== null) {
    if (match.index > lastIndex) {
      result += escapeSvgText(label.slice(lastIndex, match.index));
    }
    const token = match[0];
    let color = theme.textMuted;
    if (/^(GET|POST|PUT|DELETE|PATCH)$/.test(token)) color = theme.arrow;
    else if (/^[45]\d{2}$/.test(token)) color = theme.errorCode;
    else if (/^2\d{2}/.test(token)) color = theme.successArrow;
    result += `<tspan fill="${color}">${escapeSvgText(token)}</tspan>`;
    lastIndex = match.index + token.length;
    match = re.exec(label);
  }
  if (lastIndex < label.length) {
    result += escapeSvgText(label.slice(lastIndex));
  }
  return result;
}

function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
