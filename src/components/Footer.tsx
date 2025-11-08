"use client";

import React from "react";

const Footer: React.FC = () => {
    return (
        <footer className="w-full font-mono bg-[var(--card-bg)] text-[var(--foreground)] py-10 px-4 transition-colors duration-300 ease-in-out">
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 text-center">

                <p className="text-base md:text-lg font-medium">
                    If you found this useful, you can <span className="font-semibold">give a star ✨</span> or <span className="font-semibold">follow me 🍂</span> to support!
                </p>

                {/* CTA buttons */}
                <div className="flex flex-wrap gap-4 justify-center">
                    <a
                        href="https://github.com/jubayer17"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-2 bg-yellow-400 dark:bg-yellow-500 text-gray-900 dark:text-gray-900 rounded-full font-semibold shadow-md hover:shadow-lg hover:scale-105 transform transition-all duration-300"
                    >
                        Follow me 🩵
                    </a>
                    <a
                        href="https://github.com/jubayer17/cf-ladder"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-full font-semibold shadow-md hover:shadow-lg hover:scale-105 transform transition-all duration-300"
                    >
                        Give a star ✨
                    </a>
                </div>

                {/* Bottom copyright */}
                <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
                    &copy; {new Date().getFullYear()} Jubayer Ahmed. All rights reserved.
                </p>
            </div>
        </footer>
    );
};

export default Footer;
