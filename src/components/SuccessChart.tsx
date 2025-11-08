"use client";

import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface SuccessChartProps {
  totalSolved: number;
  totalAttemptedUnsolved: number;
  totalNotTried: number;
  size?: number; // optional override for outer container (px)
}

// Dynamic color setup that adapts to theme mode using CSS variables
const COLORS = [
  "var(--solved-color)",
  "var(--unsolved-color)",
  "var(--not-tried-color)",
];
const NAMES = ["Solved", "Attempted Unsolved", "Not Tried"];

const formatNumber = (n: number) => n.toLocaleString();

const SuccessChart: React.FC<SuccessChartProps> = ({
  totalSolved,
  totalAttemptedUnsolved,
  totalNotTried,
  size = 180,
}) => {
  const data = useMemo(
    () => [
      { name: NAMES[0], value: Math.max(0, Math.round(totalSolved)) },
      { name: NAMES[1], value: Math.max(0, Math.round(totalAttemptedUnsolved)) },
      { name: NAMES[2], value: Math.max(0, Math.round(totalNotTried)) },
    ],
    [totalSolved, totalAttemptedUnsolved, totalNotTried]
  );

  const total = data.reduce((s, d) => s + d.value, 0);

  const withPerc = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        percent: total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0,
      })),
    [data, total]
  );

  const centerText = useMemo(() => `${withPerc[0]?.percent ?? 0}%`, [withPerc]);

  const tooltipFormatter = (value: number, name: string) => {
    const item = withPerc.find((i) => i.name === name) || null;
    const pct = item ? `${item.percent}%` : "";
    return [`${formatNumber(value)} (${pct})`, name];
  };

  const emptyData = [{ name: "empty", value: 1 }];

  return (
    <div
      style={{ width: size, height: size + 40 }}
      aria-hidden
      className="relative flex flex-col items-center text-gray-900 dark:text-gray-100 transition-colors duration-300"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total === 0 ? emptyData : withPerc}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.33}
              outerRadius={size * 0.45}
              startAngle={90}
              endAngle={450}
              dataKey="value"
              stroke="none"
              isAnimationActive
            >
              {(total === 0 ? emptyData : withPerc).map((entry, index) =>
                total === 0 ? (
                  <Cell key="empty" fill="var(--muted-bg)" />
                ) : (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                )
              )}
            </Pie>

            <Tooltip
              formatter={tooltipFormatter}
              cursor={{ fill: "transparent" }}
              wrapperStyle={{
                zIndex: 9999,
                fontSize: "0.75rem",
                backgroundColor: "var(--tooltip-bg)",
                color: "var(--tooltip-text)",
                borderRadius: "8px",
                padding: "4px 8px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          style={{ pointerEvents: "none" }}
        >
          <div className="text-base font-semibold text-blue-600 dark:text-blue-400">
            {centerText}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Solved</div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SuccessChart);
