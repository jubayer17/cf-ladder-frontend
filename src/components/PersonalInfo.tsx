"use client";

import React, { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  getColorForRating,
  getRatingName,
  getHandleParts,
} from "../utils/ratingColors";
import { useAppContext } from "@/context/AppContext";

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
  } = useAppContext();

  // Force reload when handle changes
  useEffect(() => {
    if (handle) {
      fetchProblems();
    }
  }, [handle, fetchProblems]);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Wait until problems + attempted data loaded
    if (problems?.length && (userSolvedSet || attemptedUnsolvedProblems)) {
      setReady(true);
    }
  }, [problems, userSolvedSet, attemptedUnsolvedProblems]);

  // Skeleton while loading
  if (isLoading || loadingProblems || !ready) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6 shadow-md rounded-2xl mt-4 bg-[var(--card-bg)]">
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

  // Unique attempted-unsolved problem keys
  const attemptedKeys = useMemo(
    () => new Set((attemptedUnsolvedProblems || []).map((a) => a.key)),
    [attemptedUnsolvedProblems]
  );

  // Count solved, attempted, and not tried
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

  const progress =
    typeof currentRating === "number" &&
      typeof maxRating === "number" &&
      maxRating > 0
      ? Math.max(0, Math.min(100, Math.round((currentRating / maxRating) * 100)))
      : 0;

  const displayRating =
    typeof currentRating === "number" ? String(currentRating) : "—";
  const displayMax = typeof maxRating === "number" ? String(maxRating) : "—";

  return (
    <div
      className="w-full max-w-7xl mx-auto p-6 shadow-md rounded-2xl mt-4"
      style={{ backgroundColor: "var(--card-bg)", color: "var(--foreground)" }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <img
            src={profileImage}
            alt={`${handle} profile`}
            className="w-24 h-24 sm:w-27 sm:h-27 rounded-full border-2 object-cover"
            style={{ borderColor: "var(--blue-bg)" }}
            loading="lazy"
          />
          <div className="flex flex-col gap-1">
            <div className="flex flex-col items-left gap-2">
              <a
                href={`https://codeforces.com/profile/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl font-semibold hover:opacity-80 transition-opacity cursor-pointer"
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
              </a>

              <span
                style={{
                  color,
                  border: `1px solid ${color}`,
                  padding: "0.18rem 0.45rem",
                  borderRadius: 8,
                  fontWeight: 600,
                  marginLeft: 1,
                  width: "fit-content",
                }}
              >
                {ratingName}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 mt-2 text-sm">
              <span
                className="px-2 py-1 rounded"
                style={{
                  backgroundColor: "var(--blue-bg)",
                  color: "var(--button-text)",
                }}
              >
                Current Rating: {displayRating}
              </span>
              <span
                className="px-2 py-1 rounded"
                style={{
                  backgroundColor: "var(--green-bg)",
                  color: "var(--button-text)",
                }}
              >
                Max Rating: {displayMax}
              </span>
              <span
                className="px-2 py-1 rounded"
                style={{
                  backgroundColor: "var(--blue-bg)",
                  color: "var(--button-text)",
                }}
              >
                Solved: {totalSolved}
              </span>
              <span
                className="px-2 py-1 rounded"
                style={{
                  backgroundColor: "var(--red-bg)",
                  color: "var(--button-text)",
                }}
              >
                Attempted Unsolved: {totalAttemptedUnsolved}
              </span>
              <span
                className="px-2 py-1 rounded"
                style={{
                  backgroundColor: "#9CA3AF",
                  color: "var(--button-text)",
                }}
              >
                Not Tried: {totalNotTried}
              </span>
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

      {/* <div className="mt-4 flex items-center gap-3">
        <div
          className="progress-wrap"
          aria-hidden
          style={{ width: 200, height: 10, marginTop: 12 }}
        >
          <div
            className="progress-inner"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${color}, ${color})`,
              height: "100%",
              borderRadius: 6,
            }}
          />
        </div>
      </div> */}
    </div>
  );
};

export default React.memo(PersonalInfo);
