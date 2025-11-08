// TagsDonut.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

const USER_HANDLE_KEY = "cf_user_handle_v1";
const CACHE_BASE = "cf_tags_cache_v1";
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours
const MAX_TAGS = 30;

function safeParse(s: string | null) {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
}

/* Problemset single-shot cache to avoid multiple downloads */
let _problemsetPromise: Promise<any[]> | null = null;
async function fetchProblemsetOnce(): Promise<any[]> {
    if (_problemsetPromise) return _problemsetPromise;
    _problemsetPromise = (async () => {
        const r = await fetch("https://codeforces.com/api/problemset.problems");
        if (!r.ok) throw new Error(`problemset.problems ${r.status}`);
        const j = await r.json();
        if (j?.status !== "OK" || !j.result || !Array.isArray(j.result.problems)) throw new Error("Bad problemset");
        return j.result.problems as any[];
    })();
    return _problemsetPromise;
}

/* Fetch user.status pages in chunks (handles >10k submissions safely) */
async function fetchAllUserStatus(handle: string): Promise<any[]> {
    const out: any[] = [];
    const CHUNK = 10000;
    let from = 1;
    while (true) {
        const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${CHUNK}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`user.status ${r.status}`);
        const j = await r.json();
        if (j?.status !== "OK" || !Array.isArray(j.result)) throw new Error("Bad user.status");
        if (!j.result.length) break;
        out.push(...j.result);
        if (j.result.length < CHUNK) break;
        from += CHUNK;
        await new Promise((res) => setTimeout(res, 60));
    }
    return out;
}

interface Props { handle?: string | null }

// Helper to load cache synchronously for initial state
function loadTagsFromCache(handle: string | null) {
    if (!handle) return null;
    try {
        const cacheKey = `${CACHE_BASE}_${handle}`;
        const raw = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
        if (raw) {
            const parsed = safeParse(raw);
            if (parsed && parsed.tagCounts && typeof parsed.otherCount === "number" && parsed.updatedAt && Date.now() - parsed.updatedAt < CACHE_TTL) {
                return parsed;
            }
        }
    } catch { }
    return null;
}

export default function TagsDonut({ handle: propHandle }: Props) {
    // Determine effective handle first
    const initialHandle = propHandle ?? (typeof window !== "undefined" ? localStorage.getItem(USER_HANDLE_KEY) : null);

    // Initialize state from cache immediately - no delay!
    const cachedData = useMemo(() => loadTagsFromCache(propHandle ?? initialHandle), [propHandle, initialHandle]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tagCounts, setTagCounts] = useState<Record<string, number>>(cachedData?.tagCounts || {});
    const [otherCount, setOtherCount] = useState(cachedData?.otherCount || 0);
    const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

    // Track which handle is currently loaded to prevent unnecessary reloads
    const loadedHandleRef = React.useRef<string | null>(cachedData ? (propHandle ?? initialHandle) : null);

    // Determine effective handle: prop overrides localStorage entry written by EnterHandle
    const [effectiveHandle, setEffectiveHandle] = useState<string | null>(() => {
        try {
            return propHandle ?? (typeof window !== "undefined" ? localStorage.getItem(USER_HANDLE_KEY) : null);
        } catch {
            return propHandle ?? null;
        }
    });

    useEffect(() => { if (propHandle) setEffectiveHandle(propHandle); }, [propHandle]);

    // watch localStorage changes (EnterHandle may set it)
    useEffect(() => {
        const onStorage = (ev: StorageEvent) => {
            if (ev.key === USER_HANDLE_KEY) setEffectiveHandle(ev.newValue);
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    // Update state when handle changes and cache is available
    useEffect(() => {
        const currentHandle = effectiveHandle ?? propHandle ?? null;
        if (!currentHandle) {
            setTagCounts({});
            setOtherCount(0);
            loadedHandleRef.current = null;
            return;
        }

        const cached = loadTagsFromCache(currentHandle);
        if (cached) {
            // Instantly load from cache
            setTagCounts(cached.tagCounts);
            setOtherCount(cached.otherCount || 0);
            loadedHandleRef.current = currentHandle; // Mark as loaded from cache
        }
    }, [effectiveHandle, propHandle]);

    const fetchData = useCallback(async (h: string | null) => {
        setError(null);
        if (!h) {
            setLoading(false);
            setTagCounts({});
            setOtherCount(0);
            return;
        }

        loadedHandleRef.current = h; // Mark as loading immediately to prevent duplicate calls
        const cacheKey = `${CACHE_BASE}_${h}`;

        // Check cache BEFORE setting loading state
        try {
            const raw = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
            if (raw) {
                const parsed = safeParse(raw);
                if (parsed && parsed.tagCounts && typeof parsed.otherCount === "number" && parsed.updatedAt && Date.now() - parsed.updatedAt < CACHE_TTL) {
                    // Load from cache instantly without showing loading state
                    setTagCounts(parsed.tagCounts);
                    setOtherCount(parsed.otherCount || 0);
                    return; // Exit early, don't fetch
                }
            }
        } catch {
            // If cache read fails, continue to fetch 
        }

        // Only set loading state if we need to fetch
        setLoading(true);
        setTagCounts({});
        setOtherCount(0);

        try {

            // fetch subs + problemset
            const [subs, problems] = await Promise.all([fetchAllUserStatus(h), fetchProblemsetOnce()]);

            // build problem map
            const problemMap = new Map<string, any>();
            for (const p of problems) {
                const k = `${p.contestId ?? 0}_${String(p.index ?? "")}`;
                problemMap.set(k, p);
            }

            // track the first OK submission per problem (so we can check submission.problem tags if needed)
            const firstOkMap = new Map<string, any>(); // key -> submission
            for (const s of subs) {
                if (!s || !s.problem) continue;
                if (s.verdict !== "OK") continue;
                const key = `${s.problem.contestId ?? 0}_${String(s.problem.index ?? "")}`;
                if (!firstOkMap.has(key)) firstOkMap.set(key, s);
            }

            // now iterate over unique solved problems and count tags, with fallback:
            // - prefer tags from problemset.problems (official tags)
            // - else, if submission.problem.tags present, use them
            // - else count into "Other"
            const counts: Record<string, number> = {};
            let other = 0;
            for (const [key, sub] of firstOkMap.entries()) {
                const p = problemMap.get(key);
                let tags: string[] = [];
                if (p && Array.isArray(p.tags) && p.tags.length) {
                    tags = p.tags.map((t: any) => String(t).trim()).filter(Boolean);
                } else {
                    // fallback: sometimes submission.problem includes tags (rare), so try that
                    const sp = sub && sub.problem;
                    if (sp && Array.isArray(sp.tags) && sp.tags.length) tags = sp.tags.map((t: any) => String(t).trim()).filter(Boolean);
                }

                if (tags.length) {
                    for (const t of tags) counts[t] = (counts[t] || 0) + 1;
                } else {
                    // problem exists but has no tags (or not in problemset) -> Other
                    other += 1;
                }
            }

            // persist
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ tagCounts: counts, otherCount: other, updatedAt: Date.now() }));
            } catch { /* ignore quota errors */ }

            setTagCounts(counts);
            setOtherCount(other);
        } catch (err: any) {
            setError(String(err?.message ?? err));
        } finally {
            setLoading(false);
        }
    }, []); // No dependencies - function is stable

    useEffect(() => {
        // if no prop handle and we don't have effectiveHandle, attempt read from localStorage (EnterHandle might have set it)
        if (!propHandle && !effectiveHandle) {
            try {
                const saved = localStorage.getItem(USER_HANDLE_KEY);
                if (saved) setEffectiveHandle(saved);
            } catch { /* noop */ }
        }

        const currentHandle = effectiveHandle ?? propHandle ?? null;
        // Only fetch if this handle hasn't been loaded yet in this session
        if (loadedHandleRef.current !== currentHandle) {
            void fetchData(currentHandle);
        }
    }, [effectiveHandle, propHandle, fetchData]);

    // entries sorted by count desc; include 'Other' as last if present
    const entries = useMemo(() => {
        const arr = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count }));
        arr.sort((a, b) => b.count - a.count);
        let top = arr.slice(0, MAX_TAGS);
        // if there are more tag buckets beyond MAX_TAGS, collapse remainder to "Other-tags"
        if (arr.length > MAX_TAGS) {
            const rest = arr.slice(MAX_TAGS);
            const restSum = rest.reduce((s, r) => s + r.count, 0);
            top = top.concat([{ tag: "Other-tags", count: restSum }]);
        }
        // finally append the truly uncategorized "Other" (no tags) if any
        if (otherCount > 0) {
            top = top.concat([{ tag: "Other", count: otherCount }]);
        }
        return top;
    }, [tagCounts, otherCount]);

    // total must be the sum of the right-side counts (so center equals legend)
    const total = useMemo(() => entries.reduce((s, e) => s + e.count, 0), [entries]);

    // svg geometry
    const size = 420;
    const outerR = 180;
    const innerR = 92;

    // Build arcs precisely and force last arc to end at start+360 to avoid seams caused by rounding
    const arcs = useMemo(() => {
        if (total <= 0 || entries.length === 0) return [];
        const arr: Array<{ tag: string; count: number; start: number; end: number; frac: number }> = [];
        let accDeg = 0;
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const frac = total ? e.count / total : 0;
            const deg = frac * 360;
            const start = -90 + accDeg;
            const end = (i === entries.length - 1) ? (-90 + 360) : (-90 + accDeg + deg);
            arr.push({ tag: e.tag, count: e.count, start, end, frac });
            accDeg += deg;
        }
        if (arr.length) arr[arr.length - 1].end = arr[0].start + 360;
        return arr;
    }, [entries, total]);

    function makePath(outer: number, inner: number, startDeg: number, endDeg: number) {
        const toRad = (d: number) => (d * Math.PI) / 180;
        const x1 = outer * Math.cos(toRad(startDeg));
        const y1 = outer * Math.sin(toRad(startDeg));
        const x2 = outer * Math.cos(toRad(endDeg));
        const y2 = outer * Math.sin(toRad(endDeg));
        const x3 = inner * Math.cos(toRad(endDeg));
        const y3 = inner * Math.sin(toRad(endDeg));
        const x4 = inner * Math.cos(toRad(startDeg));
        const y4 = inner * Math.sin(toRad(startDeg));
        const diff = endDeg - startDeg;
        const largeArc = Math.abs(diff) > 180 ? 1 : 0;
        return `M ${x1} ${y1} A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    }

    const colors = useMemo(() => entries.map((_, i) => {
        const hue = Math.round((i / Math.max(1, entries.length)) * 360);
        return `hsl(${hue} 72% 56%)`;
    }), [entries]);

    if (!effectiveHandle && !propHandle) {
        return (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
                Enter your handle to load tags.
            </div>
        );
    }

    return (
        <div className="w-full p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700">
            <div className="flex flex-col items-center mb-6">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-2">
                    Problem Tags Distribution
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Top {MAX_TAGS} most solved problem categories</p>
            </div>

            {loading && (
                <div className="text-center py-16">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading tags...</p>
                </div>
            )}

            {error && (
                <div className="text-center py-16">
                    <div className="text-red-600 dark:text-red-400 mb-2">⚠️</div>
                    <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
                </div>
            )}

            {!loading && !error && entries.length > 0 && (
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Donut Chart - Left side */}
                    <div className="w-full lg:w-1/2 flex items-center justify-center">
                        <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="drop-shadow-xl w-full max-w-[420px]" role="img" aria-label="tags donut">
                            <circle cx={0} cy={0} r={outerR} fill="#f5f7fb" className="dark:fill-slate-800/50" />
                            {arcs.map((a, i) => {
                                const path = makePath(outerR, innerR, a.start, a.end);
                                const fill = colors[i] ?? `hsl(${(i * 40) % 360} 72% 56%)`;
                                return (
                                    <path
                                        key={a.tag}
                                        d={path}
                                        fill={fill}
                                        stroke="none"
                                        onMouseMove={(ev) => setTip({ x: ev.clientX, y: ev.clientY, text: `${a.tag} : ${a.count} (${(a.frac * 100).toFixed(1)}%)` })}
                                        onMouseLeave={() => setTip(null)}
                                    />
                                );
                            })}
                            <circle cx={0} cy={0} r={innerR} fill="#ffffff" className="dark:fill-slate-900" />
                            {/* <text x={0} y={-6} textAnchor="middle" fontSize={18} fill="#0f172a" className="dark:fill-gray-200" fontWeight={700}>
                                {total}
                            </text> */}
                            {/* <text x={0} y={16} textAnchor="middle" fontSize={11} fill="#6b7280" className="dark:fill-gray-400">
                                validated solves
                            </text> */}
                        </svg>
                    </div>

                    {/* Legend Right */}
                    <div className="w-full lg:w-1/2 flex flex-col">
                        <div className="mb-4">
                            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Tags ({entries.length})</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Scroll to view all tags</p>
                        </div>

                        <div className="overflow-y-auto max-h-[420px] pr-2 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                            {entries.map((e, i) => {
                                const fill = colors[i];
                                const pct = total ? (e.count / total * 100).toFixed(1) : "0.0";
                                return (
                                    <div
                                        key={e.tag}
                                        className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-700 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 dark:border-slate-600 group cursor-pointer"
                                        onMouseMove={(ev) => setTip({ x: ev.clientX, y: ev.clientY, text: `${e.tag}: ${e.count} (${pct}%)` })}
                                        onMouseLeave={() => setTip(null)}
                                    >
                                        <div className="w-6 h-6 rounded-md flex-shrink-0" style={{ backgroundColor: fill }} />
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{e.tag}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-600 px-3 py-1 rounded-md min-w-[50px] text-center">{e.count}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {!loading && !error && entries.length === 0 && (
                <div className="text-center py-16 text-gray-600 dark:text-gray-400">No tags data available.</div>
            )}

            {tip && (
                <div style={{ position: "fixed", left: tip.x + 12, top: tip.y + 12, pointerEvents: "none", zIndex: 999 }}>
                    <div className="px-3 py-2 rounded-lg bg-gradient-to-r from-gray-900 to-black dark:from-slate-800 dark:to-slate-900 text-white text-sm font-medium shadow-lg border border-gray-700 dark:border-slate-600 whitespace-nowrap">
                        {tip.text}
                    </div>
                </div>
            )}
        </div>
    );
}
