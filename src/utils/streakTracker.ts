// Track daily visit streaks using localStorage
interface StreakData {
    lastVisit: string; // ISO date string
    currentStreak: number;
    longestStreak: number;
}

const STREAK_KEY = 'cf-ladder-visit-streak';

export const updateVisitStreak = (): StreakData => {
    // Check if running in browser
    if (typeof window === 'undefined') {
        return { lastVisit: '', currentStreak: 0, longestStreak: 0 };
    }

    const today = new Date().toISOString().split('T')[0];

    const stored = localStorage.getItem(STREAK_KEY);
    let streakData: StreakData = stored
        ? JSON.parse(stored)
        : { lastVisit: '', currentStreak: 0, longestStreak: 0 };

    if (!streakData.lastVisit) {
        streakData = {
            lastVisit: today,
            currentStreak: 1,
            longestStreak: 1
        };
    } else if (streakData.lastVisit === today) {
        return streakData;
    } else {
        const lastDate = new Date(streakData.lastVisit);
        const currentDate = new Date(today);
        const diffTime = currentDate.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            streakData.currentStreak += 1;
            streakData.longestStreak = Math.max(streakData.longestStreak, streakData.currentStreak);
        } else if (diffDays > 1) {
            streakData.currentStreak = 1;
        }

        streakData.lastVisit = today;
    }

    localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
    return streakData;
};

export const getVisitStreak = (): StreakData => {
    // Check if running in browser
    if (typeof window === 'undefined') {
        return { lastVisit: '', currentStreak: 0, longestStreak: 0 };
    }

    const stored = localStorage.getItem(STREAK_KEY);
    return stored
        ? JSON.parse(stored)
        : { lastVisit: '', currentStreak: 0, longestStreak: 0 };
};

export const resetVisitStreak = (): void => {
    // Check if running in browser
    if (typeof window === 'undefined') {
        return;
    }

    localStorage.removeItem(STREAK_KEY);
};
