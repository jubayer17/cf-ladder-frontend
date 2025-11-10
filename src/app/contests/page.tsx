// app/contests/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Spinner from "@/components/contests/Spinner";
import ContestRow from "@/components/contests/ContestRow";
import { useAppContext } from "@/context/AppContext";
import type { ProblemInfo } from "@/components/contests/ProblemBox";
import type { ContestInfo as CI } from "@/components/contests/ContestNameCell";

/* CONFIG */
const BACKEND_API = "https://cf-ladder-backend.vercel.app";
const BACKEND_CONTESTS_BY_CATEGORY = `${BACKEND_API}/api/contests/by-category`;
const BACKEND_CONTEST_BY_ID = (id: number) => `${BACKEND_API}/api/contests/${id}`;
const BACKEND_SYNC_CONTESTS = `${BACKEND_API}/api/contests/sync`;

const CONTESTS_KEY = "cf_finished_contests_vX"; // global durable list
const CONTESTS_KEY_TS = "cf_finished_contests_vX_ts";
const CONTESTS_KEY_SECTION_PREFIX = `${CONTESTS_KEY}_section_`; // per-section durable cache
const PROBLEM_KEY_PREFIX = "cf_contest_problems_";
const HARD_RELOAD_JOB_KEY_PREFIX = "HARD_RELOAD_JOB_SECTION_";

/* IndexedDB config */
const DB_NAME = "cf_db_sectioned_v1";
const STORE_PROBLEMS = "problems";
const STORE_META = "meta";

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 250;
const DEFAULT_CONCURRENCY = 6;
const PAGE_SIZE = 15;
const PREFETCH_CHUNK = 12;

const SLEEP = (ms = BASE_BACKOFF_MS) => new Promise((r) => setTimeout(r, ms));

type ContestInfo = CI;
type HardReloadJob = { status: "running" | "stopped" | "completed"; contestIds: number[]; completed: number; startedAt: number };

const safeParse = (s: string | null) => {
    if (!s) return null;
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
};

/* small helpers */
function isOfficialContest(raw: any): boolean {
    if (!raw) return false;
    const type = String(raw.type ?? "").toLowerCase();
    const name = String(raw.name ?? "");
    if (type === "gym") return false;
    if (/\bgym\b/i.test(name)) return false;
    if (/training/i.test(name)) return false;
    if (/acmsguru/i.test(name)) return false;
    if (/технокубок/i.test(name)) return false; // excluded per request
    return true;
}

function determineCategory(raw: any): string {
    if (!raw) return "Other";
    if (raw.category) return String(raw.category);
    const name = String(raw.name ?? "");
    const has1 = /Div\.?\s*1\b/i.test(name);
    const has2 = /Div\.?\s*2\b/i.test(name);
    if (has1 && has2) return "Div 1+2";
    if (has1) return "Div. 1";
    if (has2) return "Div. 2";
    if (/Div\.?\s*3\b/i.test(name)) return "Div. 3";
    if (/Div\.?\s*4\b/i.test(name)) return "Div. 4";
    if (/Educational/i.test(name)) return "Educational";
    if (/Global/i.test(name)) return "Global";
    return raw.type ?? "Other";
}

const normalizeAndFilter = (arr: any[]): ContestInfo[] =>
    (arr || [])
        .filter((c: any) => c && String(c.phase) === "FINISHED" && isOfficialContest(c))
        .map((c: any) => {
            const obj: any = {
                id: Number(c.id),
                name: String(c.name ?? "Unknown"),
                phase: c.phase,
                type: c.type,
                durationSeconds: typeof c.durationSeconds === "number" ? c.durationSeconds : undefined,
                startTimeSeconds: typeof c.startTimeSeconds === "number" ? c.startTimeSeconds : undefined,
            };
            obj.category = determineCategory(c);
            return obj as ContestInfo;
        });

/* IDB helpers */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_PROBLEMS)) db.createObjectStore(STORE_PROBLEMS);
            if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveProblemsDB(contestId: number, problems: ProblemInfo[]) {
    const db = await openDB();
    return new Promise<void>((res, rej) => {
        try {
            const tx = db.transaction(STORE_PROBLEMS, "readwrite");
            const store = tx.objectStore(STORE_PROBLEMS);
            const r = store.put(problems, String(contestId));
            r.onsuccess = () => res();
            r.onerror = () => rej(r.error);
        } catch (e) {
            rej(e);
        }
    });
}

async function loadProblemsDB(contestId: number): Promise<ProblemInfo[] | null> {
    const db = await openDB();
    return new Promise((res, rej) => {
        try {
            const tx = db.transaction(STORE_PROBLEMS, "readonly");
            const store = tx.objectStore(STORE_PROBLEMS);
            const r = store.get(String(contestId));
            r.onsuccess = () => {
                const val = r.result;
                res(Array.isArray(val) ? (val as ProblemInfo[]) : null);
            };
            r.onerror = () => rej(r.error);
        } catch (e) {
            rej(e);
        }
    });
}

async function saveSnapshotToDB(sectionKey: string, contests: ContestInfo[], problemsMap: Record<number, ProblemInfo[]>) {
    const db = await openDB();
    return new Promise<void>((res, rej) => {
        try {
            const tx = db.transaction(STORE_META, "readwrite");
            const store = tx.objectStore(STORE_META);
            const r = store.put({ contests, problemsMap }, `snapshot_${sectionKey}`);
            r.onsuccess = () => res();
            r.onerror = () => rej(r.error);
        } catch (e) {
            rej(e);
        }
    });
}

async function loadSnapshotFromDB(sectionKey: string): Promise<{ contests: ContestInfo[]; problemsMap: Record<number, ProblemInfo[]> } | null> {
    const db = await openDB();
    return new Promise((res, rej) => {
        try {
            const tx = db.transaction(STORE_META, "readonly");
            const store = tx.objectStore(STORE_META);
            const r = store.get(`snapshot_${sectionKey}`);
            r.onsuccess = () => {
                const val = r.result;
                if (!val) return res(null);
                res({ contests: val.contests || [], problemsMap: val.problemsMap || {} });
            };
            r.onerror = () => rej(r.error);
        } catch (e) {
            rej(e);
        }
    });
}

/* cache-first network helper */
async function fetchWithCacheJson(url: string) {
    if (typeof window === "undefined" || !("caches" in window)) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Fetch ${r.status}`);
        return r.json();
    }
    const cacheName = "cf-api-cache-sectioned";
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url);
    if (cached) {
        try {
            return await cached.clone().json();
        } catch { }
    }
    const res = await fetch(url);
    if (res.ok) {
        try {
            cache.put(url, res.clone());
        } catch { }
        return await res.json();
    }
    if (cached) return await cached.clone().json();
    throw new Error(`Network failed ${res.status}`);
}

/* Force fresh fetch, bypassing cache - for update operations */
async function fetchFreshJson(url: string) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Fetch ${res.status}`);
    const data = await res.json();

    // Update the cache with fresh data
    if (typeof window !== "undefined" && "caches" in window) {
        try {
            const cacheName = "cf-api-cache-sectioned";
            const cache = await caches.open(cacheName);
            cache.put(url, new Response(JSON.stringify(data)));
        } catch { }
    }

    return data;
}

/* concurrency helper */
async function mapWithConcurrency<T, R>(items: T[], worker: (item: T, i: number) => Promise<R>, concurrency = DEFAULT_CONCURRENCY) {
    let idx = 0;
    const results: R[] = new Array(items.length);
    const runners = new Array(Math.max(1, Math.min(concurrency, items.length))).fill(0).map(async () => {
        while (true) {
            const i = idx++;
            if (i >= items.length) break;
            results[i] = await worker(items[i], i);
        }
    });
    await Promise.all(runners);
    return results;
}

/* SECTIONS */
const SECTION_CHIPS = ["Div 1+2", "Div. 1", "Div. 2", "Div. 3", "Div. 4", "Educational", "Global", "Others"];
const DEFAULT_SECTION = "Div 1+2";

function matchesSection(contest: ContestInfo, section: string) {
    if (!contest) return false;
    const name = contest.name || "";

    const isDiv1 = /Div\.?\s*1\b/i.test(name);
    const isDiv2 = /Div\.?\s*2\b/i.test(name);
    const isDiv3 = /Div\.?\s*3\b/i.test(name);
    const isDiv4 = /Div\.?\s*4\b/i.test(name);
    const isEdu = /Educational/i.test(name) || /Educational/i.test(String(contest.category || ""));
    const isGlobal = /Global/i.test(name) || /Global/i.test(String(contest.category || ""));

    // Check for explicit combined Div 1+2 pattern
    const explicitCombined = /Div\.?\s*1.*(\+|and|&|\/).*Div\.?\s*2/i.test(name) || /Div\.?\s*1\s*[\+\&\/]\s*2/i.test(name);

    if (section === "Div 1+2") {
        // Only contests that explicitly combine BOTH div1 & div2
        return explicitCombined || (isDiv1 && isDiv2);
    }
    if (section === "Div. 1") {
        // Div 1 contests (excluding combined Div 1+2)
        return isDiv1 && !explicitCombined && !isDiv2;
    }
    if (section === "Div. 2") {
        // Div 2 contests (excluding combined Div 1+2)
        return isDiv2 && !explicitCombined && !isDiv1;
    }
    if (section === "Div. 3") return isDiv3;
    if (section === "Div. 4") return isDiv4;
    if (section === "Educational") return isEdu;
    if (section === "Global") return isGlobal;
    if (section === "Others") {
        // Anything that doesn't match the above categories
        return !(isDiv1 || isDiv2 || isDiv3 || isDiv4 || isEdu || isGlobal);
    }
    return false;
}

/* Main component */
export default function Page(): React.ReactElement {
    const [section, setSection] = useState<string>(DEFAULT_SECTION);
    const [contests, setContests] = useState<ContestInfo[]>([]);
    const [loadingContests, setLoadingContests] = useState(false);
    const [errorContests, setErrorContests] = useState<string | null>(null);

    const [contestProblemsMap, setContestProblemsMap] = useState<Record<number, ProblemInfo[]>>({});
    const [loadingAllProblems, setLoadingAllProblems] = useState(false);
    const [loadedCount, setLoadedCount] = useState(0);

    const runnerActiveRef = useRef(false);
    const runnerAbortRef = useRef(false);

    const [page, setPage] = useState(1);
    const [perContestLoading, setPerContestLoading] = useState<Record<number, boolean>>({});

    const [hardJobState, setHardJobState] = useState<HardReloadJob | null>(null);

    const { handle, userSolvedSet } = useAppContext();

    const normalizeIndexLocal = (idx: any) => String(idx ?? "").toUpperCase().trim();
    const problemKey = (contestId?: number, index?: string) => `${contestId ?? "0"}-${normalizeIndexLocal(index)}`;

    // Convert userSolvedSet to solvedMap format for ContestRow
    const solvedMap = useMemo(() => {
        const map: Record<string, true> = {};
        userSolvedSet.forEach((key) => {
            map[key] = true;
        });
        return map;
    }, [userSolvedSet]);

    // For now, we don't have attempted info from AppContext, so empty map
    const attemptedMap: Record<string, true> = useMemo(() => ({}), []);

    /* schedule prefetch for section (small idle chunks) */
    const schedulePrefetchSection = useCallback((contestIds: number[]) => {
        if (!contestIds.length) return;
        let idx = 0;

        const doChunk = async (chunk: number[]) => {
            await mapWithConcurrency(chunk, async (cid) => {
                try {
                    const dbVal = await loadProblemsDB(cid);
                    if (Array.isArray(dbVal) && dbVal.length) {
                        setContestProblemsMap(mp => ({ ...mp, [cid]: dbVal }));
                        return null;
                    }
                } catch { }
                try {
                    const raw = localStorage.getItem(`${PROBLEM_KEY_PREFIX}${cid}`);
                    const parsed = safeParse(raw);
                    if (Array.isArray(parsed) && parsed.length) {
                        setContestProblemsMap(mp => ({ ...mp, [cid]: parsed }));
                        return null;
                    }
                } catch { }
                try {
                    // Fetch from backend MongoDB database instead of Codeforces API
                    const data = await fetchWithCacheJson(BACKEND_CONTEST_BY_ID(cid));
                    if (data?.success && data?.contest?.problems) {
                        const problems: ProblemInfo[] = data.contest.problems.map((p: any) => ({
                            contestId: Number(p.contestId),
                            index: String(p.index),
                            name: String(p.name ?? ""),
                            points: p.points,
                            rating: p.rating
                        }));
                        if (problems.length) {
                            try { await saveProblemsDB(cid, problems); } catch { }
                            try { localStorage.setItem(`${PROBLEM_KEY_PREFIX}${cid}`, JSON.stringify(problems)); } catch { }
                            setContestProblemsMap(mp => ({ ...mp, [cid]: problems }));
                        }
                    }
                } catch { }
                return null;
            }, Math.min(4, chunk.length));
        };

        const run = () => {
            if (idx >= contestIds.length) return;
            const chunk = contestIds.slice(idx, idx + PREFETCH_CHUNK);
            idx += PREFETCH_CHUNK;
            if ((window as any).requestIdleCallback) {
                (window as any).requestIdleCallback(() => { void doChunk(chunk); }, { timeout: 1500 });
            } else {
                setTimeout(() => { void doChunk(chunk); }, 300);
            }
            setTimeout(run, 400);
        };

        setTimeout(run, 250);
    }, []);

    /* fetchProblemsForContest: IDB -> localStorage -> backend MongoDB (not Codeforces API) */
    const fetchProblemsForContest = useCallback(async (contestId: number, forceNetwork = false): Promise<ProblemInfo[]> => {
        const key = `${PROBLEM_KEY_PREFIX}${contestId}`;
        if (!forceNetwork) {
            try { const dbVal = await loadProblemsDB(contestId); if (Array.isArray(dbVal) && dbVal.length) return dbVal; } catch { }
            try { const raw = localStorage.getItem(key); const parsed = safeParse(raw); if (Array.isArray(parsed) && parsed.length) return parsed as ProblemInfo[]; } catch { }
        }

        // Fetch from backend MongoDB database instead of Codeforces API
        try {
            const data = await fetchWithCacheJson(BACKEND_CONTEST_BY_ID(contestId));
            if (data?.success && data?.contest?.problems) {
                const problems: ProblemInfo[] = data.contest.problems.map((p: any) => ({
                    contestId: Number(p.contestId),
                    index: String(p.index),
                    name: String(p.name ?? ""),
                    points: p.points,
                    rating: p.rating
                }));

                if (problems.length) {
                    try { await saveProblemsDB(contestId, problems); } catch { }
                    try { localStorage.setItem(key, JSON.stringify(problems)); } catch { }
                    return problems;
                }
            }
        } catch (e) {
            console.error(`Failed to fetch problems for contest ${contestId} from backend`, e);
        }

        try { const dbVal = await loadProblemsDB(contestId); if (Array.isArray(dbVal)) return dbVal; } catch { }
        try { const raw = localStorage.getItem(key); const parsed = safeParse(raw); if (Array.isArray(parsed)) return parsed as ProblemInfo[]; } catch { }
        return [];
    }, []);

    /* Hard reload per-section (resumable) */
    const saveHardJob = useCallback((sectionKey: string, job: HardReloadJob | null) => {
        const key = `${HARD_RELOAD_JOB_KEY_PREFIX}${sectionKey}`;
        if (typeof window === "undefined") { setHardJobState(job); return; }
        if (!job) { localStorage.removeItem(key); setHardJobState(null); } else { try { localStorage.setItem(key, JSON.stringify(job)); } catch { } setHardJobState(job); }
    }, []);

    const runHardReloadLoop = useCallback(async (sectionKey: string, job: HardReloadJob) => {
        if (runnerActiveRef.current) return;
        runnerActiveRef.current = true;
        setLoadingAllProblems(true);
        runnerAbortRef.current = false;
        setLoadedCount(job.completed || 0);

        try {
            const start = job.completed || 0;
            const ids = job.contestIds.slice(start);

            for (let i = 0; i < ids.length; i++) {
                const contestId = ids[i];
                const storedRaw = safeParse(localStorage.getItem(`${HARD_RELOAD_JOB_KEY_PREFIX}${sectionKey}`)) as HardReloadJob | null;
                if (!storedRaw || storedRaw.status !== "running" || runnerAbortRef.current) throw new Error("stopped");

                setPerContestLoading((m) => ({ ...m, [contestId]: true }));
                try {
                    const existing = await loadProblemsDB(contestId).catch(() => null);
                    const lsRaw = safeParse(localStorage.getItem(`${PROBLEM_KEY_PREFIX}${contestId}`));
                    if ((Array.isArray(existing) && existing.length) || (Array.isArray(lsRaw) && lsRaw.length)) {
                        setContestProblemsMap((mp) => ({ ...mp, [contestId]: (Array.isArray(existing) && existing.length) ? existing : lsRaw }));
                    } else {
                        try {
                            const problems = await fetchProblemsForContest(contestId, /*forceNetwork*/ true);
                            setContestProblemsMap((mp) => ({ ...mp, [contestId]: problems || [] }));
                        } catch (e) {
                            console.error("hard reload contest failed", contestId, e);
                        }
                    }
                } finally {
                    setPerContestLoading((m) => ({ ...m, [contestId]: false }));
                }

                try {
                    const cur = safeParse(localStorage.getItem(`${HARD_RELOAD_JOB_KEY_PREFIX}${sectionKey}`)) as HardReloadJob | null;
                    if (cur) {
                        cur.completed = (cur.completed || 0) + 1;
                        saveHardJob(sectionKey, cur);
                        setLoadedCount(cur.completed);
                    }
                } catch { }

                try { await saveSnapshotToDB(sectionKey, contests, contestProblemsMap); } catch { }

                const nowJob = safeParse(localStorage.getItem(`${HARD_RELOAD_JOB_KEY_PREFIX}${sectionKey}`)) as HardReloadJob | null;
                if (!nowJob || nowJob.status !== "running" || runnerAbortRef.current) break;
            }

            const final = safeParse(localStorage.getItem(`${HARD_RELOAD_JOB_KEY_PREFIX}${sectionKey}`)) as HardReloadJob | null;
            if (final && final.status === "running") { final.status = "completed"; saveHardJob(sectionKey, final); }
        } catch (e) {
            // stopped or aborted
        } finally {
            runnerActiveRef.current = false;
            setLoadingAllProblems(false);
            try { await saveSnapshotToDB(sectionKey, contests, contestProblemsMap); } catch { }
        }
    }, [fetchProblemsForContest, saveHardJob, contests, contestProblemsMap]);

    /* ensure per-section caches exist on boot so sections appear instantly */
    const ensurePerSectionCachesOnBoot = useCallback(async () => {
        try {
            // if any per-section key missing, try to populate from global cache or IDB snapshots
            let anyMissing = false;
            for (const s of SECTION_CHIPS) {
                const key = `${CONTESTS_KEY_SECTION_PREFIX}${s.replace(/\s+/g, "_").toLowerCase()}`;
                const raw = localStorage.getItem(key);
                if (!raw) { anyMissing = true; break; }
            }
            if (!anyMissing) return;

            // 1) try global cache
            const global = safeParse(localStorage.getItem(CONTESTS_KEY)) as any[] | null;
            if (Array.isArray(global) && global.length) {
                const all = normalizeAndFilter(global);
                for (const s of SECTION_CHIPS) {
                    const perKey = `${CONTESTS_KEY_SECTION_PREFIX}${s.replace(/\s+/g, "_").toLowerCase()}`;
                    try {
                        const slice = all.filter((c) => matchesSection(c, s));
                        localStorage.setItem(perKey, JSON.stringify(slice));
                    } catch { }
                }
                return;
            }

            // 2) try IDB snapshots per-section
            for (const s of SECTION_CHIPS) {
                const sectionKey = s.replace(/\s+/g, "_").toLowerCase();
                try {
                    const snap = await loadSnapshotFromDB(sectionKey);
                    if (snap && Array.isArray(snap.contests) && snap.contests.length > 0) {
                        const norm = normalizeAndFilter(snap.contests).filter((c) => matchesSection(c, s));
                        localStorage.setItem(`${CONTESTS_KEY_SECTION_PREFIX}${sectionKey}`, JSON.stringify(norm));
                    }
                } catch { }
            }
        } catch {
            // ignore
        }
    }, []);

    const startHardReload = useCallback(async () => {
        const sectionKey = section.replace(/\s+/g, "_").toLowerCase();
        setErrorContests(null);
        setLoadingContests(true);
        try {
            const data = await fetchWithCacheJson(`${BACKEND_CONTESTS_BY_CATEGORY}?limit=10000`);
            if (!data?.success) throw new Error("Backend API failed");

            // Map backend category names to frontend section names
            const categoryMap: Record<string, string> = {
                'DIV1_DIV2': 'Div 1+2',
                'DIV1': 'Div. 1',
                'DIV2': 'Div. 2',
                'DIV3': 'Div. 3',
                'DIV4': 'Div. 4',
                'GLOBAL': 'Global',
                'EDUCATIONAL': 'Educational',
                'OTHERS': 'Others'
            };

            const backendCategory = Object.entries(categoryMap).find(([k, v]) => v === section)?.[0];
            const contestsFromBackend = backendCategory ? data.categories[backendCategory] || [] : [];

            const allRaw: any[] = contestsFromBackend.map((c: any) => ({
                id: c.id,
                name: c.name,
                phase: c.phase,
                type: c.type,
                startTimeSeconds: c.startTimeSeconds,
                category: section
            }));

            // persist global + per-section right away
            try { localStorage.setItem(CONTESTS_KEY, JSON.stringify(allRaw)); localStorage.setItem(CONTESTS_KEY_TS, String(Date.now())); } catch { }
            for (const s of SECTION_CHIPS) {
                const perKey = `${CONTESTS_KEY_SECTION_PREFIX}${s.replace(/\s+/g, "_").toLowerCase()}`;
                try { const slice = allRaw.filter((c: any) => matchesSection(c, s)); localStorage.setItem(perKey, JSON.stringify(slice)); } catch { }
            }

            const filtered: any[] = allRaw.filter((c: any) => matchesSection(c, section));
            filtered.sort((a: any, b: any) => Number(b.startTimeSeconds ?? 0) - Number(a.startTimeSeconds ?? 0));
            setContests(filtered);
            setContestProblemsMap({});
            const job: HardReloadJob = { status: "running", contestIds: filtered.map((c: any) => c.id), completed: 0, startedAt: Date.now() };
            saveHardJob(sectionKey, job);
            void runHardReloadLoop(sectionKey, job);
        } catch (err: any) {
            console.error("Hard reload failed", err);
            setErrorContests("⚠️ Hard reload failed. Try again later.");
        } finally {
            setLoadingContests(false);
        }
    }, [section, runHardReloadLoop, saveHardJob]);

    const stopHardReload = useCallback(() => {
        const sectionKey = section.replace(/\s+/g, "_").toLowerCase();
        const raw = safeParse(localStorage.getItem(`${HARD_RELOAD_JOB_KEY_PREFIX}${sectionKey}`)) as HardReloadJob | null;
        if (raw) { raw.status = "stopped"; saveHardJob(sectionKey, raw); } else saveHardJob(sectionKey, null);
        setHardJobState((s) => (s ? { ...s, status: "stopped" } : null));
        runnerAbortRef.current = true;
    }, [section, saveHardJob]);

    /* update contests for current section (user-triggered network merge) */
    const updateContests = useCallback(async () => {
        setLoadingContests(true); setErrorContests(null);
        try {
            // Step 1: Call backend sync endpoint to fetch from Codeforces and save to MongoDB
            console.log('🔄 Syncing contests from Codeforces to MongoDB...');
            const syncResponse = await fetch(BACKEND_SYNC_CONTESTS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!syncResponse.ok) {
                throw new Error(`Sync failed: ${syncResponse.status}`);
            }

            const syncData = await syncResponse.json();
            console.log(`✅ Sync complete: ${syncData.contestsInserted} new, ${syncData.contestsUpdated} updated`);

            // Step 2: Force fresh fetch from backend MongoDB database, bypassing cache
            const data = await fetchFreshJson(`${BACKEND_CONTESTS_BY_CATEGORY}?limit=10000`);
            if (!data?.success) throw new Error("Backend API failed");

            // Map backend category names to frontend section names
            const categoryMap: Record<string, string> = {
                'DIV1_DIV2': 'Div 1+2',
                'DIV1': 'Div. 1',
                'DIV2': 'Div. 2',
                'DIV3': 'Div. 3',
                'DIV4': 'Div. 4',
                'GLOBAL': 'Global',
                'EDUCATIONAL': 'Educational',
                'OTHERS': 'Others'
            };

            // Flatten all categories into a single array for global cache
            const allRaw: any[] = [];
            for (const [backendCat, contests] of Object.entries(data.categories)) {
                const frontendSection = categoryMap[backendCat] || 'Others';
                (contests as any[]).forEach((c: any) => {
                    allRaw.push({
                        id: c.id,
                        name: c.name,
                        phase: c.phase || 'FINISHED',
                        type: c.type,
                        startTimeSeconds: c.startTimeSeconds,
                        category: frontendSection
                    });
                });
            }

            // save global list + timestamp
            try { localStorage.setItem(CONTESTS_KEY, JSON.stringify(allRaw)); localStorage.setItem(CONTESTS_KEY_TS, String(Date.now())); } catch { }

            // persist per-section durable cache
            for (const s of SECTION_CHIPS) {
                const perKey = `${CONTESTS_KEY_SECTION_PREFIX}${s.replace(/\s+/g, "_").toLowerCase()}`;
                try { const slice = allRaw.filter((c: any) => matchesSection(c, s)); localStorage.setItem(perKey, JSON.stringify(slice)); } catch { }
            }

            const filtered: any[] = allRaw.filter((c: any) => matchesSection(c, section));
            filtered.sort((a: any, b: any) => Number(b.startTimeSeconds ?? 0) - Number(a.startTimeSeconds ?? 0));
            setContests(filtered);

            setContestProblemsMap((mp) => {
                const copy = { ...mp };
                filtered.forEach((c: any) => { if (!Object.prototype.hasOwnProperty.call(copy, c.id)) copy[c.id] = copy[c.id] || []; });
                return copy;
            });

            const first = filtered.slice(0, PAGE_SIZE).map((c: any) => c.id);
            await Promise.all(first.map(async (cid: any) => {
                try { const db = await loadProblemsDB(cid); if (Array.isArray(db) && db.length) { setContestProblemsMap(m => ({ ...m, [cid]: db })); return; } } catch { }
                try { const raw = localStorage.getItem(`${PROBLEM_KEY_PREFIX}${cid}`); const parsed = safeParse(raw); if (Array.isArray(parsed) && parsed.length) setContestProblemsMap(m => ({ ...m, [cid]: parsed })); } catch { }
            }));

            schedulePrefetchSection(filtered.map((c: any) => c.id));
        } catch (e: any) {
            console.error("Update contests failed", e);
            setErrorContests("⚠️ Failed to update contests. " + (e.message || "Try again later."));
        } finally {
            setLoadingContests(false);
        }
    }, [section, schedulePrefetchSection]);

    /* Visible page ASAP loader */
    useEffect(() => {
        const ids = contests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(c => c.id);
        if (!ids.length) return;
        (async () => {
            await Promise.all(ids.map(async (cid) => {
                if (contestProblemsMap[cid] && contestProblemsMap[cid].length) return;
                try { const db = await loadProblemsDB(cid); if (Array.isArray(db) && db.length) { setContestProblemsMap(m => ({ ...m, [cid]: db })); return; } } catch { }
                try { const raw = localStorage.getItem(`${PROBLEM_KEY_PREFIX}${cid}`); const parsed = safeParse(raw); if (Array.isArray(parsed) && parsed.length) { setContestProblemsMap(m => ({ ...m, [cid]: parsed })); return; } } catch { }
                try { const p = await fetchProblemsForContest(cid, false); setContestProblemsMap(m => ({ ...m, [cid]: p || [] })); } catch { }
            }));
        })();
    }, [page, contests, contestProblemsMap, fetchProblemsForContest]);

    /* loadSection: use per-section cache -> global cache -> IDB snapshot -> network */
    const loadSection = useCallback(async (sectionName: string, forceUpdate = false) => {
        setSection(sectionName);
        setPage(1);
        setErrorContests(null);

        const sectionKey = sectionName.replace(/\s+/g, "_").toLowerCase();

        // If forceUpdate is true, skip cache and fetch from network (same as updateContests)
        if (forceUpdate) {
            setLoadingContests(true);
            try {
                const data = await fetchWithCacheJson(`${BACKEND_CONTESTS_BY_CATEGORY}?limit=10000`);
                if (!data?.success) throw new Error("Backend API failed");

                // Map backend category names to frontend section names
                const categoryMap: Record<string, string> = {
                    'DIV1_DIV2': 'Div 1+2',
                    'DIV1': 'Div. 1',
                    'DIV2': 'Div. 2',
                    'DIV3': 'Div. 3',
                    'DIV4': 'Div. 4',
                    'GLOBAL': 'Global',
                    'EDUCATIONAL': 'Educational',
                    'OTHERS': 'Others'
                };

                // Flatten all categories into a single array for global cache
                const allRaw: any[] = [];
                for (const [backendCat, contests] of Object.entries(data.categories)) {
                    const frontendSection = categoryMap[backendCat] || 'Others';
                    (contests as any[]).forEach((c: any) => {
                        allRaw.push({
                            id: c.id,
                            name: c.name,
                            phase: c.phase || 'FINISHED',
                            type: c.type,
                            startTimeSeconds: c.startTimeSeconds,
                            category: frontendSection
                        });
                    });
                }

                // save global list + timestamp
                try { localStorage.setItem(CONTESTS_KEY, JSON.stringify(allRaw)); localStorage.setItem(CONTESTS_KEY_TS, String(Date.now())); } catch { }

                // persist per-section durable cache
                for (const s of SECTION_CHIPS) {
                    const perKey = `${CONTESTS_KEY_SECTION_PREFIX}${s.replace(/\s+/g, "_").toLowerCase()}`;
                    try { const slice = allRaw.filter((c: any) => matchesSection(c, s)); localStorage.setItem(perKey, JSON.stringify(slice)); } catch { }
                }

                const filtered: any[] = allRaw.filter((c: any) => matchesSection(c, sectionName));
                filtered.sort((a: any, b: any) => Number(b.startTimeSeconds ?? 0) - Number(a.startTimeSeconds ?? 0));
                setContests(filtered);

                setContestProblemsMap((mp) => {
                    const copy = { ...mp };
                    filtered.forEach((c: any) => { if (!Object.prototype.hasOwnProperty.call(copy, c.id)) copy[c.id] = copy[c.id] || []; });
                    return copy;
                });

                const first = filtered.slice(0, PAGE_SIZE).map((c: any) => c.id);
                await Promise.all(first.map(async (cid: any) => {
                    try { const db = await loadProblemsDB(cid); if (Array.isArray(db) && db.length) { setContestProblemsMap(m => ({ ...m, [cid]: db })); return; } } catch { }
                    try { const raw = localStorage.getItem(`${PROBLEM_KEY_PREFIX}${cid}`); const parsed = safeParse(raw); if (Array.isArray(parsed) && parsed.length) setContestProblemsMap(m => ({ ...m, [cid]: parsed })); } catch { }
                }));

                schedulePrefetchSection(filtered.map((c: any) => c.id));
            } catch (e) {
                console.error("Update contests failed", e);
                setErrorContests("⚠️ Failed to update contests for this section.");
            } finally {
                setLoadingContests(false);
            }
            return;
        }

        // 0) per-section localStorage (fast)
        try {
            const perKey = `${CONTESTS_KEY_SECTION_PREFIX}${sectionKey}`;
            const perRaw = safeParse(localStorage.getItem(perKey));
            if (Array.isArray(perRaw) && perRaw.length > 0) {
                const norm = normalizeAndFilter(perRaw).filter((c) => matchesSection(c, sectionName));
                norm.sort((a, b) => Number(b.startTimeSeconds ?? 0) - Number(a.startTimeSeconds ?? 0));
                setContests(norm);

                (async () => {
                    const firstPage = norm.slice(0, PAGE_SIZE).map((c) => c.id);
                    await Promise.all(firstPage.map(async (cid) => {
                        try { const db = await loadProblemsDB(cid); if (Array.isArray(db) && db.length) { setContestProblemsMap(m => ({ ...m, [cid]: db })); return; } } catch { }
                        try { const raw = localStorage.getItem(`${PROBLEM_KEY_PREFIX}${cid}`); const parsed = safeParse(raw); if (Array.isArray(parsed) && parsed.length) setContestProblemsMap(m => ({ ...m, [cid]: parsed })); } catch { }
                    }));
                    schedulePrefetchSection(norm.map((c) => c.id));
                })();

                // merge snapshot problems (background)
                (async () => {
                    try {
                        const snap = await loadSnapshotFromDB(sectionKey);
                        if (snap && Array.isArray(snap.contests) && snap.contests.length > 0) {
                            if (Object.keys(snap.problemsMap || {}).length > 0) {
                                setContestProblemsMap(mp => ({ ...snap.problemsMap, ...mp }));
                            }
                        }
                    } catch { }
                })();

                return; // very important: avoid network if we have per-section cache
            }
        } catch (e) {
            console.warn("per-section cached contests read error (sync)", e);
        }

        // 1) global cached list in localStorage
        try {
            const cached = safeParse(localStorage.getItem(CONTESTS_KEY));
            if (Array.isArray(cached) && cached.length > 0) {
                const all = normalizeAndFilter(cached);
                const norm = all.filter((c) => matchesSection(c, sectionName));
                norm.sort((a, b) => Number(b.startTimeSeconds ?? 0) - Number(a.startTimeSeconds ?? 0));
                setContests(norm);

                (async () => {
                    const firstPage = norm.slice(0, PAGE_SIZE).map((c) => c.id);
                    await Promise.all(firstPage.map(async (cid) => {
                        try { const db = await loadProblemsDB(cid); if (Array.isArray(db) && db.length) { setContestProblemsMap(m => ({ ...m, [cid]: db })); return; } } catch { }
                        try { const raw = localStorage.getItem(`${PROBLEM_KEY_PREFIX}${cid}`); const parsed = safeParse(raw); if (Array.isArray(parsed) && parsed.length) setContestProblemsMap(m => ({ ...m, [cid]: parsed })); } catch { }
                    }));
                    schedulePrefetchSection(norm.map((c) => c.id));
                })();

                // ensure per-section copy exists and merge IDB snapshot
                (async () => {
                    try {
                        const snap = await loadSnapshotFromDB(sectionKey);
                        if (snap && Array.isArray(snap.contests) && snap.contests.length > 0) {
                            if (Object.keys(snap.problemsMap || {}).length > 0) {
                                setContestProblemsMap(mp => ({ ...snap.problemsMap, ...mp }));
                            }
                        }
                        try { localStorage.setItem(`${CONTESTS_KEY_SECTION_PREFIX}${sectionKey}`, JSON.stringify(norm)); } catch { }
                    } catch { }
                })();

                return;
            }
        } catch (e) {
            console.warn("global cached contests read error (sync)", e);
        }

        // 2) try IDB snapshot (structured)
        setLoadingContests(true);
        try {
            try {
                const snap = await loadSnapshotFromDB(sectionKey);
                if (snap && Array.isArray(snap.contests) && snap.contests.length > 0) {
                    const norm = normalizeAndFilter(snap.contests).filter((c) => matchesSection(c, sectionName));
                    norm.sort((a, b) => Number(b.startTimeSeconds ?? 0) - Number(a.startTimeSeconds ?? 0));
                    setContests(norm);

                    const filteredProblems: Record<number, ProblemInfo[]> = {};
                    for (const id of norm.map((c) => c.id)) {
                        if (snap.problemsMap && snap.problemsMap[id]) filteredProblems[id] = snap.problemsMap[id];
                    }
                    setContestProblemsMap(mp => ({ ...filteredProblems, ...mp }));

                    try { localStorage.setItem(`${CONTESTS_KEY_SECTION_PREFIX}${sectionKey}`, JSON.stringify(norm)); } catch { }

                    schedulePrefetchSection(norm.map((c) => c.id));
                    setLoadingContests(false);
                    return;
                }
            } catch (e) {
                console.warn("section snapshot IDB error", e);
            }

            // 3) last resort: network fetch from backend MongoDB database
            try {
                const data = await fetchWithCacheJson(`${BACKEND_CONTESTS_BY_CATEGORY}?limit=10000`);
                if (!data?.success) throw new Error("Backend API failed");

                // Map backend category names to frontend section names
                const categoryMap: Record<string, string> = {
                    'DIV1_DIV2': 'Div 1+2',
                    'DIV1': 'Div. 1',
                    'DIV2': 'Div. 2',
                    'DIV3': 'Div. 3',
                    'DIV4': 'Div. 4',
                    'GLOBAL': 'Global',
                    'EDUCATIONAL': 'Educational',
                    'OTHERS': 'Others'
                };

                // Flatten all categories into a single array for global cache
                const all: any[] = [];
                for (const [backendCat, contests] of Object.entries(data.categories)) {
                    const frontendSection = categoryMap[backendCat] || 'Others';
                    (contests as any[]).forEach((c: any) => {
                        all.push({
                            id: c.id,
                            name: c.name,
                            phase: c.phase || 'FINISHED',
                            type: c.type,
                            startTimeSeconds: c.startTimeSeconds,
                            category: frontendSection
                        });
                    });
                }

                try { localStorage.setItem(CONTESTS_KEY, JSON.stringify(all)); localStorage.setItem(CONTESTS_KEY_TS, String(Date.now())); } catch { }
                // create per-section durable copies
                for (const s of SECTION_CHIPS) {
                    const perKey = `${CONTESTS_KEY_SECTION_PREFIX}${s.replace(/\s+/g, "_").toLowerCase()}`;
                    try { const slice = all.filter((c: any) => matchesSection(c, s)); localStorage.setItem(perKey, JSON.stringify(slice)); } catch { }
                }

                const norm: any[] = all.filter((c: any) => matchesSection(c, sectionName));
                norm.sort((a: any, b: any) => Number(b.startTimeSeconds ?? 0) - Number(a.startTimeSeconds ?? 0));
                setContests(norm);

                const firstPage = norm.slice(0, PAGE_SIZE).map((c: any) => c.id);
                await Promise.all(firstPage.map(async (cid: any) => {
                    try { const db = await loadProblemsDB(cid); if (Array.isArray(db) && db.length) { setContestProblemsMap(m => ({ ...m, [cid]: db })); return; } } catch { }
                    try { const raw = localStorage.getItem(`${PROBLEM_KEY_PREFIX}${cid}`); const parsed = safeParse(raw); if (Array.isArray(parsed) && parsed.length) setContestProblemsMap(m => ({ ...m, [cid]: parsed })); } catch { }
                }));

                schedulePrefetchSection(norm.map((c: any) => c.id));
            } catch (err: any) {
                console.error("Contest fetch failed:", err);
                setErrorContests("⚠️ Failed to fetch contest list for this section. Cached data (if any) will be used.");
            } finally {
                setLoadingContests(false);
            }
        } catch (e) {
            setLoadingContests(false);
            setErrorContests("⚠️ Unknown error loading section.");
        }
    }, [contestProblemsMap, schedulePrefetchSection]);

    /* boot: ensure per-section caches then load default section */
    useEffect(() => {
        let mounted = true;
        (async () => {
            try { await ensurePerSectionCachesOnBoot(); } catch { }
            try { if (mounted) await loadSection(DEFAULT_SECTION); } catch { }
        })();
        return () => { mounted = false; };
        // intentionally empty deps to run ONCE
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* per-contest manual refresh */
    const refreshContest = useCallback(async (contestId: number) => {
        setPerContestLoading((m) => ({ ...m, [contestId]: true }));
        try {
            const p = await fetchProblemsForContest(contestId, true);
            setContestProblemsMap((mp) => ({ ...mp, [contestId]: p || [] }));
        } catch (e) {
            console.error("Per-contest refresh failed", contestId, e);
        } finally {
            setPerContestLoading((m) => ({ ...m, [contestId]: false }));
        }
    }, [fetchProblemsForContest]);

    /* hydrate hard job for current section */
    useEffect(() => {
        const sectionKey = section.replace(/\s+/g, "_").toLowerCase();
        const raw = safeParse(localStorage.getItem(`${HARD_RELOAD_JOB_KEY_PREFIX}${sectionKey}`)) as HardReloadJob | null;
        if (raw) { setHardJobState(raw); if (raw.status === "running") void runHardReloadLoop(sectionKey, raw); } else setHardJobState(null);
    }, [section, runHardReloadLoop]);

    /* save section snapshot periodically (debounced) */
    useEffect(() => {
        const key = section.replace(/\s+/g, "_").toLowerCase();
        const t = setTimeout(async () => { try { await saveSnapshotToDB(key, contests, contestProblemsMap); } catch { } }, 2000);
        return () => clearTimeout(t);
    }, [section, contests, contestProblemsMap]);

    /* derived UI */
    const filteredContests = contests;
    const totalPages = Math.max(1, Math.ceil(filteredContests.length / PAGE_SIZE));
    const pageContests = filteredContests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const maxProblemsOnPage = useMemo(() => {
        let m = 0;
        pageContests.forEach((c) => {
            const arr = contestProblemsMap[c.id] || [];
            if (arr.length > m) m = arr.length;
        });
        return m;
    }, [pageContests, contestProblemsMap]);

    const remainingMissing = useMemo(() => filteredContests.filter((c) => !(contestProblemsMap[c.id] && contestProblemsMap[c.id].length > 0)).map((c) => c.id), [filteredContests, contestProblemsMap]);

    const contestProblemsWithSolvedMap = useMemo(() => {
        const out: Record<number, ProblemInfo[]> = {};
        for (const [k, arr] of Object.entries(contestProblemsMap)) {
            const id = Number(k);
            out[id] = (arr || []).map((p) => {
                const key = problemKey(p.contestId, p.index);
                const solved = !!solvedMap[key];
                const attempted = !!attemptedMap[key];
                const failed = attempted && !solved;
                return { ...p, solved, failed } as ProblemInfo & { solved?: boolean; failed?: boolean };
            });
        }
        return out;
    }, [contestProblemsMap, solvedMap, attemptedMap]);

    const goPrevPage = () => setPage((p) => Math.max(1, p - 1));
    const goNextPage = () => setPage((p) => Math.min(totalPages, p + 1));

    return (
        <div className="min-h-screen font-mono bg-[var(--background)] text-[var(--foreground)] transition-colors">
            <div className="p-4">
                <div className="my-6 mx-12">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={goPrevPage} disabled={page === 1} className="p-2 rounded-md border hover:bg-gray-50 disabled:opacity-50" title="Previous page">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 15.707a1 1 0 01-1.414 0L5.172 10l5.707-5.707a1 1 0 011.414 1.414L8.414 10l3.879 3.879a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                            </button>
                            <h2 className="text-xl font-bold">CF Contests — {section}</h2>
                            <button onClick={goNextPage} disabled={page === totalPages} className="p-2 rounded-md border hover:bg-gray-50 disabled:opacity-50" title="Next page">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.707 4.293a1 1 0 00-1.414 1.414L11.586 10l-5.293 4.293a1 1 0 001.414 1.414L14.414 10 7.707 4.293z" clipRule="evenodd" /></svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* {hardJobState && hardJobState.status === "running" ? (
                                <button className="px-3 py-1 rounded-md bg-red-600 text-white text-sm hover:bg-red-500" onClick={() => stopHardReload()} title="Stop the ongoing loading process">
                                    Stop loading ({hardJobState.completed}/{hardJobState.contestIds.length})
                                </button>
                            ) : (
                                <button className="px-3 py-1 rounded-md bg-gray-800 text-white text-sm hover:bg-gray-700" onClick={() => startHardReload()} disabled={loadingContests || loadingAllProblems} title="Start loading contests + problems for this section (network-only).">
                                    Start loading (network)
                                </button>
                            )} */}

                            <button className="px-3 py-1 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500" onClick={updateContests} disabled={loadingContests} title="Sync latest contests from Codeforces API and save to MongoDB database">
                                Update contests
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {SECTION_CHIPS.map((c) => {
                            const active = section === c;
                            return (
                                <button key={c} onClick={() => { void loadSection(c, true); }} className={`px-3 py-1 rounded-full text-sm font-medium transition-shadow ${active ? "bg-blue-600 text-white shadow" : "bg-white border text-gray-700 hover:shadow-sm"}`}>
                                    {c}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mx-12">
                    <div className="border border-gray-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900">
                        {(loadingContests || loadingAllProblems) && (
                            <div className="p-4">
                                <Spinner />
                                <div className="text-sm mt-2 text-gray-600 dark:text-gray-400">{loadingContests ? "Loading contests…" : "Loading contest problems… (background)"}</div>
                            </div>
                        )}

                        {errorContests && <div className="p-4 text-red-600 dark:text-red-400">{errorContests}</div>}

                        {!loadingContests && !errorContests && (
                            <div className="min-w-[900px]">
                                <div className="flex items-center border-b bg-gray-50 dark:bg-slate-800 dark:border-slate-700 sticky top-0 z-10">
                                    <div className="flex items-center"><div className="p-2 w-[280px] font-semibold border-r text-gray-900 dark:text-gray-100 dark:border-slate-700">Contest</div></div>
                                    <div className="flex items-center flex-1">{Array.from({ length: Math.max(1, maxProblemsOnPage) }).map((_, i) => (<div key={i} className="p-2 flex items-center justify-center"><div className="w-[160px] font-semibold text-center text-gray-900 dark:text-gray-100">Problem {i + 1}</div></div>))}</div>
                                </div>

                                {pageContests.map((c) => (
                                    <ContestRow key={c.id} contest={c} problems={contestProblemsWithSolvedMap[c.id] || []} maxColumns={maxProblemsOnPage} onRefresh={() => refreshContest(c.id)} refreshing={!!perContestLoading[c.id]} />
                                ))}
                            </div>
                        )}
                    </div>

                    {remainingMissing.length > 0 && !loadingAllProblems && (
                        <div className="mt-4 text-xs text-yellow-700">Note: {remainingMissing.length} contest(s) missing problems in cache for this section. Use per-row refresh or "Start loading (network)" to populate them.</div>
                    )}

                    {totalPages > 1 && (
                        <div className="mt-6 dark:text-black flex justify-center">
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-1 rounded bg-gray-100 disabled:opacity-60" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Prev</button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }).slice(Math.max(0, page - 4), Math.min(totalPages, page + 3)).map((_, i) => {
                                        const p = i + Math.max(1, page - 3);
                                        return <button key={p} onClick={() => { setPage(p); window.scrollTo({ top: 0 }); }} className={`px-2 py-1 rounded ${p === page ? "bg-blue-600 text-white" : "bg-gray-100"}`}>{p}</button>;
                                    })}
                                </div>
                                <button className="px-3 py-1 rounded bg-gray-100 disabled:opacity-60" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
