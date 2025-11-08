"use client";
import React from "react";
import ContestNameCell, { ContestInfo } from "./ContestNameCell";
import ProblemBox, { ProblemInfo } from "./ProblemBox";
import EmptyBox from "./EmptyBox";

interface Props {
    contest: ContestInfo;
    problems: ProblemInfo[];
    maxColumns: number;
    onRefresh?: () => void; // passed down to ContestNameCell
    refreshing?: boolean;
}

const ContestRow: React.FC<Props> = ({ contest, problems, maxColumns, onRefresh, refreshing }) => {
    const cells = Array.from({ length: maxColumns }).map((_, idx) => {
        const p = problems[idx];
        return (
            <div key={idx} className="p-2 h-full flex items-stretch">
                {p ? <ProblemBox p={p} /> : <EmptyBox />}
            </div>
        );
    });

    return (
        <div className="flex border-b border-gray-200 dark:border-slate-700 min-h-[100px]">
            <div className="flex items-stretch">
                <ContestNameCell c={contest} onRefresh={onRefresh} refreshing={refreshing} />
            </div>
            <div className="flex items-stretch flex-1">
                {cells}
            </div>
        </div>
    );
};

export default ContestRow;
