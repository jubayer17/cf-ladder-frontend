"use client";

import React from "react";
import ProblemRatings from "@/components/stats/problemRatings";
import TagsDonut from "@/components/stats/TagsDonut";
import { useAppContext } from "@/context/AppContext";

/* --------------------- Final Stats Page --------------------- */
export default function StatsPage(): React.ReactElement {
    const { handle } = useAppContext();

    return (
        <div className="min-h-screen font-mono bg-[var(--background)] text-[var(--foreground)] transition-colors">
            <div className="p-6">
                <div className="mb-6 mt-6">
                    <h1 className="text-2xl font-bold">User Stats</h1>
                </div>

                {!handle && <div className="text-gray-600">Enter your Codeforces handle above to see problem rating and tag statistics.</div>}

                {handle && (
                    <div className="flex flex-col gap-6">
                        {/* ProblemRatings appears first */}
                        <ProblemRatings handle={handle} />

                        {/* TagsDonut appears below the ratings */}
                        <TagsDonut handle={handle} />
                    </div>
                )}
            </div>
        </div>
    );
}
