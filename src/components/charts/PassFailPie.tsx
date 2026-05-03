import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#16a34a", "#dc2626"];

export function PassFailPie({ pass, fail, caption }: { pass: number; fail: number; caption?: string }) {
  const total = pass + fail;
  if (total === 0) {
    return (
      <div className="space-y-2">
        {caption ? <p className="text-xs text-slate-500">{caption}</p> : null}
        <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
          No pass/fail data yet.
        </div>
      </div>
    );
  }
  const data = [
    { name: "Pass", value: pass },
    { name: "Fail", value: fail },
  ];
  return (
    <div className="space-y-2">
      {caption ? <p className="text-xs text-slate-500">{caption}</p> : null}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
