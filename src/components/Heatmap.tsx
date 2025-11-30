import React, { useMemo, useState, useEffect } from "react";

interface HeatmapProps {
    dailyCounts: Record<string, number>;
}

type YearOption = "last12Months" | number;

const Heatmap: React.FC<HeatmapProps> = ({ dailyCounts }) => {
    const [selectedYear, setSelectedYear] = useState<YearOption>("last12Months");
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const msUntilMidnight = tomorrow.getTime() - now.getTime();

        let intervalId: NodeJS.Timeout | null = null;

        const timeout = setTimeout(() => {
            setCurrentDate(new Date());
            intervalId = setInterval(() => {
                setCurrentDate(new Date());
            }, 24 * 60 * 60 * 1000);
        }, msUntilMidnight);

        return () => {
            clearTimeout(timeout);
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        Object.keys(dailyCounts).forEach((date) => {
            const year = new Date(date).getFullYear();
            if (!isNaN(year)) years.add(year);
        });
        years.add(currentDate.getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [dailyCounts, currentDate]);

    const datesToDisplay = useMemo(() => {
        const dates: { date: string; count: number }[] = [];
        const today = new Date();

        let startDate: Date;
        let endDate: Date;

        if (selectedYear === "last12Months") {
            endDate = new Date(today);
            startDate = new Date(today);
            // 11 months back = 12 months total including current
            startDate.setMonth(today.getMonth() - 11);
            startDate.setDate(1);
        } else {
            startDate = new Date(selectedYear, 0, 1);
            endDate = new Date(selectedYear, 11, 31);
        }

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = current.toISOString().split("T")[0];
            dates.push({
                date: dateStr,
                count: dailyCounts[dateStr] || 0,
            });
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }, [selectedYear, dailyCounts, currentDate]);

    const monthsData = useMemo(() => {
        const months: { label: string; dates: { date: string; count: number }[] }[] = [];
        let currentMonthLabel = "";
        let currentMonthDates: { date: string; count: number }[] = [];

        datesToDisplay.forEach((item) => {
            const date = new Date(item.date);
            const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" });

            if (monthLabel !== currentMonthLabel) {
                if (currentMonthLabel) {
                    months.push({ label: currentMonthLabel, dates: currentMonthDates });
                }
                currentMonthLabel = monthLabel;
                currentMonthDates = [];
            }
            currentMonthDates.push(item);
        });

        if (currentMonthLabel) {
            months.push({ label: currentMonthLabel, dates: currentMonthDates });
        }

        return months;
    }, [datesToDisplay]);

    const getColorClass = (count: number) => {
        if (count === 0) return "bg-gray-200 dark:bg-gray-700";
        if (count === 1) return "bg-green-300 dark:bg-green-300";
        if (count === 2) return "bg-green-500 dark:bg-green-500";
        return "bg-green-800 dark:bg-green-700";
    };

    const getTooltip = (date: string, count: number) => {
        return `${count} problem${count !== 1 ? "s" : ""} solved on ${date}`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Submission Heatmap
                </h2>
                <select
                    value={selectedYear}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSelectedYear(val === "last12Months" ? "last12Months" : Number(val));
                    }}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="last12Months">Last 12 Months</option>
                    {availableYears.map((year) => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </div>

            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max justify-center">
                    {monthsData.map((month, mIdx) => {
                        const firstDate = new Date(month.dates[0].date);
                        const startDay = firstDate.getDay();

                        const placeholders = Array(startDay).fill(null);
                        const allItems = [...placeholders, ...month.dates];

                        while (allItems.length % 7 !== 0) {
                            allItems.push(null);
                        }

                        const weeks = [];
                        for (let i = 0; i < allItems.length; i += 7) {
                            weeks.push(allItems.slice(i, i + 7));
                        }

                        return (
                            <div key={mIdx} className="flex flex-col gap-2 items-center">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    {month.label}
                                </span>
                                <div className="flex gap-1">
                                    {weeks.map((week, wIdx) => (
                                        <div key={wIdx} className="flex flex-col gap-1">
                                            {week.map((item, dIdx) => {
                                                if (!item) {
                                                    return <div key={`empty-${dIdx}`} className="w-3 h-3" />;
                                                }
                                                return (
                                                    <div
                                                        key={item.date}
                                                        className={`w-3 h-3 rounded-sm ${getColorClass(item.count)}`}
                                                        title={getTooltip(item.date, item.count)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4 mt-6 text-sm text-gray-600 dark:text-gray-400 justify-center">
                    <span>Less</span>
                    <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700" title="0 solved" />
                        <div className="w-3 h-3 rounded-sm bg-green-300" title="1 solved" />
                        <div className="w-3 h-3 rounded-sm bg-green-500" title="2 solved" />
                        <div className="w-3 h-3 rounded-sm bg-green-800 dark:bg-green-700" title="3+ solved" />
                    </div>
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};

export default Heatmap;
