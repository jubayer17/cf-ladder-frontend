"use client";

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import ProblemList from '@/components/ProblemList';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserStatus } from '@/types';
import { getTopicIcon } from '@/utils/topicIcons';

const TopicDetailsPage = () => {
    const params = useParams();
    const router = useRouter();
    const { problems, loadingProblems, userSolvedSet, attemptedUnsolvedProblems } = useAppContext();

    const topic = useMemo(() => {
        return decodeURIComponent(params.topic as string);
    }, [params.topic]);

    const filteredProblems = useMemo(() => {
        if (!topic) return [];
        return problems.filter(p => p.tags && p.tags.includes(topic));
    }, [problems, topic]);

    const stats = useMemo(() => {
        const solvedProblems = filteredProblems.filter(p => {
            const key = `${p.contestId}-${p.index}`;
            return userSolvedSet.has(key);
        });

        const attemptedProblems = filteredProblems.filter(p => {
            const key = `${p.contestId}-${p.index}`;
            return !userSolvedSet.has(key) && attemptedUnsolvedProblems.some(a => a.key === key);
        });

        const difficultyBreakdown = filteredProblems.reduce((acc, p) => {
            if (p.rating) {
                const range = Math.floor(p.rating / 100) * 100;
                acc[range] = (acc[range] || 0) + 1;
            } else {
                acc['unrated'] = (acc['unrated'] || 0) + 1;
            }
            return acc;
        }, {} as Record<string | number, number>);

        return {
            total: filteredProblems.length,
            solved: solvedProblems.length,
            attempted: attemptedProblems.length,
            unsolved: filteredProblems.length - solvedProblems.length,
            difficultyBreakdown
        };
    }, [filteredProblems, userSolvedSet, attemptedUnsolvedProblems]);

    const userStatusMap = useMemo(() => {
        const map: Record<string, UserStatus> = {};

        userSolvedSet.forEach(key => {
            map[key] = "solved";
        });

        attemptedUnsolvedProblems.forEach(p => {
            if (!userSolvedSet.has(p.key)) {
                map[p.key] = "failed";
            }
        });

        return map;
    }, [userSolvedSet, attemptedUnsolvedProblems]);

    if (loadingProblems) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const icon = getTopicIcon(topic);
    const solvedPercentage = stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0;

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl font-mono">
            {/* Back Button */}
            <Button
                variant="ghost"
                onClick={() => router.push('/topics')}
                className="mb-6 pl-0 hover:pl-2 transition-all font-mono"
            >
                ← Back to Topics
            </Button>

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-5xl">
                        {icon}
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold capitalize mb-2">{topic}</h1>
                        <p className="text-muted-foreground text-lg">
                            Master this topic by solving {stats.total} curated problems
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Solved Progress */}
                    <Card className="border-2 border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
                        <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground mb-1">Solved</div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {stats.solved} / {stats.total}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {solvedPercentage}% Complete
                            </div>
                            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-500"
                                    style={{ width: `${solvedPercentage}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Attempted */}
                    <Card className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent">
                        <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground mb-1">Attempted</div>
                            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                {stats.attempted}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Problems in progress
                            </div>
                        </CardContent>
                    </Card>

                    {/* Unsolved */}
                    <Card className="border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
                        <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground mb-1">Unsolved</div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {stats.unsolved}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Ready to solve
                            </div>
                        </CardContent>
                    </Card>

                    {/* Difficulty Range */}
                    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="p-4">
                            <div className="text-sm text-muted-foreground mb-1">Difficulty Range</div>
                            <div className="text-2xl font-bold">
                                {Object.keys(stats.difficultyBreakdown).filter(k => k !== 'unrated').length}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Different levels
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Difficulty Breakdown */}
                <Card className="border-2">
                    <CardContent className="p-4">
                        <h3 className="font-bold mb-3">Difficulty Distribution</h3>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(stats.difficultyBreakdown)
                                .sort(([a], [b]) => {
                                    if (a === 'unrated') return 1;
                                    if (b === 'unrated') return -1;
                                    return Number(a) - Number(b);
                                })
                                .map(([rating, count]) => (
                                    <Badge key={rating} variant="secondary" className="font-mono">
                                        {rating === 'unrated' ? 'Unrated' : rating}: {count}
                                    </Badge>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Problem List */}
            <ProblemList
                problems={filteredProblems}
                userStatusMap={userStatusMap}
                userSolvedSet={userSolvedSet}
                perPage={30}
            />
        </div>
    );
};

export default TopicDetailsPage;
