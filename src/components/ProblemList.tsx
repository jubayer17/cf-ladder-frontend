"use client";

import React, { useEffect, useMemo, useState } from "react";
import ProblemCard from "./ProblemCard";
import ProblemSortControls from "./ProblemSortControls";
import { Problem, UserStatus } from "../types";
import { paginate } from "../utils/paginate";
import { loadContestMap, parseDivisionFromContestName } from "../utils/cfContests";

interface ProblemListProps {
  problems: Problem[];
  userStatusMap: Record<string, UserStatus>;
  userSolvedSet?: Set<string>;
  perPage?: number;
  selectedTag?: string | null;
  onStatusChange?: (problemKey: string, status: UserStatus) => void;
}

const CACHE_KEY = "cf_problems_cache_v1";
const CACHE_TTL = 1000 * 60 * 60;

const ProblemList: React.FC<ProblemListProps> = ({
  problems,
  userStatusMap,
  userSolvedSet = new Set(),
  perPage = 30,
  selectedTag = null,
  onStatusChange,
}) => {
  const [page, setPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [sortOption, setSortOption] = useState<"acceptance" | "new" | "old">("new");
  const [localProblems, setLocalProblems] = useState<Problem[]>([]);
  const [hideSolved, setHideSolved] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("cf_hide_solved");
    if (saved !== null) {
      setHideSolved(saved === "true");
    }
  }, []);

  const handleHideSolvedChange = (v: boolean) => {
    setHideSolved(v);
    localStorage.setItem("cf_hide_solved", String(v));
  };

  const [contestMap, setContestMap] = useState<Record<number, string> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts: number; problems: Problem[] };
      if (!parsed || Date.now() - parsed.ts > CACHE_TTL) return;
      setLocalProblems(parsed.problems);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!problems?.length) {
      setLocalProblems([]);
      return;
    }
    setLocalProblems(problems);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), problems }));
    } catch {
      // ignore
    }
  }, [problems]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const map = await loadContestMap();
        if (!mounted) return;
        setContestMap(map);
      } catch {
        if (!mounted) return;
        setContestMap(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const source = localProblems.length ? localProblems : problems;
  const isLoading = source.length === 0;

  useEffect(() => {
    setPage(1);
    setPageInput("1");
  }, [selectedTag]);

  const filteredSorted = useMemo(() => {
    let list = [...source];

    if (hideSolved) {
      list = list.filter((p) => {
        const key = `${p.contestId}-${p.index}`;
        const status: UserStatus =
          userStatusMap[key] ?? (userSolvedSet.has(key) ? "solved" : "unsolved");
        return status !== "solved";
      });
    }

    switch (sortOption) {
      case "acceptance":
        list.sort((a, b) => (b.solvedCount ?? 0) - (a.solvedCount ?? 0));
        break;
      case "old":
        list.sort((a, b) => (a.contestId ?? 0) - (b.contestId ?? 0));
        break;
      case "new":
      default:
        list.sort((a, b) => (b.contestId ?? 0) - (a.contestId ?? 0));
        break;
    }
    return list;
  }, [source, sortOption, hideSolved, userStatusMap, userSolvedSet]);

  const contestDivisionMap = useMemo(() => {
    if (!contestMap) return null;
    const m: Record<number, string | null> = {};
    for (const idStr of Object.keys(contestMap)) {
      const id = Number(idStr);
      m[id] = parseDivisionFromContestName(contestMap[id]);
    }
    return m;
  }, [contestMap]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / perPage));
  const paged = paginate(filteredSorted, page, perPage);

  useEffect(() => setPageInput(String(page)), [page]);

  const handlePageChange = (num: number) => {
    if (num < 1) num = 1;
    else if (num > totalPages) num = totalPages;
    setPage(num);
  };

  return (
    <div className="space-y-4">
      <ProblemSortControls
        sortOption={sortOption}
        onSortChange={(v) => {
          setSortOption(v);
          handlePageChange(1);
        }}
        hideSolved={hideSolved}
        onHideSolvedChange={handleHideSolvedChange}
      />

      {paged.map((p, idx) => {
        const key = `${p.contestId}-${p.index}`;
        const status: UserStatus =
          userStatusMap[key] ?? (userSolvedSet.has(key) ? "solved" : "unsolved");
        const problemNumber = (page - 1) * perPage + idx + 1;

        const contestId = p.contestId ?? undefined;
        const division =
          contestId && contestDivisionMap && contestDivisionMap[contestId] ? contestDivisionMap[contestId] : null;

        const contestName = contestId && contestMap ? contestMap[contestId] : undefined;

        return (
          <ProblemCard
            key={key}
            problem={p}
            status={status}
            number={problemNumber}
            contestDivision={division ?? undefined}
            contestName={contestName}
          // onChangeStatus={(s) => onStatusChange?.(key, s)}
          />
        );
      })}

      <div className="flex justify-center gap-2 mt-4 items-center">
        <button
          disabled={page === 1}
          onClick={() => handlePageChange(page - 1)}
          className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 dark:text-white disabled:opacity-50"
        >
          Prev
        </button>

        <span className="px-2 py-1 text-[var(--foreground)]">Page</span>

        <input
          type="text"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const num = parseInt(pageInput, 10);
              handlePageChange(isNaN(num) ? 1 : num);
            }
          }}
          className="w-16 px-2 py-1 rounded border dark:bg-gray-800 dark:text-white dark:border-gray-700 text-center appearance-none"
          inputMode="numeric"
          pattern="[0-9]*"
        />

        <span className="px-2 py-1 text-[var(--foreground)]">of {totalPages}</span>

        <button
          disabled={page === totalPages}
          onClick={() => handlePageChange(page + 1)}
          className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 dark:text-white disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ProblemList;
