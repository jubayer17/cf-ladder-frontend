"use client";
import React, { useMemo } from "react";

interface Props {
    current: number;
    total: number;
    onChange: (p: number) => void;
}

const Pagination: React.FC<Props> = ({ current, total, onChange }) => {
    const pages = useMemo(() => {
        const arr: number[] = [];
        for (let i = 1; i <= total; i++) arr.push(i);
        return arr;
    }, [total]);

    return (
        <div className="flex items-center justify-center gap-2 mt-8">
            {/* Prev Button */}
            <button
                className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-black dark:text-white disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                onClick={() => onChange(Math.max(1, current - 1))}
                disabled={current === 1}
            >
                Prev
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
                {pages
                    .slice(Math.max(0, current - 3), Math.min(total, current + 2))
                    .map((p) => (
                        <button
                            key={p}
                            onClick={() => onChange(p)}
                            className={`px-3 py-1 rounded-md transition ${p === current
                                ? "bg-blue-600 text-white dark:bg-blue-500"
                                : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                                }`}
                        >
                            {p}
                        </button>
                    ))}
            </div>

            {/* Next Button */}
            <button
                className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-black dark:text-white disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                onClick={() => onChange(Math.min(total, current + 1))}
                disabled={current === total}
            >
                Next
            </button>
        </div>
    );
};

export default Pagination;
