export type UserStatus = "solved" | "failed" | "unsolved";

export interface Problem {
    contestId?: number;
    index: string;
    name: string;
    type?: string;
    rating?: number;
    tags: string[];
    solvedCount?: number;
}

export type ContestInfo = {
    id: number;
    name: string;
    phase: string;
    category: string;
    type?: string;
    durationSeconds?: number;
    startTimeSeconds?: number;
};

export type ProblemInfo = {
    contestId?: number;
    index?: string;
    name?: string;
    category?: string;
    points?: number;
    rating?: number;
};
