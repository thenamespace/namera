import type { Node } from "@xyflow/react";

export const PLACED: readonly Node[] = [
  { id: "intent", type: "intent", position: { x: 0, y: 26 }, style: { width: 274, height: 336 } },
  { id: "source", type: "source", position: { x: 328, y: 42 }, style: { width: 186, height: 58 } },
  { id: "swap", type: "swap", position: { x: 328, y: 156 }, style: { width: 186, height: 164 } },
  {
    id: "prepare",
    type: "prepare",
    position: { x: 568, y: 78 },
    style: { width: 246, height: 182 },
  },
  { id: "policy", type: "policy", position: { x: 868, y: 4 }, style: { width: 298, height: 316 } },
  {
    id: "refused",
    type: "refused",
    position: { x: 868, y: 376 },
    style: { width: 298, height: 86 },
  },
  { id: "sign", type: "sign", position: { x: 1220, y: 20 }, style: { width: 194, height: 86 } },
  { id: "send", type: "send", position: { x: 1220, y: 140 }, style: { width: 194, height: 86 } },
  {
    id: "confirmed",
    type: "confirmed",
    position: { x: 1220, y: 260 },
    style: { width: 194, height: 116 },
  },
].map(
  (node) => Object.assign(node, { draggable: true, selectable: false, connectable: false }) as Node,
);
