"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

const palette = [
  ["먹색", "#242822"], ["초록", "#527253"], ["분홍", "#bd596c"],
  ["파랑", "#466695"], ["노랑", "#cc8b19"],
];

export function Drawing({ onChange }: { onChange: (image: Promise<Blob | null>) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const pointer = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const [color, setColor] = useState(palette[0][1]);
  const [eraser, setEraser] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    onChange(Promise.resolve(null));
  }, [onChange]);

  function publish() {
    const surface = canvas.current!;
    const pixels = surface.getContext("2d")!.getImageData(0, 0, surface.width, surface.height).data;
    const hasInk = pixels.some((value, index) => index % 4 === 3 && value > 0);
    onChange(hasInk ? new Promise((resolve) => surface.toBlob(resolve, "image/png")) : Promise.resolve(null));
  }

  function paint(event: PointerEvent<HTMLCanvasElement>, start: boolean) {
    const surface = event.currentTarget;
    const bounds = surface.getBoundingClientRect();
    const point = {
      x: (event.clientX - bounds.left) * surface.width / bounds.width,
      y: (event.clientY - bounds.top) * surface.height / bounds.height,
    };
    const context = surface.getContext("2d")!;
    context.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = eraser ? 32 : 7;
    context.lineCap = "round";
    context.beginPath();
    if (start) {
      context.arc(point.x, point.y, context.lineWidth / 2, 0, 2 * Math.PI);
      context.fill();
    } else {
      context.moveTo(last.current.x, last.current.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    }
    last.current = point;
  }

  function remember() {
    const surface = canvas.current!;
    history.current.push(surface.getContext("2d")!.getImageData(0, 0, surface.width, surface.height));
    if (history.current.length > 12) history.current.shift();
    setCanUndo(true);
  }

  function end(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    publish();
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex gap-1.5" role="group" aria-label="펜 색상">
          {palette.map(([name, value]) => (
            <button type="button" key={value} className="swatch" aria-label={name} aria-pressed={!eraser && color === value}
              onClick={() => { setColor(value); setEraser(false); }}>
              <span style={{ backgroundColor: value }} />
            </button>
          ))}
        </div>
        <div className="flex gap-1 text-xs font-bold">
          <button type="button" className="tool" aria-pressed={eraser} onClick={() => setEraser(!eraser)}>지우개</button>
          <button type="button" className="tool" disabled={!canUndo} onClick={() => {
            const previous = history.current.pop();
            if (!previous) return;
            canvas.current!.getContext("2d")!.putImageData(previous, 0, 0);
            setCanUndo(history.current.length > 0);
            publish();
          }}>실행 취소</button>
          <button type="button" className="tool" onClick={() => {
            remember();
            const surface = canvas.current!;
            surface.getContext("2d")!.clearRect(0, 0, surface.width, surface.height);
            publish();
          }}>비우기</button>
        </div>
      </div>
      <canvas ref={canvas} width={840} height={480} className="canvas-paper block w-full touch-none cursor-crosshair"
        aria-label="손그림 캔버스"
        onPointerDown={(event) => {
          if (pointer.current !== null || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = event.pointerId;
          remember();
          paint(event, true);
        }}
        onPointerMove={(event) => { if (pointer.current === event.pointerId) paint(event, false); }}
        onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
    </div>
  );
}
