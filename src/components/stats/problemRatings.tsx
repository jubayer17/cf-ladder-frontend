"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

const CACHE_BASE = "cf_stats_cache_v2";
interface Props { handle: string | null }

function safeParse(s: string | null) { if (!s) return null; try { return JSON.parse(s); } catch { return null; } }
function nice(n: number) { return n.toLocaleString(); }
function clampBucket(r: number | undefined) { if (typeof r !== "number") return null; const b = Math.round(r / 100) * 100; if (b < 800) return 800; if (b > 3500) return 3500; return b; }
function colorForRating(r: number) {
    if (r < 1200) return "#9CA3AF";
    if (r < 1400) return "#16A34A";
    if (r < 1600) return "#06B6D4";
    if (r < 1900) return "#3B82F6";
    if (r < 2100) return "#8B5CF6";
    if (r < 2300) return "#F97316";
    if (r < 2400) return "#EF4444";
    return "#9F1239";
}

/* fetch helpers (unchanged) */
async function fetchAllUserStatus(handle: string) {
    const ACC: any[] = [];
    const CHUNK = 10000;
    let from = 1;
    while (true) {
        const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${CHUNK}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`user.status ${r.status}`);
        const j = await r.json();
        if (j?.status !== "OK" || !Array.isArray(j.result)) throw new Error("Bad user.status");
        if (!j.result.length) break;
        ACC.push(...j.result);
        if (j.result.length < CHUNK) break;
        from += CHUNK;
        await new Promise((res) => setTimeout(res, 120));
    }
    return ACC;
}

async function fetchProblemset() {
    const r = await fetch("https://codeforces.com/api/problemset.problems");
    if (!r.ok) throw new Error(`problemset.problems ${r.status}`);
    const j = await r.json();
    if (j?.status !== "OK" || !j.result || !Array.isArray(j.result.problems)) throw new Error("Bad problemset");
    return j.result.problems as any[];
}

async function fetchUserRating(handle: string) {
    const url = `https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    if (j?.status !== "OK" || !Array.isArray(j.result)) return [];
    return j.result as any[];
}

// Helper to load cache synchronously for initial state
function loadFromCache(handle: string | null) {
    if (!handle) return null;
    try {
        const cacheKey = `${CACHE_BASE}_${handle}`;
        const raw = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
        if (raw) {
            const parsed = safeParse(raw);
            if (parsed && parsed.updatedAt && Date.now() - parsed.updatedAt < 1000 * 60 * 60 * 6) {
                return parsed;
            }
        }
    } catch { }
    return null;
}

export default function ProblemRatings({ handle }: Props) {
    // Initialize state from cache immediately - no delay!
    const cachedData = useMemo(() => loadFromCache(handle), [handle]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [ratingCounts, setRatingCounts] = useState<Record<number, number>>(cachedData?.ratingCounts || {});
    const [totalSolved, setTotalSolved] = useState(cachedData?.totalSolved || 0);
    const [totalTried, setTotalTried] = useState(cachedData?.totalTried || 0);
    const [totalWithRating, setTotalWithRating] = useState(cachedData?.totalWithRating || 0);
    const [maxSolvedRating, setMaxSolvedRating] = useState<number | null>(cachedData?.maxSolvedRating ?? null);

    const [avgAttempts, setAvgAttempts] = useState(cachedData?.avgAttempts ?? 0);
    const [maxAttempts, setMaxAttempts] = useState<{ key: string; attempts: number; name?: string } | null>(cachedData?.maxAttempts ?? null);
    const [solvedWithOne, setSolvedWithOne] = useState(cachedData?.solvedWithOne ?? 0);
    const [solvedWithOnePct, setSolvedWithOnePct] = useState(cachedData?.solvedWithOnePct ?? 0);
    const [maxACs, setMaxACs] = useState<{ key: string; acs: number; name?: string } | null>(cachedData?.maxACs ?? null);

    const [contestCount, setContestCount] = useState(cachedData?.contestCount ?? 0);
    const [bestRank, setBestRank] = useState<{ rank: number; contestId?: number; contestName?: string } | null>(cachedData?.bestRank ?? null);
    const [worstRank, setWorstRank] = useState<{ rank: number; contestId?: number; contestName?: string } | null>(cachedData?.worstRank ?? null);
    const [maxUp, setMaxUp] = useState<{ diff: number; contestId?: number; contestName?: string } | null>(cachedData?.maxUp ?? null);
    const [maxDown, setMaxDown] = useState<{ diff: number; contestId?: number; contestName?: string } | null>(cachedData?.maxDown ?? null);

    const [validatedSolved, setValidatedSolved] = useState(cachedData?.validatedSolved ?? 0);
    const [unvalidatedSolved, setUnvalidatedSolved] = useState(cachedData?.unvalidatedSolved ?? 0);

    const [firstSolvedAt, setFirstSolvedAt] = useState<number | null>(cachedData?.firstSolvedAt ?? null);
    const [lastSolvedAt, setLastSolvedAt] = useState<number | null>(cachedData?.lastSolvedAt ?? null);

    const [tooltip, setTooltip] = useState<{ x: number; y: number; rating: number; count: number } | null>(null);

    // Track which handle is currently loaded to prevent unnecessary reloads
    const loadedHandleRef = React.useRef<string | null>(cachedData ? handle : null);

    // Update all state when handle changes and cache is available
    useEffect(() => {
        if (!handle) {
            // Clear data when handle is removed
            setRatingCounts({});
            setTotalSolved(0);
            setTotalTried(0);
            setTotalWithRating(0);
            setMaxSolvedRating(null);
            setAvgAttempts(0);
            setMaxAttempts(null);
            setSolvedWithOne(0);
            setSolvedWithOnePct(0);
            setMaxACs(null);
            setContestCount(0);
            setBestRank(null);
            setWorstRank(null);
            setMaxUp(null);
            setMaxDown(null);
            setValidatedSolved(0);
            setUnvalidatedSolved(0);
            setFirstSolvedAt(null);
            setLastSolvedAt(null);
            loadedHandleRef.current = null;
            return;
        }

        const cached = loadFromCache(handle);
        if (cached) {
            // Instantly load all data from cache
            setRatingCounts(cached.ratingCounts || {});
            setTotalSolved(cached.totalSolved || 0);
            setTotalTried(cached.totalTried || 0);
            setTotalWithRating(cached.totalWithRating || 0);
            setMaxSolvedRating(cached.maxSolvedRating ?? null);
            setAvgAttempts(cached.avgAttempts ?? 0);
            setMaxAttempts(cached.maxAttempts ?? null);
            setSolvedWithOne(cached.solvedWithOne ?? 0);
            setSolvedWithOnePct(cached.solvedWithOnePct ?? 0);
            setMaxACs(cached.maxACs ?? null);
            setContestCount(cached.contestCount ?? 0);
            setBestRank(cached.bestRank ?? null);
            setWorstRank(cached.worstRank ?? null);
            setMaxUp(cached.maxUp ?? null);
            setMaxDown(cached.maxDown ?? null);
            setValidatedSolved(cached.validatedSolved ?? 0);
            setUnvalidatedSolved(cached.unvalidatedSolved ?? 0);
            setFirstSolvedAt(cached.firstSolvedAt ?? null);
            setLastSolvedAt(cached.lastSolvedAt ?? null);
            loadedHandleRef.current = handle; // Mark as loaded from cache
        }
    }, [handle]);

    const compute = useCallback(async (h: string) => {
        setError(null);
        loadedHandleRef.current = h; // Mark as loading immediately to prevent duplicate calls

        const cacheKey = `${CACHE_BASE}_${h}`;

        // Check cache BEFORE setting loading state
        try {
            const raw = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
            if (raw) {
                const parsed = safeParse(raw);
                if (parsed && parsed.updatedAt && Date.now() - parsed.updatedAt < 1000 * 60 * 60 * 6) {
                    // Load from cache instantly without showing loading state
                    setRatingCounts(parsed.ratingCounts || {});
                    setTotalSolved(parsed.totalSolved || 0);
                    setTotalTried(parsed.totalTried || 0);
                    setTotalWithRating(parsed.totalWithRating || 0);
                    setMaxSolvedRating(parsed.maxSolvedRating ?? null);

                    setAvgAttempts(parsed.avgAttempts ?? 0);
                    setMaxAttempts(parsed.maxAttempts ?? null);
                    setSolvedWithOne(parsed.solvedWithOne ?? 0);
                    setSolvedWithOnePct(parsed.solvedWithOnePct ?? 0);
                    setMaxACs(parsed.maxACs ?? null);

                    setContestCount(parsed.contestCount ?? 0);
                    setBestRank(parsed.bestRank ?? null);
                    setWorstRank(parsed.worstRank ?? null);
                    setMaxUp(parsed.maxUp ?? null);
                    setMaxDown(parsed.maxDown ?? null);

                    setValidatedSolved(parsed.validatedSolved ?? 0);
                    setUnvalidatedSolved(parsed.unvalidatedSolved ?? 0);

                    setFirstSolvedAt(parsed.firstSolvedAt ?? null);
                    setLastSolvedAt(parsed.lastSolvedAt ?? null);

                    return; // Exit early, don't fetch
                }
            }
        } catch (e) {
            // If cache read fails, continue to fetch
        }

        // Only set loading state if we need to fetch
        setLoading(true);
        try {

            const [subsRaw, problemsList, ratingList] = await Promise.all([
                fetchAllUserStatus(h),
                fetchProblemset(),
                fetchUserRating(h),
            ]);

            const problemMap = new Map<string, any>();
            for (const p of problemsList) problemMap.set(`${p.contestId ?? 0}_${String(p.index ?? "")}`, p);

            const subs = subsRaw.slice().sort((a, b) => Number(a.creationTimeSeconds || 0) - Number(b.creationTimeSeconds || 0));

            type PRec = { totalAttempts: number; attemptsUntilFirstAC: number | null; acCount: number; firstAcTime?: number; name?: string };
            const map = new Map<string, PRec>();

            let firstTs: number | null = null;
            let lastTs: number | null = null;

            for (const s of subs) {
                if (!s || !s.problem) continue;
                const key = `${s.problem.contestId ?? 0}_${String(s.problem.index ?? "")}`;
                const cur = map.get(key) || { totalAttempts: 0, attemptsUntilFirstAC: null, acCount: 0, firstAcTime: undefined, name: s.problem.name };
                cur.totalAttempts += 1;
                cur.name = cur.name || s.problem.name;
                if (s.verdict === "OK") {
                    cur.acCount += 1;
                    if (cur.attemptsUntilFirstAC === null) {
                        cur.attemptsUntilFirstAC = cur.totalAttempts;
                        if (s.creationTimeSeconds) cur.firstAcTime = Number(s.creationTimeSeconds) * 1000;
                        if (!firstTs || (cur.firstAcTime && cur.firstAcTime < firstTs)) firstTs = cur.firstAcTime ?? firstTs;
                        if (!lastTs || (cur.firstAcTime && cur.firstAcTime > lastTs)) lastTs = cur.firstAcTime ?? lastTs;
                    }
                }
                map.set(key, cur);
            }

            let tried = map.size;
            let solved = 0;
            let sumAttempts = 0;
            let solvedOne = 0;
            let localMaxAttempts: { key: string; attempts: number; name?: string } | null = null;
            let localMaxACs: { key: string; acs: number; name?: string } | null = null;
            let validated = 0;
            let unvalidated = 0;

            const buckets: Record<number, number> = {};
            let localMaxRatingSolved = 0;
            let totalRated = 0;

            for (const [key, rec] of map.entries()) {
                if (rec.attemptsUntilFirstAC !== null) {
                    solved += 1;
                    sumAttempts += rec.attemptsUntilFirstAC;
                    if (rec.attemptsUntilFirstAC === 1) solvedOne += 1;
                }
                if (rec.acCount > 0) {
                    if (!localMaxACs || rec.acCount > localMaxACs.acs) localMaxACs = { key, acs: rec.acCount, name: rec.name };
                }
                if (rec.attemptsUntilFirstAC !== null) {
                    if (!localMaxAttempts || rec.attemptsUntilFirstAC > localMaxAttempts.attempts) localMaxAttempts = { key, attempts: rec.attemptsUntilFirstAC, name: rec.name };
                }

                if (problemMap.has(key)) {
                    if (rec.attemptsUntilFirstAC !== null) validated += 1;
                    const p = problemMap.get(key);
                    const rating = p?.rating;
                    if (rec.attemptsUntilFirstAC !== null && typeof rating === "number") {
                        const bucket = clampBucket(rating);
                        if (bucket !== null) {
                            buckets[bucket] = (buckets[bucket] || 0) + 1;
                            totalRated += 1;
                            if (bucket > localMaxRatingSolved) localMaxRatingSolved = bucket;
                        }
                    }
                } else {
                    if (rec.attemptsUntilFirstAC !== null) unvalidated += 1;
                }
            }

            const avg = solved > 0 ? Math.round((sumAttempts / solved) * 100) / 100 : 0;
            const solvedOnePctCalc = solved > 0 ? Math.round((solvedOne / solved) * 10000) / 100 : 0;

            // contest metrics
            const contests = ratingList || [];
            let best = null as any;
            let worst = null as any;
            let cMaxUp = null as any;
            let cMaxDown = null as any;
            for (const c of contests) {
                const rnk = Number(c.rank ?? Infinity);
                if (isFinite(rnk)) {
                    if (!best || rnk < best.rank) best = { rank: rnk, contestId: c.contestId, contestName: c.contestName };
                    if (!worst || rnk > worst.rank) worst = { rank: rnk, contestId: c.contestId, contestName: c.contestName };
                }
                const diff = Number(c.newRating ?? 0) - Number(c.oldRating ?? 0);
                if (!cMaxUp || diff > cMaxUp.diff) cMaxUp = { diff, contestId: c.contestId, contestName: c.contestName };
                if (!cMaxDown || diff < cMaxDown.diff) cMaxDown = { diff, contestId: c.contestId, contestName: c.contestName };
            }

            setTotalTried(tried);
            setTotalSolved(solved);
            setAvgAttempts(avg);
            setMaxAttempts(localMaxAttempts);
            setSolvedWithOne(solvedOne);
            setSolvedWithOnePct(solvedOnePctCalc);
            setMaxACs(localMaxACs);

            setValidatedSolved(validated);
            setUnvalidatedSolved(unvalidated);

            setRatingCounts(buckets);
            setTotalWithRating(totalRated);
            setMaxSolvedRating(localMaxRatingSolved || null);

            setContestCount(contests.length);
            setBestRank(best);
            setWorstRank(worst);
            setMaxUp(cMaxUp);
            setMaxDown(cMaxDown);

            setFirstSolvedAt(firstTs);
            setLastSolvedAt(lastTs);

            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    ratingCounts: buckets,
                    totalSolved: solved,
                    totalTried: tried,
                    totalWithRating: totalRated,
                    maxSolvedRating: localMaxRatingSolved || null,
                    avgAttempts: avg,
                    maxAttempts: localMaxAttempts,
                    solvedWithOne: solvedOne,
                    solvedWithOnePct: solvedOnePctCalc,
                    maxACs: localMaxACs,
                    contestCount: contests.length,
                    bestRank: best,
                    worstRank: worst,
                    maxUp: cMaxUp,
                    maxDown: cMaxDown,
                    validatedSolved: validated,
                    unvalidatedSolved: unvalidated,
                    firstSolvedAt: firstTs,
                    lastSolvedAt: lastTs,
                    updatedAt: Date.now(),
                }));
            } catch { /* ignore */ }

        } catch (err: any) {
            setError(String(err?.message ?? err));
        } finally {
            setLoading(false);
        }
    }, []); // No dependencies - function is stable

    useEffect(() => {
        if (!handle) return;
        // Only compute if this handle hasn't been loaded yet in this session
        if (loadedHandleRef.current !== handle) {
            void compute(handle);
        }
    }, [handle, compute]);

    /* RESPONSIVE sizing: read container width and adapt bar width so entire bucket set fits */
    const [parentWidth, setParentWidth] = useState<number | null>(1200);
    useEffect(() => {
        const setW = () => setParentWidth(Math.max(760, Math.min(window.innerWidth - 120, 1400)));
        setW();
        window.addEventListener("resize", setW);
        return () => window.removeEventListener("resize", setW);
    }, []);

    const visibleBuckets = useMemo(() => {
        const maxB = typeof maxSolvedRating === "number" && maxSolvedRating >= 800 ? maxSolvedRating : 1200;
        const arr: number[] = [];
        for (let r = 800; r <= Math.max(maxB, 1200); r += 100) arr.push(r);
        return arr;
    }, [maxSolvedRating]);

    const leftPad = 60;
    const rightPad = 60;
    const gutter = 6;
    // compute perBucket to fit into parentWidth (but keep a minimum bar width)
    const computed = useMemo(() => {
        const n = visibleBuckets.length || 1;
        const maxCanvas = parentWidth ?? 1200;
        const available = Math.max(600, maxCanvas - leftPad - rightPad);
        const perBucket = Math.max(10, Math.floor((available - (n - 1) * gutter) / n));
        const chartBaseWidth = leftPad + rightPad + perBucket * n + gutter * (n - 1);
        const rotateLabels = n > 20; // rotate if too many buckets
        return { perBucket, chartBaseWidth, rotateLabels, n, available };
    }, [visibleBuckets, parentWidth]);

    const barWidth = computed.perBucket;
    const chartBaseWidth = computed.chartBaseWidth;
    const chartHeight = 400;

    const entries = useMemo(() => visibleBuckets.map((b) => ({ rating: b, count: ratingCounts[b] || 0 })), [visibleBuckets, ratingCounts]);
    const maxCountVisible = useMemo(() => Math.max(1, ...entries.map((e) => e.count)), [entries]);

    const fmtDate = (ts: number | null) => (ts ? new Date(ts).toLocaleString() : "—");

    return (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700">
            <div className="flex flex-col items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">
                    Problem Ratings Distribution
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your Codeforces problem-solving journey</p>
            </div>

            {loading && (
                <div className="text-center py-16">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading statistics...</div>
                </div>
            )}

            {error && (
                <div className="text-center py-16">
                    <div className="text-red-600 dark:text-red-400 mb-2">⚠️</div>
                    <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="flex justify-center mb-6">
                        <div className="overflow-x-auto w-full max-w-full">
                            <div className="flex justify-center">
                                <svg width={chartBaseWidth} height={chartHeight} className="drop-shadow-lg">
                                    <defs>
                                        <linearGradient id="chartBgLight" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#f8fafc" />
                                            <stop offset="100%" stopColor="#ffffff" />
                                        </linearGradient>
                                        <linearGradient id="chartBgDark" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#1e293b" />
                                            <stop offset="100%" stopColor="#0f172a" />
                                        </linearGradient>
                                        <filter id="barShadow" x="-50%" y="-50%" width="200%" height="200%">
                                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
                                        </filter>
                                    </defs>

                                    {/* Background rect - light mode */}
                                    <rect x={0} y={0} width={chartBaseWidth} height={chartHeight} rx={12} fill="url(#chartBgLight)" stroke="#cbd5e1" strokeWidth={1} className="dark:hidden" />
                                    {/* Background rect - dark mode */}
                                    <rect x={0} y={0} width={chartBaseWidth} height={chartHeight} rx={12} fill="url(#chartBgDark)" stroke="#334155" strokeWidth={1} className="hidden dark:block" />

                                    {/* Y grid lines */}
                                    {Array.from({ length: 5 }).map((_, i) => {
                                        const barMaxH = chartHeight - 110;
                                        const y = (chartHeight - 55) - (i * barMaxH / 4);
                                        const label = Math.round((i / 4) * maxCountVisible);
                                        return (
                                            <g key={i}>
                                                {/* Grid line - light mode */}
                                                <line x1={leftPad} y1={y} x2={chartBaseWidth - rightPad} y2={y} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="5,5" className="dark:hidden" />
                                                {/* Grid line - dark mode */}
                                                <line x1={leftPad} y1={y} x2={chartBaseWidth - rightPad} y2={y} stroke="#475569" strokeWidth={1} strokeDasharray="5,5" className="hidden dark:block" />
                                                {/* Label - light mode */}
                                                <text x={leftPad - 12} y={y + 4} fontSize={13} fill="#1e293b" textAnchor="end" fontWeight="600" className="dark:hidden">{label}</text>
                                                {/* Label - dark mode */}
                                                <text x={leftPad - 12} y={y + 4} fontSize={13} fill="#e2e8f0" textAnchor="end" fontWeight="600" className="hidden dark:block">{label}</text>
                                            </g>
                                        );
                                    })}

                                    {/* Bars */}
                                    {entries.map((e, i) => {
                                        const x = leftPad + i * (barWidth + gutter);
                                        const barMaxH = chartHeight - 110;
                                        const h = Math.round((e.count / maxCountVisible) * barMaxH);
                                        const y = chartHeight - 55 - h;
                                        const color = colorForRating(e.rating);
                                        const opacity = e.count > 0 ? 1 : 0.3;

                                        return (
                                            <g key={e.rating} transform={`translate(${x},0)`}>
                                                {/* Baseline - light mode */}
                                                <rect x={0} y={chartHeight - 55} width={barWidth} height={2} rx={1} fill="#94a3b8" className="dark:hidden" />
                                                {/* Baseline - dark mode */}
                                                <rect x={0} y={chartHeight - 55} width={barWidth} height={2} rx={1} fill="#475569" className="hidden dark:block" />
                                                <rect
                                                    x={0}
                                                    y={y}
                                                    width={barWidth}
                                                    height={h}
                                                    rx={4}
                                                    fill={color}
                                                    opacity={opacity}
                                                    filter={e.count > 0 ? "url(#barShadow)" : undefined}
                                                    style={{
                                                        transition: "all 0.3s ease",
                                                        transformOrigin: "bottom",
                                                        cursor: e.count > 0 ? "pointer" : "default",
                                                    }}
                                                    className="hover:opacity-90"
                                                    onMouseMove={(ev) => {
                                                        if (e.count > 0) {
                                                            setTooltip({ x: ev.clientX, y: ev.clientY, rating: e.rating, count: e.count });
                                                        }
                                                    }}
                                                    onMouseLeave={() => setTooltip(null)}
                                                />
                                                {/* Rating label - light mode */}
                                                <text x={barWidth / 2} y={chartHeight - 28} textAnchor="middle" fontSize={computed.rotateLabels ? 11 : 12} fill="#0f172a" fontWeight="700" className="dark:hidden"
                                                    transform={computed.rotateLabels ? `rotate(-45 ${barWidth / 2} ${chartHeight - 28})` : undefined}
                                                >
                                                    {e.rating}
                                                </text>
                                                {/* Rating label - dark mode */}
                                                <text x={barWidth / 2} y={chartHeight - 28} textAnchor="middle" fontSize={computed.rotateLabels ? 11 : 12} fill="#f1f5f9" fontWeight="700" className="hidden dark:block"
                                                    transform={computed.rotateLabels ? `rotate(-45 ${barWidth / 2} ${chartHeight - 28})` : undefined}
                                                >
                                                    {e.rating}
                                                </text>
                                                {e.count > 0 && (
                                                    <>
                                                        {/* Count label - light mode */}
                                                        <text x={barWidth / 2} y={y - 10} textAnchor="middle" fontSize={13} fill="#0f172a" fontWeight="700" className="dark:hidden">{e.count}</text>
                                                        {/* Count label - dark mode */}
                                                        <text x={barWidth / 2} y={y - 10} textAnchor="middle" fontSize={13} fill="#ffffff" fontWeight="700" className="hidden dark:block">{e.count}</text>
                                                    </>
                                                )}
                                            </g>
                                        );
                                    })}

                                    {/* axis labels - light mode */}
                                    <text x={leftPad} y={chartHeight - 8} fontSize={14} fill="#0f172a" fontWeight="700" className="dark:hidden">Rating →</text>
                                    <text x={16} y={36} fontSize={14} fill="#0f172a" fontWeight="700" className="dark:hidden">Count ↑</text>
                                    {/* axis labels - dark mode */}
                                    <text x={leftPad} y={chartHeight - 8} fontSize={14} fill="#f1f5f9" fontWeight="700" className="hidden dark:block">Rating →</text>
                                    <text x={16} y={36} fontSize={14} fill="#f1f5f9" fontWeight="700" className="hidden dark:block">Count ↑</text>
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Two stat cards side-by-side (responsive) */}
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-6 bg-gray-50 dark:bg-slate-800 shadow-lg">
                            <h4 className="text-xl font-bold mb-4 text-blue-900 dark:text-blue-300 flex items-center gap-2">
                                <span className="text-2xl">📊</span>
                                Solve Metrics
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tried</span>
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">{nice(totalTried)}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Solved</span>
                                    <span className="text-lg font-bold text-green-600 dark:text-green-400">{nice(totalSolved)}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Validated / Others</span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{nice(validatedSolved)} / {nice(unvalidatedSolved)}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Average attempts</span>
                                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{avgAttempts}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Max attempts</span>
                                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{maxAttempts?.attempts ?? "—"}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">One-shot solves</span>
                                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{nice(solvedWithOne)} ({solvedWithOnePct}%)</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Max AC(s) on problem</span>
                                    <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{maxACs?.acs ?? "—"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-6 bg-gray-50 dark:bg-slate-800 shadow-lg">
                            <h4 className="text-xl font-bold mb-4 text-purple-900 dark:text-purple-300 flex items-center gap-2">
                                <span className="text-2xl">🏆</span>
                                Contest Metrics
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Contests</span>
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">{contestCount}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Best rank</span>
                                    <span className="text-lg font-bold text-green-600 dark:text-green-400">{bestRank?.rank ?? "—"}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Worst rank</span>
                                    <span className="text-lg font-bold text-red-600 dark:text-red-400">{worstRank?.rank ?? "—"}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Max up</span>
                                    <span className="text-lg font-bold text-green-600 dark:text-green-400">{maxUp?.diff ? `+${maxUp.diff}` : (maxUp?.diff === 0 ? "0" : "—")}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Max down</span>
                                    <span className="text-lg font-bold text-red-600 dark:text-red-400">{maxDown?.diff ?? "—"}</span>
                                </div>
                                <div className="flex flex-col gap-1 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Activity Period</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">First: {fmtDate(firstSolvedAt)}</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Latest: {fmtDate(lastSolvedAt)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Tooltip */}
            {tooltip && (
                <div
                    style={{
                        position: "fixed",
                        left: tooltip.x + 12,
                        top: tooltip.y + 12,
                        pointerEvents: "none",
                        zIndex: 999
                    }}
                >
                    <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-gray-900 to-black dark:from-slate-700 dark:to-slate-800 text-white text-sm font-medium shadow-xl border border-gray-700 dark:border-slate-600 whitespace-nowrap">
                        <div className="font-bold text-base">Rating: {tooltip.rating}</div>
                        <div className="text-gray-300 dark:text-gray-300">Problems Solved: {tooltip.count}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
