"use client";
import React from "react";
import ProblemBox, { ProblemInfo } from "./ProblemBox";
import EmptyBox from "./EmptyBox";

export type ContestInfo = { id: number; name: string };

export const ContestCard: React.FC<{
    contest: ContestInfo;
    problems: ProblemInfo[];
    maxColumns: number;
}> = ({ contest, problems, maxColumns }) => {
    const cells = Array.from({ length: maxColumns }).map((_, idx) => {
        const p = problems[idx];
        return (
            <div key={idx} className="p-2 min-w-[160px] flex justify-center items-center">
                {p ? <ProblemBox p={p} /> : <EmptyBox />}
            </div>
        );
    });

    return (
        <div className="flex items-start border-b">
            <div className="p-2 sticky left-0 bg-white/80 backdrop-blur-sm border-r min-w-[280px]">
                <div className="font-semibold text-sm">{contest.name}</div>
                <div className="text-xs text-gray-500 mt-1">ID: {contest.id}</div>
            </div>
            {cells}
        </div>
    );
};
