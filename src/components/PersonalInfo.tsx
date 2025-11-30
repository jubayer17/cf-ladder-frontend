"use client";

import React, { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  getColorForRating,
  getRatingName,
  getHandleParts,
} from "../utils/ratingColors";
import { useAppContext } from "@/context/AppContext";
import { getVisitStreak } from "@/utils/streakTracker";

const SuccessChart = dynamic(() => import("./SuccessChart"), {
  ssr: false,
  loading: () => (
    <div className="w-36 h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
  ),
});

interface PersonalInfoProps {
  profileImage?: string;
  handle?: string;
  currentRating?: number | null;
  maxRating?: number | null;
  profileUrl?: string;
  isLoading?: boolean;
}

const normalizeIndex = (i: any) => String(i ?? "").toUpperCase().trim();
const makeKey = (contestId: number | string | undefined, idx: any) =>
  `${String(contestId ?? "")}-${normalizeIndex(idx)}`;

const PersonalInfo: React.FC<PersonalInfoProps> = ({
  profileImage,
  handle = "",
  currentRating = null,
  maxRating = null,
  isLoading = false,
}) => {
  const {
    problems,
    userSolvedSet,
    attemptedUnsolvedProblems,
    loadingProblems,
    fetchProblems,
    solvingStreak,
  } = useAppContext();

  const [visitStreak, setVisitStreak] = useState(0);

  useEffect(() => {
    if (handle) {
      fetchProblems();
    }
  }, [handle, fetchProblems]);

  useEffect(() => {
    const streak = getVisitStreak();
    setVisitStreak(streak.currentStreak);
  }, []);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (problems?.length && (userSolvedSet || attemptedUnsolvedProblems)) {
      setReady(true);
    }
  }, [problems, userSolvedSet, attemptedUnsolvedProblems]);

  if (isLoading || (handle && (loadingProblems || !ready))) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6 shadow-lg rounded-2xl mt-4 bg-[var(--card-bg)] border-2 border-border/40">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
              <div className="flex gap-2 mt-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="w-36 h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const attemptedKeys = useMemo(
    () => new Set((attemptedUnsolvedProblems || []).map((a) => a.key)),
    [attemptedUnsolvedProblems]
  );

  const { totalSolved, totalAttemptedUnsolved, totalNotTried } = useMemo(() => {
    const solvedSet = userSolvedSet || new Set<string>();
    const attemptedCount = attemptedKeys.size;
    const totalProblems =
      problems?.filter((p) => p && p.contestId != null).length ?? 0;

    const solvedCount = solvedSet.size;
    const notTried = Math.max(
      0,
      totalProblems - (solvedCount + attemptedCount)
    );

    return {
      totalSolved: solvedCount,
      totalAttemptedUnsolved: attemptedCount,
      totalNotTried: notTried,
    };
  }, [problems, userSolvedSet, attemptedKeys]);

  const color = useMemo(
    () => getColorForRating(currentRating ?? undefined),
    [currentRating]
  );
  const ratingName = useMemo(
    () => getRatingName(currentRating ?? undefined),
    [currentRating]
  );
  const handleParts = useMemo(
    () => getHandleParts(handle ?? "", currentRating ?? undefined),
    [handle, currentRating]
  );

  const displayRating =
    typeof currentRating === "number" ? String(currentRating) : "—";
  const displayMax = typeof maxRating === "number" ? String(maxRating) : "—";

  return (
    <div
      className="w-full max-w-7xl mx-auto p-6 shadow-md rounded-2xl mt-4 bg-[var(--card-bg)]"
      style={{ color: "var(--foreground)" }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <img
              src={profileImage}
              alt={`${handle} profile`}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 object-cover shadow-xl"
              style={{ borderColor: color }}
              loading="lazy"
            />
            <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white rounded-full p-1.5 shadow-lg">
              <i className="fa-solid fa-fire text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col items-left gap-2">
              <a
                href={`https://codeforces.com/profile/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl font-bold hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-2"
              >
                {handleParts.map((p, i) => {
                  const isVar =
                    typeof p.color === "string" && p.color.startsWith("var(");
                  const style: React.CSSProperties = isVar
                    ? {}
                    : { color: p.color };
                  const cls =
                    p.color === "var(--lgm-first)" ? "lgm-first" : "";
                  return (
                    <span key={i} className={cls} style={style}>
                      {p.text}
                    </span>
                  );
                })}
                <i className="fa-solid fa-external-link text-sm opacity-70" />
              </a>

              <span
                style={{
                  color,
                  border: `2px solid ${color}`,
                  padding: "0.25rem 0.6rem",
                  borderRadius: 10,
                  fontWeight: 700,
                  width: "fit-content",
                  boxShadow: `0 0 10px ${color}30`,
                }}
              >
                {ratingName}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
              {/* Current Rating */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <i className="fa-solid fa-trophy text-blue-500 text-lg" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Current</span>
                  <span className="font-bold text-sm">{displayRating}</span>
                </div>
              </div>

              {/* Max Rating */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
                <i className="fa-solid fa-star text-green-500 text-lg" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Max</span>
                  <span className="font-bold text-sm">{displayMax}</span>
                </div>
              </div>

              {/* Solved */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
                <i className="fa-solid fa-check-circle text-green-500 text-lg" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Solved</span>
                  <span className="font-bold text-sm">{totalSolved}</span>
                </div>
              </div>

              {/* Attempted */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <i className="fa-solid fa-exclamation-circle text-yellow-500 text-lg" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Attempted</span>
                  <span className="font-bold text-sm">{totalAttemptedUnsolved}</span>
                </div>
              </div>

              {/* Visit Streak */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <i className="fa-solid fa-calendar-days text-orange-500 text-lg" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Visit</span>
                  <span className="font-bold text-sm">{visitStreak} days</span>
                </div>
              </div>

              {/* Solving Streak */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <i className="fa-solid fa-fire text-red-500 text-lg" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Streak</span>
                  <span className="font-bold text-sm">{solvingStreak || 0} days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center sm:justify-end w-full sm:w-auto">
          <SuccessChart
            totalSolved={totalSolved}
            totalAttemptedUnsolved={totalAttemptedUnsolved}
            totalNotTried={totalNotTried}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(PersonalInfo);
