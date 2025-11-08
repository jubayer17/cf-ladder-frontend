"use client";
import React from "react";

const Spinner: React.FC = () => (
    <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-700" />
    </div>
);

export default Spinner;
