import React from 'react';

type ShapeItem = Record<string, any>;

function toNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function renderLine(item: ShapeItem, key: string, label?: string) {
  const points = Array.isArray(item.points) ? item.points : [];
  if (points.length < 2) return null;
  const [p1, p2] = points;
  const x1 = toNumber(p1?.[0]);
  const y1 = toNumber(p1?.[1]);
  const x2 = toNumber(p2?.[0]);
  const y2 = toNumber(p2?.[1]);
  const stroke = item.stroke || '#1e293b';
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
      stroke={item.stroke || '#1e293b'}
      strokeWidth={toNumber(item.strokeWidth, 2)}
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
      stroke={item.stroke || '#1e293b'}
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
      stroke={item.stroke || '#1e293b'}
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
  const stroke = item.stroke || '#1e293b';
  const strokeWidth = toNumber(item.strokeWidth, 2);
  const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  return <path key={key} d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} />;
}

function renderRightAngleMarker(item: ShapeItem, key: string) {
  const pos = item.position || [0, 0];
  const size = toNumber(item.size, 12);
  const x = toNumber(pos[0]);
  const y = toNumber(pos[1]);
  const stroke = item.stroke || '#1e293b';
  const strokeWidth = toNumber(item.strokeWidth, 2);
  return (
    <path
      key={key}
      d={`M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y - size}`}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
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
      fill={item.color || '#1e293b'}
      fontWeight={item.fontWeight || 'normal'}
    >
      {item.text || ''}
    </text>
  );
}

function renderGeometry(data: ShapeItem) {
  const width = toNumber(data.width, 320);
  const height = toNumber(data.height, 220);
  const shapes = Array.isArray(data.shapes) ? data.shapes : [];
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];
  const items = [...shapes, ...annotations];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
      {items.map((item, idx) => {
        const type = item.type;
        const label = item.label;
        const key = `${type}-${idx}`;
        if (type === 'line') return renderLine(item, key, label);
        if (type === 'circle') return renderCircle(item, key);
        if (type === 'ellipse') return renderEllipse(item, key);
        if (type === 'polygon') return renderPolygon(item, key);
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
  const points = Array.isArray(data.points) ? data.points : [];
  const specialPoints = Array.isArray(data.specialPoints) ? data.specialPoints : [];
  const xRange = data.xRange || null;
  const yRange = data.yRange || null;

  const xs = points.map((p: any) => toNumber(p.x ?? p[0]));
  const ys = points.map((p: any) => toNumber(p.y ?? p[1]));
  const minX = xRange ? toNumber(xRange[0]) : Math.min(...xs, 0);
  const maxX = xRange ? toNumber(xRange[1]) : Math.max(...xs, 1);
  const minY = yRange ? toNumber(yRange[0]) : Math.min(...ys, 0);
  const maxY = yRange ? toNumber(yRange[1]) : Math.max(...ys, 1);

  const mapX = (x: number) => ((x - minX) / (maxX - minX || 1)) * (width - 40) + 20;
  const mapY = (y: number) => height - 20 - ((y - minY) / (maxY - minY || 1)) * (height - 40);

  const polyline = points
    .map((p: any) => `${mapX(toNumber(p.x ?? p[0]))},${mapY(toNumber(p.y ?? p[1]))}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
      <line x1={20} y1={height - 20} x2={width - 20} y2={height - 20} stroke="#94a3b8" strokeWidth={1} />
      <line x1={20} y1={20} x2={20} y2={height - 20} stroke="#94a3b8" strokeWidth={1} />
      {polyline && <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth={2} />}
      {specialPoints.map((pt: any, idx: number) => {
        const x = mapX(toNumber(pt.x));
        const y = mapY(toNumber(pt.y));
        return (
          <g key={`sp-${idx}`}>
            <circle cx={x} cy={y} r={4} fill={pt.color || '#ef4444'} />
            {pt.label ? (
              <text x={x + 6} y={y - 6} fontSize={12} fill={pt.color || '#ef4444'}>
                {pt.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function renderTable(data: ShapeItem) {
  const headers = Array.isArray(data.headers) ? data.headers : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return (
    <div style={{ overflowX: 'auto' }}>
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
                    borderBottom: '1px solid #e2e8f0',
                    background: '#f8fafc',
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
                    borderBottom: '1px solid #e2e8f0',
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

