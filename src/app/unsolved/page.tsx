"use client";

import React from "react";
import { useAppContext } from "../../context/AppContext";
import { RefreshCw } from "lucide-react";

export default function UnsolvedPage() {
    const { attemptedUnsolvedProblems, fetchAndMergeUserData, handle, loadingUser } = useAppContext();

    if (!attemptedUnsolvedProblems) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-300">
                Loading unsolved problems...
            </div>
        );
    }

    const validProblems = attemptedUnsolvedProblems.filter(p => p.link);

    const handleRefresh = async () => {
        if (handle) {
            await fetchAndMergeUserData(handle);
        }
    };

    if (validProblems.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                <h1 className="text-2xl font-semibold mb-3">🎉 All problems solved!</h1>
                <p className="text-sm">No unsolved problems found. Keep grinding 🔥</p>
                <button
                    onClick={handleRefresh}
                    disabled={loadingUser || !handle}
                    className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <RefreshCw className={`w-4 h-4 ${loadingUser ? "animate-spin" : ""}`} />
                    Refresh List
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen font-mono w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition">
            <div className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold">All Unsolved Problems</h1>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={loadingUser || !handle}
                            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            title="Refresh unsolved problems"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingUser ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {validProblems.map((p, idx) => (
                        <a
                            key={p.key}
                            href={p.link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-col md:flex-row items-start md:items-center gap-3 p-4 rounded-lg shadow hover:-translate-y-0.5 hover:shadow-lg transition bg-white dark:bg-gray-800"
                        >
                            {/* Number + Name + Index + Contest */}
                            <div className="flex items-center gap-2 min-w-[50px] font-mono font-semibold text-sm">
                                <span>{idx + 1}.</span>
                                <span>{p.name || "Unknown Problem"}</span>
                                <span className="px-2 py-0.5 border rounded text-xs border-blue-700">
                                    {p.index}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                    Contest: {p.contestId}
                                </span>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 max-w-[500px]">
                                {p.tags?.map((t, tidx) => (
                                    <span
                                        key={t + tidx}
                                        className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>

                            {/* Verdict and attempts */}
                            <div className="ml-auto flex items-center gap-4 text-sm font-semibold">
                                <span
                                    className={
                                        p.lastVerdict === "OK"
                                            ? "text-green-400"
                                            : "text-red-400"
                                    }
                                >
                                    {p.lastVerdict || "N/A"}
                                </span>

                                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                    <span>Tried:</span>
                                    <span>{p.attempts ?? 0}</span>
                                    <span>Times</span>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
