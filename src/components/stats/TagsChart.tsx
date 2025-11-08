"use client";

import React, { useCallback, useEffect, useState } from "react";
import ProblemRatings from "./problemRatings";
import TagsDonut from "./TagsDonut";

const USER_HANDLE_KEY = "cf_user_handle_v1";
const USER_INFO_KEY = "cf_user_info_v1";
const USER_SOLVED_KEY = "cf_user_solved_v1";

/* --------------------- EnterHandle (user provided) --------------------- */
interface EnterHandleProps {
    onSubmitHandle: (handle: string) => Promise<void>;
    onClear?: () => void;
    isLoading?: boolean;
}

const EnterHandle: React.FC<EnterHandleProps> = ({ onSubmitHandle, onClear, isLoading = false }) => {
    const [handle, setHandle] = useState("");
    const [savedHandle, setSavedHandle] = useState<string | null>(null);
    const [localLoading, setLocalLoading] = useState(false);

    useEffect(() => {
        try {
            const stored = typeof window !== "undefined" ? localStorage.getItem(USER_HANDLE_KEY) : null;
            if (stored) {
                const id = window.setTimeout(() => setSavedHandle(stored), 0);
                return () => clearTimeout(id);
            }
        } catch {
            // ignore
        }
    }, []);

    const submit = async () => {
        const trimmed = handle.trim();
        if (!trimmed) return;
        setSavedHandle(trimmed);
        try {
            if (typeof window !== "undefined") localStorage.setItem(USER_HANDLE_KEY, trimmed);
        } catch { }
        setHandle("");
        try {
            setLocalLoading(true);
            await onSubmitHandle(trimmed);
        } catch (err) {
            console.warn("EnterHandle submit failed", err);
        } finally {
            setLocalLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") submit();
    };

    const removeHandle = () => {
        setSavedHandle(null);
        try {
            localStorage.removeItem(USER_HANDLE_KEY);
            localStorage.removeItem(USER_INFO_KEY);
            localStorage.removeItem(USER_SOLVED_KEY);
        } catch { }
        if (onClear) {
            try {
                onClear();
            } catch { }
        }
    };

    const busy = localLoading || isLoading;

    return (
        <div className="flex gap-2 items-center">
            {!savedHandle ? (
                <>
                    <input
                        type="text"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Enter your handle, e.g. tourist"
                        className="px-3 py-2 w-[300px] rounded border focus:outline-none focus:ring focus:ring-blue-500 dark:bg-gray-800 dark:text-white dark:border-gray-700"
                        disabled={busy}
                    />
                    <button
                        onClick={submit}
                        className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60 flex items-center gap-2"
                        disabled={busy}
                        title={busy ? "Loading user data…" : "Submit handle"}
                    >
                        {busy ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                                    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                                </svg>
                                Loading
                            </>
                        ) : (
                            "Submit"
                        )}
                    </button>
                </>
            ) : (
                <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded">
                    <span
                        onClick={async () => {
                            if (!savedHandle) return;
                            try {
                                setLocalLoading(true);
                                await onSubmitHandle(savedHandle);
                            } finally {
                                setLocalLoading(false);
                            }
                        }}
                        className="font-medium dark:text-white cursor-pointer hover:underline"
                        title="Click to re-fetch submissions"
                    >
                        {savedHandle}
                    </span>
                    <button onClick={removeHandle} className="text-red-500 hover:text-red-700 font-bold" title="Remove handle and cached data">
                        ✕
                    </button>
                    {isLoading && (
                        <svg className="w-4 h-4 ml-2 animate-spin text-gray-600" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                            <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                    )}
                </div>
            )}
        </div>
    );
};

export default function StatsPage(): React.ReactElement {
    const [handle, setHandle] = useState<string | null>(() => {
        try { return typeof window !== "undefined" ? localStorage.getItem(USER_HANDLE_KEY) : null; } catch { return null; }
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = useCallback(async (h: string) => {
        setHandle(h);
        setLoading(true);
        try {
            try { localStorage.setItem(USER_HANDLE_KEY, h); } catch { }
        } finally {
            setLoading(false);
        }
    }, []);

    const handleClear = useCallback(() => {
        setHandle(null);
        try { localStorage.removeItem(USER_HANDLE_KEY); localStorage.removeItem(USER_SOLVED_KEY); } catch { }
    }, []);

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold">User Stats</h1>
                <EnterHandle onSubmitHandle={handleSubmit} onClear={handleClear} isLoading={loading} />
            </div>

            {!handle && (
                <div className="text-gray-600">Enter your Codeforces handle above to see problem rating and tag statistics.</div>
            )}

            {handle && (
                <div className="flex flex-col gap-6">
                    <ProblemRatings handle={handle} />
                    <TagsDonut handle={handle} />
                </div>
            )}
        </div>
    );
}
