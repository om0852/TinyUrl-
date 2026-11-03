'use client';

import React, { useState } from 'react';

export type TimelineRange = '24h' | '7d' | '30d';

export interface TimelineData {
  points: { label: string; date: string; clicks: number }[];
  total: number;
  peak: { label: string; date: string; clicks: number };
  peakIndex: number; // -1 when every bucket is zero
  average: number;
  unit: 'hour' | 'day';
  axisMax: number;
  ticks: number[]; // descending, ending at 0
  labelEvery: number;
}

/** "Clicks over time" card: one column per hour (24h) or day (7d/30d). */
export function ClicksTimelineChart({ data, range, onRangeChange, className = '' }: {
  data: TimelineData;
  range: TimelineRange;
  onRangeChange: (range: TimelineRange) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className={`bg-surface-container-lowest p-5 sm:p-6 shadow-sm rounded-xl border-[0.5px] border-outline-variant flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold text-on-surface">Clicks over time</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              <span className="font-semibold text-on-surface">{data.total.toLocaleString()}</span>
              {' '}click{data.total === 1 ? '' : 's'} in the last {range === '24h' ? '24 hours' : range === '7d' ? '7 days' : '30 days'}
            </p>
          </div>

          <div className="inline-flex shrink-0 self-start bg-surface-container-low p-[3px] gap-[2px] rounded-md border-[0.5px] border-outline-variant">
            {(['24h', '7d', '30d'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onRangeChange(option)}
                aria-pressed={range === option}
                className={`h-[26px] px-3 rounded-[4px] text-xs font-medium transition-colors cursor-pointer ${
                  range === option
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Column chart: one column per hour or day; hover a column for its count */}
        <div className="mt-6 flex gap-2" onMouseLeave={() => setHovered(null)}>
          {/* Y-axis ticks */}
          <div className="relative h-56 w-7 shrink-0 text-right font-mono text-[10px] tabular-nums text-outline" aria-hidden="true">
            {data.ticks.map(tick => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${(1 - tick / data.axisMax) * 100}%` }}
              >
                {tick}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative h-56">
              {/* Gridlines */}
              {data.ticks.map(tick => (
                <div
                  key={tick}
                  className={`pointer-events-none absolute inset-x-0 h-px ${tick === 0 ? 'bg-outline-variant' : 'bg-surface-container-high'}`}
                  style={{ top: `${(1 - tick / data.axisMax) * 100}%` }}
                />
              ))}

              {/* Columns; each slot is the full-height hover target */}
              <div className="absolute inset-0 flex items-end" aria-hidden="true">
                {data.points.map((pt, i) => {
                  const isHovered = hovered === i;
                  const dimmed = hovered !== null && !isHovered;
                  const height = (pt.clicks / data.axisMax) * 100;
                  // Tooltip sits above the column; a tall column gets it beside its top instead, facing
                  // into the chart, so it never covers the column it describes
                  const inRightHalf = i >= data.points.length / 2;
                  const besideColumn = height > 70;
                  const tooltipPosition = besideColumn
                    ? (inRightHalf ? 'right-full mr-1 translate-y-1/2' : 'left-full ml-1 translate-y-1/2')
                    : `mb-1.5 ${i < data.points.length / 4 ? 'left-0' : i > (data.points.length * 3) / 4 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`;
                  return (
                    <div
                      key={pt.date}
                      className="relative flex h-full flex-1 items-end justify-center px-[1px]"
                      onMouseEnter={() => setHovered(i)}
                    >
                      {pt.clicks > 0 ? (
                        <div
                          className={`w-full max-w-[24px] rounded-t-[4px] transition-colors ${isHovered ? 'bg-primary-ink' : dimmed ? 'bg-[#65A30D]/40' : 'bg-[#65A30D]'}`}
                          style={{ height: `${Math.max(height, 1.5)}%` }}
                        />
                      ) : (
                        // Zero: a faint stub on the baseline so the bucket still reads as counted
                        <div className={`h-[2px] w-full max-w-[24px] rounded-full ${isHovered ? 'bg-outline' : 'bg-surface-container-highest'}`} />
                      )}

                      {/* The busiest bucket carries its value on the cap; the rest live in the tooltip */}
                      {i === data.peakIndex && hovered === null && (
                        <span
                          className="pointer-events-none absolute pb-1 font-mono text-[10px] font-semibold text-on-surface"
                          style={{ bottom: `${height}%` }}
                        >
                          {pt.clicks}
                        </span>
                      )}

                      {isHovered && (
                        <div
                          className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-md border-[0.5px] border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 shadow-md ${tooltipPosition}`}
                          style={{ bottom: `${besideColumn ? height : Math.max(height, 1.5)}%` }}
                        >
                          <div className="text-[11px] text-on-surface-variant">{pt.date}</div>
                          <div className="text-xs font-semibold text-on-surface">
                            {pt.clicks.toLocaleString()} click{pt.clicks === 1 ? '' : 's'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis labels, aligned to their columns */}
            <div className="flex pt-2 font-mono text-[10px] text-outline" aria-hidden="true">
              {data.points.map((pt, i) => {
                const fromEnd = data.points.length - 1 - i;
                const show = fromEnd % data.labelEvery === 0;
                return (
                  <div key={pt.date} className="relative flex flex-1 justify-center">
                    {show && (
                      // Phones get every other label so neighbours don't run together
                      <span className={`whitespace-nowrap ${fromEnd === 0 ? 'font-semibold text-on-surface-variant' : ''} ${(fromEnd / data.labelEvery) % 2 === 1 ? 'hidden sm:inline' : ''}`}>
                        {pt.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Same numbers as a table for screen readers */}
            <table className="sr-only">
              <caption>Clicks per {data.unit}</caption>
              <tbody>
                {data.points.map(pt => (
                  <tr key={pt.date}><th scope="row">{pt.date}</th><td>{pt.clicks}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-outline-variant pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] text-on-surface-variant">Total</span>
          <span className="text-sm font-semibold text-on-surface">{data.total.toLocaleString()}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] text-on-surface-variant">Busiest {data.unit}</span>
          <span className="truncate text-sm font-semibold text-on-surface">
            {data.peakIndex >= 0 ? <>{data.peak.date} <span className="font-normal text-on-surface-variant">· {data.peak.clicks}</span></> : '—'}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] text-on-surface-variant">Average per {data.unit}</span>
          <span className="text-sm font-semibold text-on-surface">{data.average.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
