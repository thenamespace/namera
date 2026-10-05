export const LAYOUT = {
  actorBoxH: 36,
  actorFontSize: 14,
  actorFontWeight: 600,
  actorGap: 220,
  actorGap2: 320,
  actorPadX: 24,
  arrowSize: 8,
  badgeFontSize: 10,
  badgeR: 10,
  blockLabelFontSize: 11,
  blockLabelFontWeight: 600,
  blockPadBottom: 10,
  blockPadTop: 28,
  blockPadX: 12,
  fontFamily:
    '"Geist Pixel Square", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  headerGap: 72,
  labelFontSize: 14,
  labelFontWeight: 400,
  labelLineGap: 22,
  lifelineStroke: 0.75,
  messageStroke: 1.2,
  noteBoxPadX: 16,
  noteBoxPadY: 8,
  noteExtraMargin: 28,
  noteFontSize: 13,
  noteFontWeight: 500,
  padding: 28,

  rowHeight: 72,
};

type Participant = {
  id: string;
  label: string;
};

type Step =
  | {
      type: "message";
      from: string;
      to: string;
      label: string;
      num: string | null;
      dashed: boolean;
    }
  | { type: "note"; over: string; text: string; num: string | null }
  | { type: "loop-start"; label: string }
  | { type: "loop-end" };

type ParsedDiagram = {
  participants: Participant[];
  steps: Step[];
};

function extractNum(text: string): { num: string | null; rest: string } {
  const m = text.match(/^\((\d+)\)\s*(.+)$/);
  return m?.[1] && m[2] ? { num: m[1], rest: m[2] } : { num: null, rest: text };
}

export function parse(source: string): ParsedDiagram {
  const lines = source
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));
  const participants: Participant[] = [];
  const steps: Step[] = [];
  const seen = new Set<string>();
  const ensure = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      participants.push({ id, label: id });
    }
  };

  for (const line of lines) {
    if (line === "sequenceDiagram") continue;
    const mPartAs = line.match(/^participant\s+(\S+)\s+as\s+(.+)$/i);
    if (mPartAs?.[1] && mPartAs[2]) {
      seen.add(mPartAs[1]);
      participants.push({ id: mPartAs[1], label: mPartAs[2].trim() });
      continue;
    }
    const mPart = line.match(/^participant\s+(\S+)$/i);
    if (mPart?.[1]) {
      ensure(mPart[1]);
      continue;
    }
    const mNote = line.match(/^Note\s+over\s+(\S+?)\s*:\s*(.+)$/i);
    if (mNote?.[1] && mNote[2]) {
      ensure(mNote[1]);
      const e = extractNum(mNote[2].trim());
      steps.push({ num: e.num, over: mNote[1], text: e.rest, type: "note" });
      continue;
    }
    const mLoop = line.match(/^loop\s+(.+)$/i);
    if (mLoop?.[1]) {
      steps.push({ label: mLoop[1].trim(), type: "loop-start" });
      continue;
    }
    if (/^end$/i.test(line)) {
      steps.push({ type: "loop-end" });
      continue;
    }
    const mMsg = line.match(/^(\S+?)(--?>>)(\S+?)\s*:\s*(.+)$/);
    if (mMsg?.[1] && mMsg[3] && mMsg[4]) {
      ensure(mMsg[1]);
      ensure(mMsg[3]);
      const e = extractNum(mMsg[4].trim());
      steps.push({
        dashed: mMsg[2] === "-->>",
        from: mMsg[1],
        label: e.rest,
        num: e.num,
        to: mMsg[3],
        type: "message",
      });
      continue;
    }
    throw new Error(
      `Unsupported sequence syntax: ${line}. Use MermaidDiagram for the full grammar.`,
    );
  }
  return { participants, steps };
}

type LMsg = {
  x1: number;
  x2: number;
  y: number;
  label: string;
  num: string | null;
  labelX: number;
  labelY: number;
  dashed: boolean;
  si: number;
  isLast: boolean;
};
type LNote = {
  text: string;
  num: string | null;
  x: number;
  y: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  lines: string[];
  si: number;
};
type LActor = {
  cx: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  label: string;
};
type LBlock = {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};
type LLifeline = {
  x: number;
  y1: number;
  y2: number;
};
export type Layout = {
  w: number;
  h: number;
  actors: LActor[];
  lifelines: LLifeline[];
  messages: LMsg[];
  notes: LNote[];
  blocks: LBlock[];
  msgCount: number;
};

export function doLayout(p: ParsedDiagram): Layout {
  const L = LAYOUT;
  const n = p.participants.length;
  if (n === 0) throw new Error("Sequence diagram has no participants");
  const gap = n === 2 ? L.actorGap2 : L.actorGap;

  const bY = L.padding;
  const actorById = new Map<string, LActor>();
  let previous: LActor | undefined;
  const actors = p.participants.map((participant): LActor => {
    const width = estW(participant.label, L.actorFontSize) + L.actorPadX * 2;
    const center = previous
      ? previous.cx + Math.max(gap, (previous.boxW + width) / 2 + 60)
      : L.padding + width / 2;
    const actor = {
      boxH: L.actorBoxH,
      boxW: width,
      boxX: center - width / 2,
      boxY: bY,
      cx: center,
      label: participant.label,
    };
    previous = actor;
    actorById.set(participant.id, actor);
    return actor;
  });
  const first = actors[0];
  const last = actors.at(-1);
  if (!first || !last) throw new Error("Sequence diagram has no participants");
  const actorFor = (id: string) => {
    const actor = actorById.get(id);
    if (!actor) throw new Error(`Unknown sequence participant: ${id}`);
    return actor;
  };

  let y = bY + L.actorBoxH + L.headerGap;
  const messages: LMsg[] = [];
  const notes: LNote[] = [];
  const blocks: LBlock[] = [];
  const bStack: { label: string; x: number; y: number }[] = [];
  const rightEdge = last.boxX + last.boxW;
  const leftEdge = first.boxX;

  // Count total messages to identify the last one
  let totalMsgs = 0;
  for (const s of p.steps) {
    if (s.type === "message") totalMsgs++;
  }
  let msgIdx = 0;

  for (const [si, s] of p.steps.entries()) {
    if (s.type === "message") {
      const from = actorFor(s.from);
      const to = actorFor(s.to);
      msgIdx++;
      messages.push({
        dashed: s.dashed,
        isLast: msgIdx === totalMsgs,
        label: s.label,
        labelX: (from.cx + to.cx) / 2,
        labelY: y - L.labelLineGap,
        num: s.num,
        si,
        x1: from.cx,
        x2: to.cx,
        y,
      });
      y += L.rowHeight;
    } else if (s.type === "note") {
      const maxNW = (rightEdge - leftEdge) * 0.8;
      const wrapped = wrapText(s.text, maxNW, L.noteFontSize);
      const lineH = L.noteFontSize + 4;
      const boxW = Math.max(...wrapped.map((t) => estW(t, L.noteFontSize))) + L.noteBoxPadX * 2;
      const boxH = wrapped.length * lineH + L.noteBoxPadY * 2;
      const noteX = actorFor(s.over).cx;
      const boxX = noteX - boxW / 2;
      const boxY = y - boxH / 2;
      notes.push({
        boxH,
        boxW: boxW + (s.num ? L.badgeR * 2 + 6 : 0),
        boxX,
        boxY,
        lines: wrapped,
        num: s.num,
        si,
        text: s.text,
        x: noteX,
        y,
      });
      y += L.rowHeight + L.noteExtraMargin;
    } else if (s.type === "loop-start") {
      bStack.push({
        label: s.label,
        x: leftEdge - L.blockPadX,
        y: y - L.blockPadTop / 2,
      });
      y += L.blockPadTop;
    } else if (s.type === "loop-end") {
      const blk = bStack.pop();
      if (blk) {
        const bw = rightEdge + L.blockPadX - blk.x;
        blocks.push({
          h: y - blk.y + L.blockPadBottom,
          label: blk.label,
          w: bw,
          x: blk.x,
          y: blk.y,
        });
        y += L.blockPadBottom;
      }
    }
  }

  const llBot = y - L.rowHeight / 2;
  const lifelines: LLifeline[] = actors.map((actor) => ({
    x: actor.cx,
    y1: bY + L.actorBoxH,
    y2: llBot,
  }));
  const totalW = rightEdge + L.padding;
  const totalH = llBot + L.padding;

  return {
    actors,
    blocks,
    h: totalH,
    lifelines,
    messages,
    msgCount: totalMsgs,
    notes,
    w: totalW,
  };
}

export function estW(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

function wrapText(text: string, maxW: number, fontSize: number): string[] {
  const paragraphs = text.split(/<br\s*\/?>|\n/gi);
  if (paragraphs.length > 1)
    return paragraphs.flatMap((paragraph) => wrapText(paragraph, maxW, fontSize));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (estW(test, fontSize) > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [text];
}
