'use client';

import React from 'react';
import { GraphData } from '@/types/sat';
import { Activity, Table as TableIcon, Layers } from 'lucide-react';
import MathRenderer from './MathRenderer';

interface GraphRendererProps {
  graphData?: GraphData | null;
  className?: string;
}

export default function GraphRenderer({ graphData, className = '' }: GraphRendererProps) {
  if (!graphData || !graphData.hasGraph) return null;

  const { graphType, title, xAxisLabel, yAxisLabel, equation, points, tableData, description } = graphData;

  // Render Table if tableData is present
  if (tableData && tableData.headers && tableData.headers.length > 0) {
    return (
      <div className={`my-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 shadow-xs space-y-3 ${className}`}>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <TableIcon className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {title || 'Question Data Table'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-200/60 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold border-b border-slate-300 dark:border-slate-700">
                {tableData.headers.map((header, idx) => (
                  <th key={idx} className="p-2.5 border-r border-slate-300/50 dark:border-slate-700/50 last:border-r-0">
                    <MathRenderer text={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows?.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors"
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2.5 border-r border-slate-200 dark:border-slate-800 last:border-r-0 font-medium">
                      <MathRenderer text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
            {description}
          </p>
        )}
      </div>
    );
  }

  // Parse linear slope & intercept if equation is like "y = mx + b"
  let lineCoords: { x1: number; y1: number; x2: number; y2: number } | null = null;
  let isQuadratic = false;
  let quadParams: { a: number; h: number; k: number } | null = null;

  if (equation) {
    const cleanEq = equation.replace(/\s+/g, '').toLowerCase();

    // Try parsing linear equation y = mx + b
    const linearMatch = cleanEq.match(/y=(-?\d*\/?\d*\.?\d*)x([+-]\d*\/?\d*\.?\d*)?/);
    if (linearMatch) {
      const mStr = linearMatch[1];
      const bStr = linearMatch[2];

      let m = 1;
      if (mStr === '' || mStr === '+') m = 1;
      else if (mStr === '-') m = -1;
      else if (mStr.includes('/')) {
        const [num, den] = mStr.split('/');
        m = parseFloat(num) / parseFloat(den);
      } else {
        m = parseFloat(mStr);
      }

      let b = 0;
      if (bStr) {
        if (bStr.includes('/')) {
          const [num, den] = bStr.split('/');
          b = parseFloat(num) / parseFloat(den);
        } else {
          b = parseFloat(bStr);
        }
      }

      // Compute endpoints for x in [-10, 10]
      lineCoords = {
        x1: -10,
        y1: m * -10 + b,
        x2: 10,
        y2: m * 10 + b,
      };
    } else if (cleanEq.includes('x^2')) {
      isQuadratic = true;
      // Default standard parabola y = x^2 or similar
      quadParams = { a: 1, h: 0, k: 0 };
    }
  }

  // Canvas size and range setup
  const svgWidth = 320;
  const svgHeight = 280;
  const margin = 35;
  const xMin = -10;
  const xMax = 10;
  const yMin = -10;
  const yMax = 10;

  // Map math coordinate (x, y) to SVG (px, py)
  const mapX = (x: number) => margin + ((x - xMin) / (xMax - xMin)) * (svgWidth - 2 * margin);
  const mapY = (y: number) => svgHeight - margin - ((y - yMin) / (yMax - yMin)) * (svgHeight - 2 * margin);

  // Generate quadratic SVG path
  let quadPathStr = '';
  if (isQuadratic) {
    const quadPoints: string[] = [];
    for (let x = -10; x <= 10; x += 0.5) {
      const y = (quadParams?.a || 1) * Math.pow(x - (quadParams?.h || 0), 2) + (quadParams?.k || 0);
      if (y >= yMin - 5 && y <= yMax + 5) {
        quadPoints.push(`${mapX(x)},${mapY(y)}`);
      }
    }
    if (quadPoints.length > 1) {
      quadPathStr = `M ${quadPoints.join(' L ')}`;
    }
  }

  return (
    <div className={`my-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shadow-xs space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {title || (graphType ? `${graphType.toUpperCase()} Visual Diagram` : 'Question Graph')}
          </span>
        </div>
        {equation && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
            <MathRenderer text={`$${equation}$`} />
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {/* SVG Coordinate Plane */}
        <div className="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-inner">
          <svg width={svgWidth} height={svgHeight} className="overflow-visible select-none">
            {/* Gridlines */}
            {[-8, -6, -4, -2, 2, 4, 6, 8].map((v) => (
              <React.Fragment key={`grid-${v}`}>
                {/* Vertical grid line */}
                <line
                  x1={mapX(v)}
                  y1={margin}
                  x2={mapX(v)}
                  y2={svgHeight - margin}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="dark:stroke-slate-800"
                />
                {/* Horizontal grid line */}
                <line
                  x1={margin}
                  y1={mapY(v)}
                  x2={svgWidth - margin}
                  y2={mapY(v)}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="dark:stroke-slate-800"
                />
              </React.Fragment>
            ))}

            {/* X Axis */}
            <line
              x1={margin - 10}
              y1={mapY(0)}
              x2={svgWidth - margin + 10}
              y2={mapY(0)}
              stroke="#475569"
              strokeWidth="2"
              className="dark:stroke-slate-400"
            />
            {/* Y Axis */}
            <line
              x1={mapX(0)}
              y1={svgHeight - margin + 10}
              x2={mapX(0)}
              y2={margin - 10}
              stroke="#475569"
              strokeWidth="2"
              className="dark:stroke-slate-400"
            />

            {/* Axis Arrows */}
            <polygon points={`${svgWidth - margin + 12},${mapY(0)} ${svgWidth - margin + 5},${mapY(0) - 4} ${svgWidth - margin + 5},${mapY(0) + 4}`} fill="#475569" className="dark:fill-slate-400" />
            <polygon points={`${mapX(0)},${margin - 12} ${mapX(0) - 4},${margin - 5} ${mapX(0) + 4},${margin - 5}`} fill="#475569" className="dark:fill-slate-400" />

            {/* Axis Labels */}
            <text x={svgWidth - margin + 15} y={mapY(0) + 4} fontSize="11" fontWeight="bold" fill="#334155" className="dark:fill-slate-300">
              {xAxisLabel || 'x'}
            </text>
            <text x={mapX(0) - 4} y={margin - 15} fontSize="11" fontWeight="bold" fill="#334155" className="dark:fill-slate-300">
              {yAxisLabel || 'y'}
            </text>

            {/* Tick Numbers */}
            {[-8, -4, 4, 8].map((val) => (
              <React.Fragment key={`tick-${val}`}>
                <text x={mapX(val)} y={mapY(0) + 14} fontSize="9" fill="#94a3b8" textAnchor="middle">
                  {val}
                </text>
                <text x={mapX(0) - 8} y={mapY(val) + 3} fontSize="9" fill="#94a3b8" textAnchor="end">
                  {val}
                </text>
              </React.Fragment>
            ))}

            {/* Origin label */}
            <text x={mapX(0) - 8} y={mapY(0) + 12} fontSize="9" fill="#94a3b8">
              O
            </text>

            {/* Linear Line */}
            {lineCoords && (
              <line
                x1={mapX(lineCoords.x1)}
                y1={mapY(lineCoords.y1)}
                x2={mapX(lineCoords.x2)}
                y2={mapY(lineCoords.y2)}
                stroke="#2563eb"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}

            {/* Quadratic Curve */}
            {quadPathStr && (
              <path d={quadPathStr} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
            )}

            {/* Scatter points / labeled points */}
            {points?.map((pt, idx) => (
              <g key={idx}>
                <circle cx={mapX(pt.x)} cy={mapY(pt.y)} r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                <text
                  x={mapX(pt.x) + 7}
                  y={mapY(pt.y) - 7}
                  fontSize="10"
                  fontWeight="bold"
                  fill="#ef4444"
                  className="drop-shadow-xs"
                >
                  {pt.label || `(${pt.x}, ${pt.y})`}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Legend & Details */}
        <div className="flex-1 space-y-2 text-xs">
          {description && (
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-slate-900 dark:text-white block mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                Graph Description:
              </span>
              <MathRenderer text={description} />
            </div>
          )}

          {points && points.length > 0 && (
            <div className="space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Key Points:</span>
              <div className="flex flex-wrap gap-1">
                {points.map((p, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-mono">
                    {p.label ? `${p.label}: ` : ''}({p.x}, {p.y})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
