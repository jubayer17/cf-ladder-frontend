import React from 'react';
import {
    FaCode, FaCalculator, FaLayerGroup, FaDiagramProject, FaShapes,
    FaSortDown, FaMagnifyingGlass, FaHashtag, FaTree, FaNetworkWired,
    FaGamepad, FaFont, FaDatabase, FaCubes, FaBolt, FaRoute, FaInfinity
} from 'react-icons/fa6';
import { MdDataObject, MdMemory } from 'react-icons/md';

export const getTopicIcon = (topic: string) => {
    const normalized = topic.toLowerCase().trim();

    const iconMap: Record<string, React.ReactNode> = {
        'dp': <FaLayerGroup />,
        'dynamic programming': <FaLayerGroup />,
        'greedy': <FaCalculator />,
        'math': <FaInfinity />,
        'maths': <FaInfinity />,
        'graphs': <FaDiagramProject />,
        'graph matchings': <FaDiagramProject />,
        'data structures': <FaDatabase />,
        'implementation': <FaCode />,
        'brute force': <FaBolt />,
        'constructive algorithms': <FaCubes />,
        'sortings': <FaSortDown />,
        'binary search': <FaMagnifyingGlass />,
        'dfs and similar': <FaRoute />,
        'trees': <FaTree />,
        'strings': <FaFont />,
        'number theory': <FaHashtag />,
        'combinatorics': <FaShapes />,
        'geometry': <FaShapes />,
        'bitmasks': <MdMemory />,
        'two pointers': <FaRoute />,
        'dsu': <FaNetworkWired />,
        'flows': <FaNetworkWired />,
        'games': <FaGamepad />,
        'matrices': <FaHashtag />,
        'probabilities': <FaCalculator />,
        'divide and conquer': <FaCode />,
        'hashing': <FaHashtag />,
        'shortest paths': <FaRoute />,
        'ternary search': <FaMagnifyingGlass />,
        'meet-in-the-middle': <FaMagnifyingGlass />,
        'fft': <FaCalculator />,
        '2-sat': <FaCode />,
        'chinese remainder theorem': <FaHashtag />,
        'schedules': <FaCalculator />,
    };

    return iconMap[normalized] || <FaCode />;
};
