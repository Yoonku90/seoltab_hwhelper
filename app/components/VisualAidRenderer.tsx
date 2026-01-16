import React from 'react';

type ShapeItem = Record<string, any>;

const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#ef4444',
  purple: '#8b5cf6',
  text: '#1e293b',
  textLight: '#64748b',
  grid: '#f1f5f9',
  gridDark: '#e2e8f0',
  background: '#ffffff',
};

function toNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseFunction(funcStr: string): (x: number) => number {
  const expr = funcStr.replace(/^y\s*=\s*/i, '').trim();
  const jsExpr = expr
    .replace(/(\d)(x)/g, '$1*$2')
    .replace(/\u00B2/g, '**2')
    .replace(/\u00B3/g, '**3')
    .replace(/x\^2/g, 'x**2')
    .replace(/x\^3/g, 'x**3')
    .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
    .replace(/sin/g, 'Math.sin')
    .replace(/cos/g, 'Math.cos')
    .replace(/tan/g, 'Math.tan')
    .replace(/log/g, 'Math.log')
    .replace(/ln/g, 'Math.log')
    .replace(/\u03c0/g, 'Math.PI');
  return new Function('x', `return ${jsExpr}`) as (x: number) => number;
}

function expandBounds(bounds: { minX: number; minY: number; maxX: number; maxY: number }, x: number, y: number) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function getGeometryBounds(items: ShapeItem[]) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const item of items) {
    switch (item.type) {
      case 'circle': {
        const [cx, cy] = item.center || [0, 0];
        const r = toNumber(item.radius, 0);
        expandBounds(bounds, cx - r, cy - r);
        expandBounds(bounds, cx + r, cy + r);
        break;
      }
      case 'ellipse': {
        const [cx, cy] = item.center || [0, 0];
        const rx = toNumber(item.rx, 0);
        const ry = toNumber(item.ry, 0);
        expandBounds(bounds, cx - rx, cy - ry);
        expandBounds(bounds, cx + rx, cy + ry);
        break;
      }
      case 'line': {
        const points = Array.isArray(item.points) ? item.points : [];
        points.forEach((pt: any) => expandBounds(bounds, toNumber(pt?.[0]), toNumber(pt?.[1])));
        break;
      }
      case 'polygon': {
        const points = Array.isArray(item.points) ? item.points : [];
        points.forEach((pt: any) => expandBounds(bounds, toNumber(pt?.[0]), toNumber(pt?.[1])));
        break;
      }
      case 'rect': {
        const [x, y] = item.position || [0, 0];
        const w = toNumber(item.width, 0);
        const h = toNumber(item.height, 0);
        expandBounds(bounds, x, y);
        expandBounds(bounds, x + w, y + h);
        break;
      }
      case 'arc': {
        const [cx, cy] = item.center || [0, 0];
        const r = toNumber(item.radius, 0);
        expandBounds(bounds, cx - r, cy - r);
        expandBounds(bounds, cx + r, cy + r);
        break;
      }
      case 'text': {
        const [x, y] = item.position || [0, 0];
        expandBounds(bounds, x, y);
        break;
      }
      default:
        break;
    }
  }

  if (!Number.isFinite(bounds.minX)) {
    return { width: 300, height: 300, minX: 0, minY: 0, maxX: 300, maxY: 300 };
  }

  const padding = 20;
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
  };
}

function renderLine(item: ShapeItem, key: string, label?: string) {
  const points = Array.isArray(item.points) ? item.points : [];
  if (points.length < 2) return null;
  const [p1, p2] = points;
  const x1 = toNumber(p1?.[0]);
  const y1 = toNumber(p1?.[1]);
  const x2 = toNumber(p2?.[0]);
  const y2 = toNumber(p2?.[1]);
  const stroke = item.stroke || COLORS.text;
  const strokeWidth = toNumber(item.strokeWidth, 2);
  const dash = item.strokeDasharray || undefined;
  return (
    <g key={key}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
      {label ? (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} fontSize={12} fill={stroke}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function renderCircle(item: ShapeItem, key: string) {
  const center = item.center || [0, 0];
  return (
    <circle
      key={key}
      cx={toNumber(center[0])}
      cy={toNumber(center[1])}
      r={toNumber(item.radius, 10)}
      fill={item.fill || 'none'}
      stroke={item.stroke || COLORS.text}
      strokeWidth={toNumber(item.strokeWidth, 2)}
      strokeDasharray={item.strokeDasharray || undefined}
    />
  );
}

function renderEllipse(item: ShapeItem, key: string) {
  const center = item.center || [0, 0];
  return (
    <ellipse
      key={key}
      cx={toNumber(center[0])}
      cy={toNumber(center[1])}
      rx={toNumber(item.rx, 10)}
      ry={toNumber(item.ry, 6)}
      fill={item.fill || 'none'}
      stroke={item.stroke || COLORS.text}
      strokeWidth={toNumber(item.strokeWidth, 2)}
    />
  );
}

function renderPolygon(item: ShapeItem, key: string) {
  const points = Array.isArray(item.points) ? item.points : [];
  const pointStr = points.map((p: any) => `${toNumber(p?.[0])},${toNumber(p?.[1])}`).join(' ');
  return (
    <polygon
      key={key}
      points={pointStr}
      fill={item.fill || 'none'}
      stroke={item.stroke || COLORS.text}
      strokeWidth={toNumber(item.strokeWidth, 2)}
    />
  );
}

function renderRect(item: ShapeItem, key: string) {
  const pos = item.position || [0, 0];
  return (
    <rect
      key={key}
      x={toNumber(pos[0])}
      y={toNumber(pos[1])}
      width={toNumber(item.width, 10)}
      height={toNumber(item.height, 10)}
      rx={toNumber(item.rx, 0)}
      fill={item.fill || 'none'}
      stroke={item.stroke || COLORS.text}
      strokeWidth={toNumber(item.strokeWidth, 2)}
    />
  );
}

function renderArc(item: ShapeItem, key: string) {
  const center = item.center || [0, 0];
  const cx = toNumber(center[0]);
  const cy = toNumber(center[1]);
  const radius = toNumber(item.radius, 20);
  const startAngle = (toNumber(item.startAngle, 0) * Math.PI) / 180;
  const endAngle = (toNumber(item.endAngle, 90) * Math.PI) / 180;
  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const stroke = item.stroke || COLORS.text;
  const strokeWidth = toNumber(item.strokeWidth, 2);
  const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  return <path key={key} d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} />;
}

function renderRightAngleMarker(item: ShapeItem, key: string) {
  const pos = item.position || [0, 0];
  const size = toNumber(item.size, 15);
  const rotation = toNumber(item.rotation, 0);
  const x = toNumber(pos[0]);
  const y = toNumber(pos[1]);
  const stroke = item.stroke || COLORS.text;
  const strokeWidth = toNumber(item.strokeWidth, 2);
  return (
    <path
      key={key}
      d={`M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y - size}`}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      transform={`rotate(${rotation}, ${x}, ${y})`}
    />
  );
}

function renderText(item: ShapeItem, key: string) {
  const pos = item.position || [0, 0];
  return (
    <text
      key={key}
      x={toNumber(pos[0])}
      y={toNumber(pos[1])}
      fontSize={toNumber(item.fontSize, 14)}
      fill={item.color || COLORS.text}
      fontWeight={item.fontWeight || 'normal'}
      textAnchor={item.textAnchor || 'start'}
    >
      {item.text || ''}
    </text>
  );
}

function renderGeometry(data: ShapeItem) {
  const shapes = Array.isArray(data.shapes) ? data.shapes : [];
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];
  const items = [...shapes, ...annotations];
  const bounds = data.viewBox
    ? { minX: 0, minY: 0, maxX: toNumber(data.viewBox.width, 300), maxY: toNumber(data.viewBox.height, 300), width: toNumber(data.viewBox.width, 300), height: toNumber(data.viewBox.height, 300) }
    : getGeometryBounds(items);

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={data.name || 'geometry'}
    >
      {items.map((item, idx) => {
        const type = item.type;
        const label = item.label;
        const key = `${type}-${idx}`;
        if (type === 'line') return renderLine(item, key, label);
        if (type === 'circle') return renderCircle(item, key);
        if (type === 'ellipse') return renderEllipse(item, key);
        if (type === 'polygon') return renderPolygon(item, key);
        if (type === 'rect') return renderRect(item, key);
        if (type === 'arc') return renderArc(item, key);
        if (type === 'rightAngleMarker') return renderRightAngleMarker(item, key);
        if (type === 'text') return renderText(item, key);
        return null;
      })}
    </svg>
  );
}

function renderGraph(data: ShapeItem) {
  const width = 320;
  const height = 220;
  const padding = 28;
  const xRange = data.xRange || [-10, 10];
  const yRange = data.yRange || [-10, 10];
  const minX = toNumber(xRange[0], -10);
  const maxX = toNumber(xRange[1], 10);
  const minY = toNumber(yRange[0], -10);
  const maxY = toNumber(yRange[1], 10);
  const gridLines = data.gridLines !== false;
  const xLabel = data.xLabel || 'x';
  const yLabel = data.yLabel || 'y';
  const specialPoints = Array.isArray(data.specialPoints) ? data.specialPoints : [];
  const asymptotes = Array.isArray(data.asymptotes) ? data.asymptotes : [];
  const showVertex = !!data.showVertex;

  const mapX = (x: number) => ((x - minX) / (maxX - minX || 1)) * (width - padding * 2) + padding;
  const mapY = (y: number) => height - padding - ((y - minY) / (maxY - minY || 1)) * (height - padding * 2);

  const points = Array.isArray(data.points) ? data.points : [];
  let sampledPoints: Array<[number, number]> = [];

  if (points.length > 1) {
    sampledPoints = points.map((p: any) => [toNumber(p.x ?? p[0]), toNumber(p.y ?? p[1])]);
  } else if (typeof data.function === 'string' && data.function.trim().length > 0) {
    try {
      const fn = parseFunction(data.function);
      const steps = 60;
      for (let i = 0; i <= steps; i += 1) {
        const x = minX + ((maxX - minX) * i) / steps;
        const y = fn(x);
        if (Number.isFinite(y)) sampledPoints.push([x, y]);
      }
    } catch {
      sampledPoints = [];
    }
  }

  const pathPoints = sampledPoints
    .map(([x, y]) => `${mapX(x)},${mapY(y)}`)
    .join(' ');

  const ticks = 5;
  const xTicks = Array.from({ length: ticks + 1 }, (_, i) => minX + ((maxX - minX) * i) / ticks);
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minY + ((maxY - minY) * i) / ticks);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label={data.name || 'graph'}>
      <defs>
        <marker id="axis-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.text} />
        </marker>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={COLORS.background} />

      {gridLines &&
        xTicks.map((x, idx) => (
          <line
            key={`gx-${idx}`}
            x1={mapX(x)}
            y1={padding}
            x2={mapX(x)}
            y2={height - padding}
            stroke={COLORS.grid}
            strokeWidth={1}
          />
        ))}
      {gridLines &&
        yTicks.map((y, idx) => (
          <line
            key={`gy-${idx}`}
            x1={padding}
            y1={mapY(y)}
            x2={width - padding}
            y2={mapY(y)}
            stroke={COLORS.grid}
            strokeWidth={1}
          />
        ))}

      <line
        x1={padding}
        y1={mapY(0)}
        x2={width - padding}
        y2={mapY(0)}
        stroke={COLORS.text}
        strokeWidth={2}
        markerEnd="url(#axis-arrow)"
      />
      <line
        x1={mapX(0)}
        y1={height - padding}
        x2={mapX(0)}
        y2={padding}
        stroke={COLORS.text}
        strokeWidth={2}
        markerEnd="url(#axis-arrow)"
      />

      {xTicks.map((x, idx) => (
        <text key={`xt-${idx}`} x={mapX(x)} y={height - padding + 16} fontSize={10} fill={COLORS.textLight} textAnchor="middle">
          {Math.round(x * 10) / 10}
        </text>
      ))}
      {yTicks.map((y, idx) => (
        <text key={`yt-${idx}`} x={padding - 8} y={mapY(y) + 3} fontSize={10} fill={COLORS.textLight} textAnchor="end">
          {Math.round(y * 10) / 10}
        </text>
      ))}

      <text x={width - padding} y={mapY(0) - 6} fontSize={12} fill={COLORS.text} textAnchor="end">
        {xLabel}
      </text>
      <text x={mapX(0) + 6} y={padding} fontSize={12} fill={COLORS.text}>
        {yLabel}
      </text>

      {asymptotes.map((asym: any, idx: number) => {
        if (asym.type === 'vertical') {
          const x = mapX(toNumber(asym.value));
          return (
            <line
              key={`asym-v-${idx}`}
              x1={x}
              y1={padding}
              x2={x}
              y2={height - padding}
              stroke={COLORS.purple}
              strokeWidth={2}
              strokeDasharray="6,4"
            />
          );
        }
        if (asym.type === 'horizontal') {
          const y = mapY(toNumber(asym.value));
          return (
            <line
              key={`asym-h-${idx}`}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke={COLORS.purple}
              strokeWidth={2}
              strokeDasharray="6,4"
            />
          );
        }
        if (asym.type === 'oblique') {
          const slope = toNumber(asym.slope, 1);
          const intercept = toNumber(asym.intercept, toNumber(asym.value, 0));
          const y1 = slope * minX + intercept;
          const y2 = slope * maxX + intercept;
          return (
            <line
              key={`asym-o-${idx}`}
              x1={mapX(minX)}
              y1={mapY(y1)}
              x2={mapX(maxX)}
              y2={mapY(y2)}
              stroke={COLORS.purple}
              strokeWidth={2}
              strokeDasharray="6,4"
            />
          );
        }
        return null;
      })}

      {pathPoints && <polyline points={pathPoints} fill="none" stroke={COLORS.primary} strokeWidth={3} />}

      {specialPoints.map((pt: any, idx: number) => {
        const x = mapX(toNumber(pt.x));
        const y = mapY(toNumber(pt.y));
        const color = pt.color || COLORS.accent;
        return (
          <g key={`sp-${idx}`}>
            <circle cx={x} cy={y} r={5} fill={color} />
            {pt.label ? (
              <g>
                <rect x={x + 8} y={y - 22} width={110} height={18} rx={4} fill="#ffffff" stroke={COLORS.gridDark} />
                <text x={x + 12} y={y - 9} fontSize={10} fill={COLORS.text}>
                  {pt.label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {showVertex &&
        specialPoints.map((pt: any, idx: number) => (
          <g key={`vertex-${idx}`}>
            <line
              x1={mapX(toNumber(pt.x))}
              y1={mapY(toNumber(pt.y))}
              x2={mapX(toNumber(pt.x))}
              y2={mapY(minY)}
              stroke={COLORS.gridDark}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <line
              x1={mapX(minX)}
              y1={mapY(toNumber(pt.y))}
              x2={mapX(toNumber(pt.x))}
              y2={mapY(toNumber(pt.y))}
              stroke={COLORS.gridDark}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          </g>
        ))}
    </svg>
  );
}

function renderTable(data: ShapeItem) {
  const headers = Array.isArray(data.headers) ? data.headers : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return (
    <div style={{ overflowX: 'auto' }} aria-label={data.name || 'table'}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((header: string, idx: number) => (
                <th
                  key={idx}
                  style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderBottom: `1px solid ${COLORS.gridDark}`,
                    background: COLORS.background,
                    color: COLORS.text,
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row: any[], idx: number) => (
            <tr key={idx}>
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  style={{
                    padding: '6px 8px',
                    borderBottom: `1px solid ${COLORS.gridDark}`,
                  }}
                >
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VisualAidRenderer({ shape }: { shape: ShapeItem }) {
  if (!shape) return null;
  const type = shape.type || shape.data?.type;
  const data = shape.data || shape;

  if (type === 'geometry') return renderGeometry(data);
  if (type === 'graph') return renderGraph(data);
  if (type === 'table') return renderTable(data);

  return (
    <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(shape, null, 2)}
    </pre>
  );
}

