"use client";

import React, { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import TopicGrid from '@/components/topics/TopicGrid';

const TopicsPage = () => {
    const { problems, loadingProblems } = useAppContext();

    const topics = useMemo(() => {
        const topicCounts: Record<string, number> = {};

        problems.forEach(problem => {
            if (problem.tags) {
                problem.tags.forEach(tag => {
                    topicCounts[tag] = (topicCounts[tag] || 0) + 1;
                });
            }
        });

        return Object.entries(topicCounts)
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count);
    }, [problems]);

    if (loadingProblems) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Header */}
            <div className="mb-10 text-center">
                <div className="inline-block mb-4 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold font-mono">
                    Browse by Category
                </div>
                <h1 className="font-mono text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Problem Topics
                </h1>
                <p className="font-mono text-muted-foreground text-lg max-w-2xl mx-auto">
                    Explore coding problems organized by topics. Click on any topic to view all related problems and start solving.
                </p>
                <div className="mt-6 flex justify-center gap-6 text-sm font-mono">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                        <span className="text-muted-foreground">{topics.length} Topics Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-muted-foreground">{problems.length} Total Problems</span>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <TopicGrid topics={topics} />
        </div>
    );
};

export default TopicsPage;
