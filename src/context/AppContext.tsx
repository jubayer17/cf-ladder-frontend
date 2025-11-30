"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    ReactNode,
} from "react";
import { Problem } from "@/types";

interface CFUserInfo {
    handle: string;
    rating: number;
    maxRating: number;
    rank: string;
    titlePhoto: string;
}

export interface AttemptInfo {
    key: string;
    contestId: number;
    index: string;
    name?: string;
    tags?: string[];
    attempts: number;
    lastVerdict?: string;
    lastTime?: number;
    link: string;
}

interface AppContextType {
    problems: Problem[];
    tagCounts: Record<string, number>;
    unsolvedProblems: Problem[];
    attemptedUnsolvedProblems: AttemptInfo[];
    handle: string | null;
    userInfo: CFUserInfo | null;
    userSolvedSet: Set<string>;
    loadingProblems: boolean;
    loadingUser: boolean;
    errorProblems: string | null;
    fetchProblems: () => Promise<void>;
    fetchAndMergeUserData: (handle: string) => Promise<void>;
    setHandleAndFetch: (handle: string) => Promise<void>;
    clearUser: () => void;

    solvedCountInProblems: number;
    attemptedCountInProblems: number;
    notTriedCount: number;
    solvingStreak: number;
}

// Contest definition
interface ContestInfo {
    id: number;
    name: string;
    phase: string;
    type: string;
    durationSeconds?: number;
    startTimeSeconds?: number;
}

const AppContext = createContext<AppContextType | null>(null);

// API Endpoints
const CF_PROBLEMSET = "https://codeforces.com/api/problemset.problems";
const CF_CONTESTS_LIST = "https://codeforces.com/api/contest.list";

// Helpers
const normalizeIndex = (idx: any) => String(idx ?? "").toUpperCase().trim();
export const makeKey = (contestId: number | string | undefined, index: any) =>
    `${String(contestId ?? "")}-${normalizeIndex(index)}`;

const flattenProblemsResponse = (data: any) => {
    if (!data) return [];
    if (data.result && Array.isArray(data.result.problems))
        return data.result.problems;
    return [];
};

const computeTagCounts = (list: Problem[]) => {
    const map: Record<string, number> = {};
    for (const p of list) for (const t of p.tags || []) map[t] = (map[t] || 0) + 1;
    return map;
};

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
    // State
    const [contests, setContests] = useState<ContestInfo[]>([]);
    const [loadingContests, setLoadingContests] = useState(false);
    const [errorContests, setErrorContests] = useState<string | null>(null);

    const [problems, setProblems] = useState<Problem[]>([]);
    const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
    const [loadingProblems, setLoadingProblems] = useState(false);
    const [errorProblems, setErrorProblems] = useState<string | null>(null);

    const [handle, setHandle] = useState<string | null>(
        typeof window !== "undefined"
            ? localStorage.getItem("cf_user_handle_v1")
            : null
    );

    const [userInfo, setUserInfo] = useState<CFUserInfo | null>(null);
    const [userSolvedSet, setUserSolvedSet] = useState<Set<string>>(new Set());
    const [attemptedUnsolvedProblems, setAttemptedUnsolvedProblems] =
        useState<AttemptInfo[]>([]);
    const [solvingStreak, setSolvingStreak] = useState(0);
    const [loadingUser, setLoadingUser] = useState(false);

    const fetchProblemsPromiseRef = useRef<Promise<void> | null>(null);

    // Fetch finished contests
    const fetchFinishedContests = async () => {
        setLoadingContests(true);
        try {
            const stored = localStorage.getItem("cf_finished_contests");
            if (stored) {
                setContests(JSON.parse(stored));
                setLoadingContests(false);
                return;
            }

            const res = await fetch(CF_CONTESTS_LIST);
            const data = await res.json();
            if (data.status !== "OK") throw new Error("Failed to fetch contests");

            const finished: ContestInfo[] = (data.result as ContestInfo[])
                .filter((c) => c.phase === "FINISHED")
                .map((c) => ({
                    id: c.id,
                    name: c.name,
                    phase: c.phase,
                    type: c.type,
                    durationSeconds: c.durationSeconds,
                    startTimeSeconds: c.startTimeSeconds,
                }));

            setContests(finished);
            localStorage.setItem("cf_finished_contests", JSON.stringify(finished));
        } catch (err) {
            console.error(err);
            setErrorContests("Failed to fetch finished contests");
        } finally {
            setLoadingContests(false);
        }
    };

    useEffect(() => {
        if (contests.length === 0) fetchFinishedContests();
    }, []);

    // Fetch problem set
    const fetchProblems = async () => {
        if (problems.length > 0) return;
        if (fetchProblemsPromiseRef.current) return fetchProblemsPromiseRef.current;

        const p = (async () => {
            setLoadingProblems(true);
            try {
                const stored = localStorage.getItem("cf_all_problems");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setProblems(parsed);
                    setTagCounts(computeTagCounts(parsed));
                    return;
                }

                const res = await fetch(CF_PROBLEMSET);
                const data = await res.json();
                const allProblems = flattenProblemsResponse(data);

                // attach global solvedCount
                const statsMap: Record<string, number> = {};
                if (data.result.problemStatistics) {
                    for (const stat of data.result.problemStatistics) {
                        statsMap[makeKey(stat.contestId, stat.index)] = stat.solvedCount;
                    }
                }

                const mergedProblems = allProblems.map((p: Problem) => ({
                    ...p,
                    solvedCount: statsMap[makeKey(p.contestId, p.index)] ?? 0,
                }));

                setProblems(mergedProblems);
                setTagCounts(computeTagCounts(mergedProblems));
                localStorage.setItem("cf_all_problems", JSON.stringify(mergedProblems));
            } catch (err) {
                console.error(err);
                setErrorProblems("Failed to fetch problems");
            } finally {
                setLoadingProblems(false);
            }
        })();

        fetchProblemsPromiseRef.current = p;
        await p;
        fetchProblemsPromiseRef.current = null;
    };

    // User data & submissions
    const fetchAllSubmissions = async (h: string) => {
        let from = 1,
            all: any[] = [];
        const count = 1000;
        while (true) {
            const url = `https://codeforces.com/api/user.status?handle=${h}&from=${from}&count=${count}`;
            const res = await fetch(url);
            const data = await res.json();
            if (!data.result?.length) break;
            all = all.concat(data.result);
            if (data.result.length < count) break;
            from += count;
        }
        return all;
    };

    const fetchAndMergeUserData = async (h: string) => {
        setLoadingUser(true);
        try {
            const [subs, infoRes] = await Promise.all([
                fetchAllSubmissions(h),
                fetch(`https://codeforces.com/api/user.info?handles=${h}`),
            ]);

            const info = (await infoRes.json())?.result?.[0];
            if (info) setUserInfo(info);

            const newSolved = new Set<string>();
            const attempted: Record<string, AttemptInfo> = {};
            const dailyCounts: Record<string, number> = {};

            for (const s of subs) {
                const p = s.problem || {};
                const contestId = Number(p.contestId);
                const idx = normalizeIndex(p.index);
                const key = makeKey(contestId, idx);
                const submissionTime = s.creationTimeSeconds || 0;

                if (s.verdict === "OK") {
                    newSolved.add(key);
                    const date = new Date(submissionTime * 1000).toISOString().split('T')[0];
                    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
                }

                if (!attempted[key])
                    attempted[key] = {
                        key,
                        contestId,
                        index: idx,
                        name: p.name,
                        tags: p.tags || [],
                        attempts: 0,
                        link: `https://codeforces.com/contest/${contestId}/problem/${idx}`,
                    };
                attempted[key].attempts++;
            }

            const attemptedUnsolved = Object.values(attempted).filter(
                (a) => !newSolved.has(a.key)
            );

            // Calculate solving streak
            const sortedDates = Object.keys(dailyCounts).filter(date => dailyCounts[date] > 0).sort().reverse();
            let streak = 0;
            if (sortedDates.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let currentDate = new Date(today);

                for (let i = 0; i < sortedDates.length; i++) {
                    const solveDate = new Date(sortedDates[i]);
                    solveDate.setHours(0, 0, 0, 0);

                    const diffTime = currentDate.getTime() - solveDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 0 || diffDays === 1) {
                        streak++;
                        currentDate = solveDate;
                    } else {
                        break;
                    }
                }
            }
            setSolvingStreak(streak);

            setUserSolvedSet(newSolved);
            setAttemptedUnsolvedProblems(attemptedUnsolved);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingUser(false);
        }
    };

    const setHandleAndFetch = async (h: string) => {
        setHandle(h);
        localStorage.setItem("cf_user_handle_v1", h);
        if (problems.length === 0) await fetchProblems();
        await fetchAndMergeUserData(h);
    };

    const clearUser = () => {
        setHandle(null);
        setUserInfo(null);
        setUserSolvedSet(new Set());
        setAttemptedUnsolvedProblems([]);
        setSolvingStreak(0);
        localStorage.removeItem("cf_user_handle_v1");
    };

    // Computed statistics
    const problemKeySet = useMemo(
        () => new Set(problems.map((p) => makeKey(p.contestId, p.index))),
        [problems]
    );

    const solvedCountInProblems = useMemo(() => {
        let c = 0;
        for (const k of problemKeySet) if (userSolvedSet.has(k)) c++;
        return c;
    }, [problemKeySet, userSolvedSet]);

    const attemptedCountInProblems = useMemo(() => {
        let c = 0;
        for (const a of attemptedUnsolvedProblems) if (problemKeySet.has(a.key)) c++;
        return c;
    }, [attemptedUnsolvedProblems, problemKeySet]);

    const notTriedCount = useMemo(
        () => Math.max(0, problemKeySet.size - solvedCountInProblems - attemptedCountInProblems),
        [problemKeySet, solvedCountInProblems, attemptedCountInProblems]
    );

    // Side effects
    useEffect(() => {
        if (problems.length === 0) fetchProblems();
    }, []);

    useEffect(() => {
        if (!handle) return;
        if (
            problems.length > 0 &&
            (userSolvedSet.size === 0 || attemptedUnsolvedProblems.length === 0)
        )
            setHandleAndFetch(handle);
    }, [handle, problems]);

    return (
        <AppContext.Provider
            value={{
                problems,
                tagCounts,
                unsolvedProblems: [],
                attemptedUnsolvedProblems,
                handle,
                userInfo,
                userSolvedSet,
                loadingProblems,
                loadingUser,
                errorProblems,
                fetchProblems,
                fetchAndMergeUserData,
                setHandleAndFetch,
                clearUser,
                solvedCountInProblems,
                attemptedCountInProblems,
                notTriedCount,
                solvingStreak,
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useAppContext must be used within AppContextProvider");
    return ctx;
};
