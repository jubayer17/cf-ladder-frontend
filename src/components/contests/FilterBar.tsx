"use client";
import React from "react";
import { Button } from "../ui/button";

interface FilterBarProps {
    selected: string;
    onChange: (filter: string) => void;
}

const FILTERS = ["All", "Div. 1", "Div. 2", "Div. 3", "Div. 4", "Educational", "Others"];

const FilterBar: React.FC<FilterBarProps> = ({ selected, onChange }) => {
    return (
        <div className="flex gap-2 flex-wrap justify-center md:justify-start">
            {FILTERS.map((f) => (
                <Button
                    key={f}
                    variant={selected === f ? "default" : "outline"}
                    onClick={() => onChange(f)}
                >
                    {f}
                </Button>
            ))}
        </div>
    );
};

export default FilterBar;
