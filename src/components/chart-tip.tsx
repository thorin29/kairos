"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

/**
 * A chart's hover pop-up (v0.692), in place of the browser's slow grey
 * `<title>` tooltip: a small card beside the point, at once. A mouse shows it
 * on hover; a tap shows it until the next tap anywhere else.
 *
 * Wrap the chart in a `relative` element with `ref={wrap}` and `{...wrapProps}`,
 * give each mark `data-tip` and `{...markProps(title, detail)}`, and render
 * `<ChartTip tip={tip} />` inside the wrapper.
 */
export type Tip = { x: number; y: number; below: boolean; width: number; title: string; detail?: string };

export function useChartTip() {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const show = useCallback((el: Element, title: string, detail?: string) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const r = el.getBoundingClientRect();
    const top = r.top - box.top;
    // Near the top of the screen there's no room above: show it underneath.
    const below = r.top < 64;
    setTip({ x: r.left + r.width / 2 - box.left, y: below ? r.bottom - box.top : top, below, width: box.width, title, detail });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  // A tap anywhere but a point closes it.
  useEffect(() => {
    if (!tip) return;
    const off = (e: globalThis.PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-tip]")) setTip(null);
    };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [tip]);
  const markProps = (title: string, detail?: string) => ({
    "data-tip": "",
    onPointerEnter: (e: PointerEvent<Element>) => show(e.currentTarget, title, detail),
    // A finger lifts as soon as it taps: keep the tip until the next tap.
    onPointerLeave: (e: PointerEvent<Element>) => {
      if (e.pointerType !== "touch") hide();
    },
  });
  // Kept for the call sites; closing is handled document-wide above.
  const wrapProps = {};
  return { wrap, tip, show, hide, markProps, wrapProps };
}

export function ChartTip({ tip }: { tip: Tip | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    setW(box.current?.offsetWidth ?? 0);
  }, [tip]);
  if (!tip) return null;
  // Kept inside the chart's width, so an end point's tip isn't cut off.
  const half = Math.min(w / 2 + 2, tip.width / 2);
  const left = Math.min(Math.max(tip.x, half), tip.width - half);
  return (
    <div
      ref={box}
      role="tooltip"
      className={`pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs shadow-lg ${
        tip.below ? "" : "-translate-y-full"
      }`}
      style={{ left, top: tip.below ? tip.y + 8 : tip.y - 8 }}
    >
      <p className="tabular font-semibold">{tip.title}</p>
      {tip.detail && <p className="tabular text-muted">{tip.detail}</p>}
    </div>
  );
}
