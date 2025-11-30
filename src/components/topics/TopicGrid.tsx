import React from 'react';
import TopicCard from './TopicCard';

interface TopicGridProps {
    topics: { topic: string; count: number }[];
}

const TopicGrid: React.FC<TopicGridProps> = ({ topics }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {topics.map(({ topic, count }) => (
                <TopicCard key={topic} topic={topic} count={count} />
            ))}
        </div>
    );
};

export default TopicGrid;
