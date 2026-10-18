import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Country } from '../types';
import { COLORS, fmt } from '../lib/metrics';
import { ChartTooltipBox } from './ui';

interface Series {
  country: Country;
  color: string;
}

interface ExposureRadarProps {
  series: Series[];
  height?: number;
}

interface Row {
  axis: string;
  [iso3: string]: number | string | null;
}

/** 10-axis exposure profile (0-100). Missing axes are drawn at 0 and labelled "n.d." in the tooltip. */
export default function ExposureRadar({ series, height = 260 }: ExposureRadarProps) {
  const axes = series[0]?.country.dependencies?.exposure.axes ?? [];
  if (!axes.length) return <p className="text-xs text-terminal-muted">Profil d’exposition indisponible pour ce pays.</p>;

  const data: Row[] = axes.map((axis) => {
    const row: Row = { axis: axis.label };
    for (const { country } of series) {
      const v = country.dependencies?.exposure.axes.find((a) => a.key === axis.key)?.value ?? null;
      row[country.iso3] = v ?? 0;
      row[`${country.iso3}_raw`] = v;
    }
    return row;
  });

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%" margin={{ top: 4, right: 24, bottom: 4, left: 24 }}>
          <PolarGrid stroke={COLORS.grid} />
          <PolarAngleAxis dataKey="axis" tick={{ fill: COLORS.sub, fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={5} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Row;
              return (
                <ChartTooltipBox
                  title={String(row.axis)}
                  rows={series.map(({ country, color }) => {
                    const raw = row[`${country.iso3}_raw`];
                    return { label: country.name_fr, value: typeof raw === 'number' ? `${fmt.num(raw, 0)} / 100` : 'n.d.', color };
                  })}
                />
              );
            }}
          />
          {series.map(({ country, color }) => (
            <Radar
              key={country.iso3}
              name={country.name_fr}
              dataKey={country.iso3}
              stroke={color}
              strokeWidth={2}
              fill={color}
              fillOpacity={series.length > 1 ? 0.15 : 0.28}
              dot={{ r: 2.5, fill: color, stroke: COLORS.surface, strokeWidth: 1 }}
              isAnimationActive={false}
            />
          ))}
          {series.length > 1 && (
            <Legend verticalAlign="top" height={22} iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs text-terminal-sub">{v}</span>} />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
