import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from 'next/navigation';
import { getTopicIcon } from '@/utils/topicIcons';

interface TopicCardProps {
    topic: string;
    count: number;
}

const TopicCard: React.FC<TopicCardProps> = ({ topic, count }) => {
    const router = useRouter();
    const icon = getTopicIcon(topic);

    return (
        <Card
            className="group relative overflow-hidden transition-all duration-300 hover:shadow-2xl cursor-pointer border-2 border-border/60 dark:border-border/40 bg-[var(--card-bg)] backdrop-blur-sm hover:-translate-y-1 hover:border-primary/70 hover:shadow-primary/20"
            onClick={() => router.push(`/topics/${encodeURIComponent(topic)}`)}
        >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <CardContent className="p-5 flex items-center gap-5 relative z-10">
                {/* Icon */}
                <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-4xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                    {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-mono font-bold text-xl capitalize tracking-tight mb-1 group-hover:text-primary transition-colors duration-300 truncate">
                        {topic}
                    </h3>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-mono px-2 py-1">
                            {count} {count === 1 ? 'problem' : 'problems'}
                        </Badge>
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </CardContent>
        </Card>
    );
};

export default TopicCard;
