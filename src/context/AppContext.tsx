"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Problem } from "@/types";

// Backend API URL
const BACKEND_API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const CF_API_BASE = "https://codeforces.com/api";

// Cache expiration times (in milliseconds)
const CACHE_EXPIRY = {
    USER_INFO: 60 * 60 * 1000,      // 1 hour
    PROBLEMS: 24 * 60 * 60 * 1000,   // 24 hours
    SUBMISSIONS: 60 * 60 * 1000      // 1 hour
};

// Cache helper functions
const getCacheKey = (prefix: string, handle?: string) =>
    handle ? `${prefix}_${handle}` : prefix;

const isCacheValid = (timestamp: number, expiry: number) =>
    Date.now() - timestamp < expiry;

const getCache = <T extends any>(key: string): T | null => {
    try {
        const cached = localStorage.getItem(key);
        return cached ? JSON.parse(cached) : null;
    } catch {
        return null;
    }
};

const setCache = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to cache data:', e);
    }
};

interface UserInfo {
    handle: string;
    rating?: number;
    maxRating?: number;
    titlePhoto: string;
    rank?: string;
    maxRank?: string;
}

interface AttemptedProblem {
    key: string;
    contestId?: number;
    index: string;
    name: string;
    lastTime?: number;
    link?: string;
    tags?: string[];
    lastVerdict?: string;
    attempts?: number;
}

interface AppContextType {
    handle: string | null;
    userInfo: UserInfo | null;
    problems: Problem[];
    tagCounts: Record<string, number>;
    unsolvedProblems: Problem[];
    userSolvedSet: Set<string>;
    attemptedUnsolvedProblems: AttemptedProblem[];
    loadingProblems: boolean;
    loadingUser: boolean;
    errorProblems: string | null;
    setHandleAndFetch: (newHandle: string) => Promise<void>;
    clearUser: () => void;
    fetchProblems: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within AppContextProvider");
    }
    return context;
};

const normalizeIndex = (i: any) => String(i ?? "").toUpperCase().trim();
const makeKey = (contestId: number | string | undefined, idx: any) =>
    `${String(contestId ?? "")}-${normalizeIndex(idx)}`;

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [handle, setHandle] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [userSolvedSet, setUserSolvedSet] = useState<Set<string>>(new Set());
    const [attemptedUnsolvedProblems, setAttemptedUnsolvedProblems] = useState<AttemptedProblem[]>([]);
    const [loadingProblems, setLoadingProblems] = useState(false);
    const [loadingUser, setLoadingUser] = useState(false);
    const [errorProblems, setErrorProblems] = useState<string | null>(null);

    // Use ref to track current handle without causing re-renders or dependency issues
    const handleRef = useRef(handle);

    // Update ref whenever handle changes
    useEffect(() => {
        handleRef.current = handle;
    }, [handle]);

    // Fetch problemset from Codeforces with caching
    const fetchProblems = useCallback(async (forceRefresh = false) => {
        const problemsCacheKey = 'cf_problems';
        const problemsTimestampKey = 'cf_problems_timestamp';

        // Check cache for problems list first
        if (!forceRefresh) {
            const cachedProblems = getCache<Problem[]>(problemsCacheKey);
            const timestamp = getCache<number>(problemsTimestampKey);

            if (cachedProblems && timestamp && isCacheValid(timestamp, CACHE_EXPIRY.PROBLEMS)) {
                setProblems(cachedProblems);

                // If we have a handle, load cached submissions
                if (handle) {
                    const submissionsCacheKey = getCacheKey('cf_submissions', handle);
                    const cached = getCache<{
                        solved: string[];
                        attempted: AttemptedProblem[];
                        timestamp: number;
                    }>(submissionsCacheKey);

                    if (cached && isCacheValid(cached.timestamp, CACHE_EXPIRY.SUBMISSIONS)) {
                        setUserSolvedSet(new Set(cached.solved));
                        setAttemptedUnsolvedProblems(cached.attempted);
                        return;
                    }
                }

                // If no handle, just return with problems
                if (!handle) {
                    return;
                }
            }
        }

        setLoadingProblems(true);
        setErrorProblems(null);

        try {
            // Fetch problemset
            const problemsetResponse = await fetch(`${CF_API_BASE}/problemset.problems`);
            if (!problemsetResponse.ok) throw new Error("Failed to fetch problemset");
            const problemsetData = await problemsetResponse.json();

            if (problemsetData.status !== "OK") {
                throw new Error("Codeforces API error");
            }

            const problemsRaw = problemsetData.result.problems || [];
            const statisticsRaw = problemsetData.result.problemStatistics || [];

            // Create a map of "contestId-index" -> solvedCount
            const solvedCountMap = new Map<string, number>();
            for (const stat of statisticsRaw) {
                if (stat.contestId && stat.index) {
                    solvedCountMap.set(`${stat.contestId}-${stat.index}`, stat.solvedCount);
                }
            }

            const allProblems: Problem[] = problemsRaw.map((p: any) => ({
                contestId: p.contestId,
                index: p.index,
                name: p.name,
                type: p.type,
                rating: p.rating,
                tags: p.tags || [],
                solvedCount: solvedCountMap.get(`${p.contestId}-${p.index}`)
            }));

            setProblems(allProblems);

            // Cache problems
            setCache(problemsCacheKey, allProblems);
            setCache(problemsTimestampKey, Date.now());

            // Only fetch user submissions if handle exists
            if (handle) {
                const statusResponse = await fetch(`${CF_API_BASE}/user.status?handle=${handle}&from=1&count=100000`);
                if (!statusResponse.ok) throw new Error("Failed to fetch user status");
                const statusData = await statusResponse.json();

                if (statusData.status !== "OK") {
                    throw new Error("Failed to fetch user submissions");
                }

                const submissions = statusData.result || [];
                const solved = new Set<string>();
                const attemptedUnsolved: Map<string, AttemptedProblem> = new Map();

                for (const sub of submissions) {
                    if (!sub.problem) continue;

                    const key = makeKey(sub.problem.contestId, sub.problem.index);
                    const submissionTime = sub.creationTimeSeconds || 0;

                    if (sub.verdict === "OK") {
                        solved.add(key);
                        attemptedUnsolved.delete(key); // Remove from attempted if solved
                    } else if (sub.verdict && sub.verdict !== "TESTING" && sub.verdict !== "COMPILATION_ERROR") {
                        const existing = attemptedUnsolved.get(key);
                        const lastTime = existing ? Math.max(existing.lastTime || 0, submissionTime) : submissionTime;
                        const attempts = (existing?.attempts || 0) + 1;

                        attemptedUnsolved.set(key, {
                            key,
                            contestId: sub.problem.contestId,
                            index: sub.problem.index,
                            name: sub.problem.name || "",
                            lastTime,
                            link: `https://codeforces.com/problemset/problem/${sub.problem.contestId}/${sub.problem.index}`,
                            tags: sub.problem.tags || [],
                            lastVerdict: sub.verdict,
                            attempts
                        });
                    }
                }

                setUserSolvedSet(solved);
                setAttemptedUnsolvedProblems(Array.from(attemptedUnsolved.values()));

                // Cache submissions
                const submissionsCacheKey = getCacheKey('cf_submissions', handle);
                setCache(submissionsCacheKey, {
                    solved: Array.from(solved),
                    attempted: Array.from(attemptedUnsolved.values()),
                    timestamp: Date.now()
                });
            }
        } catch (error: any) {
            console.error("Failed to fetch problems:", error);
            setErrorProblems(error.message || "Failed to load problems");
        } finally {
            setLoadingProblems(false);
        }
    }, [handle]);

    // Fetch user info with caching
    const fetchUserInfo = useCallback(async (userHandle: string, forceRefresh = false) => {
        const cacheKey = getCacheKey('cf_userinfo', userHandle);
        const timestampKey = `${cacheKey}_timestamp`;

        // Check cache first
        if (!forceRefresh) {
            const cached = getCache<UserInfo>(cacheKey);
            const timestamp = getCache<number>(timestampKey);

            if (cached && timestamp && isCacheValid(timestamp, CACHE_EXPIRY.USER_INFO)) {
                setUserInfo(cached);
                return;
            }
        }

        setLoadingUser(true);
        try {
            const response = await fetch(`${CF_API_BASE}/user.info?handles=${userHandle}`);
            if (!response.ok) throw new Error("Failed to fetch user info");

            const data = await response.json();
            if (data.status !== "OK" || !data.result || data.result.length === 0) {
                throw new Error("User not found");
            }

            const user = data.result[0];
            const userInfo: UserInfo = {
                handle: user.handle,
                rating: user.rating,
                maxRating: user.maxRating,
                titlePhoto: user.titlePhoto || `https://userpic.codeforces.org/no-title.jpg`,
                rank: user.rank,
                maxRank: user.maxRank
            };

            setUserInfo(userInfo);

            // Cache the user info
            setCache(cacheKey, userInfo);
            setCache(timestampKey, Date.now());
        } catch (error: any) {
            console.error("Failed to fetch user info:", error);
            setUserInfo(null);
        } finally {
            setLoadingUser(false);
        }
    }, []);

    // Set handle and fetch data
    const setHandleAndFetch = useCallback(async (newHandle: string) => {
        if (!newHandle.trim()) return;

        setHandle(newHandle);
        localStorage.setItem("cf_handle", newHandle);

        await Promise.all([
            fetchUserInfo(newHandle),
            // fetchProblems will be called via useEffect when handle changes
        ]);
    }, [fetchUserInfo]);

    // Clear user data but keep problems for browsing
    const clearUser = useCallback(() => {
        // Use ref to get current handle value without adding it as dependency
        const currentHandle = handleRef.current;

        setHandle(null);
        setUserInfo(null);
        setUserSolvedSet(new Set());
        setAttemptedUnsolvedProblems([]);
        localStorage.removeItem("cf_handle");

        // Also clear cached user data to prevent restoration
        if (currentHandle) {
            const userInfoKey = getCacheKey('cf_userinfo', currentHandle);
            const userInfoTimestampKey = `${userInfoKey}_timestamp`;
            const submissionsKey = getCacheKey('cf_submissions', currentHandle);

            localStorage.removeItem(userInfoKey);
            localStorage.removeItem(userInfoTimestampKey);
            localStorage.removeItem(submissionsKey);
        }

        // Note: problems array is kept intact for browsing mode
    }, []); // No dependencies needed since we use ref

    // Load handle from localStorage and problems on mount
    useEffect(() => {
        // Always fetch problems on mount for browsing mode
        void fetchProblems();

        const savedHandle = localStorage.getItem("cf_handle");
        if (savedHandle) {
            setHandle(savedHandle);
            void fetchUserInfo(savedHandle);
        }
    }, [fetchUserInfo, fetchProblems]);

    // Fetch problems when handle changes
    useEffect(() => {
        if (handle) {
            void fetchProblems();
        }
    }, [handle, fetchProblems]);

    // Compute tag counts from solved problems
    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const key of userSolvedSet) {
            const problem = problems.find(p => makeKey(p.contestId, p.index) === key);
            if (problem?.tags) {
                for (const tag of problem.tags) {
                    counts[tag] = (counts[tag] || 0) + 1;
                }
            }
        }
        return counts;
    }, [userSolvedSet, problems]);

    // Compute unsolved problems
    const unsolvedProblems = useMemo(() => {
        return problems.filter(p => !userSolvedSet.has(makeKey(p.contestId, p.index)));
    }, [problems, userSolvedSet]);

    const value: AppContextType = {
        handle,
        userInfo,
        problems,
        tagCounts,
        unsolvedProblems,
        userSolvedSet,
        attemptedUnsolvedProblems,
        loadingProblems,
        loadingUser,
        errorProblems,
        setHandleAndFetch,
        clearUser,
        fetchProblems,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
