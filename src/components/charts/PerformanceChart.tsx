import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PerformanceChartItem {
  label: string;
  value: number;
  /** Optional second series (e.g. pass rate % on same 0–100 scale). */
  secondary?: number;
}

export function PerformanceChart({
  data,
  emptyLabel = "No data yet.",
  valueLabel = "Average %",
  secondaryLabel = "Pass rate %",
  slantedLabels = false,
  /** When false, Y-axis scales to data (e.g. attempt counts per week). */
  yPercentScale = true,
}: {
  data: PerformanceChartItem[];
  emptyLabel?: string;
  valueLabel?: string;
  secondaryLabel?: string;
  /** Use when labels are long (e.g. question set titles). */
  slantedLabels?: boolean;
  yPercentScale?: boolean;
}) {
  const hasPrimary = data.length > 0 && data.some((d) => Number.isFinite(d.value));
  const hasSecondary = data.some((d) => d.secondary !== undefined && Number.isFinite(d.secondary));
  const hasData = hasPrimary || (hasSecondary && data.some((d) => Number.isFinite(d.secondary as number)));
  if (!hasData) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={slantedLabels ? -28 : 0}
            textAnchor={slantedLabels ? "end" : "middle"}
            height={slantedLabels ? 72 : 36}
          />
          <YAxis
            domain={yPercentScale ? [0, 100] : [0, "auto"]}
            tickFormatter={(v) => (yPercentScale ? `${v}%` : String(Math.round(Number(v))))}
          />
          <Tooltip
            formatter={(val, name) => {
              const n = typeof val === "number" ? val : Number(val);
              const label = name === "value" ? valueLabel : secondaryLabel;
              return [yPercentScale && Number.isFinite(n) ? `${n.toFixed(1)}%` : String(val ?? ""), label];
            }}
          />
          {hasSecondary ? <Legend /> : null}
          <Bar dataKey="value" name={valueLabel} fill="#4f46e5" radius={[6, 6, 0, 0]} />
          {hasSecondary ? <Bar dataKey="secondary" name={secondaryLabel} fill="#059669" radius={[6, 6, 0, 0]} /> : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
