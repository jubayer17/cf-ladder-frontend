import React, { useState } from "react";
import { useAppContext } from "../context/AppContext";

const InputHandler: React.FC = () => {
  const [input, setInput] = useState("");
  const { userInfo, loadingUser, setHandleAndFetch, clearUser } = useAppContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      await setHandleAndFetch(input.trim());
      setInput("");
    }
  };

  const getRatingColor = (rating?: number) => {
    if (!rating) return "text-gray-600";
    if (rating < 1200) return "text-gray-600";
    if (rating < 1400) return "text-green-600";
    if (rating < 1600) return "text-cyan-600";
    if (rating < 1900) return "text-blue-600";
    if (rating < 2100) return "text-purple-600";
    if (rating < 2300) return "text-orange-500";
    if (rating < 2400) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter Codeforces handle"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          disabled={loadingUser}
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center"
          disabled={loadingUser || !input.trim()}
        >
          {loadingUser ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
              Loading
            </>
          ) : (
            "Submit"
          )}
        </button>
      </form>

      {loadingUser && (
        <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-600"></div>
          <div className="flex flex-col gap-2 flex-1">
            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
            <div className="flex gap-2">
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
            </div>
          </div>
        </div>
      )}

      {userInfo && !loadingUser && (
        <div
          className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 animate-fade-in"
          style={{
            animation: "fadeIn 0.3s ease-in"
          }}
        >
          <style jsx>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(-10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .animate-fade-in {
              animation: fadeIn 0.3s ease-in;
            }
          `}</style>
          <img
            src={userInfo.titlePhoto}
            alt={userInfo.handle}
            className="w-16 h-16 rounded-full border-2 border-gray-300 dark:border-gray-600"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "https://userpic.codeforces.org/no-title.jpg";
            }}
          />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-lg ${getRatingColor(userInfo.rating)}`}>
                {userInfo.handle}
              </span>
              {userInfo.rank && (
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                  {userInfo.rank}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              {userInfo.rating !== undefined && (
                <span className={`font-semibold ${getRatingColor(userInfo.rating)}`}>
                  Rating: {userInfo.rating}
                </span>
              )}
              {userInfo.maxRating !== undefined && (
                <span className={`font-medium ${getRatingColor(userInfo.maxRating)}`}>
                  Max: {userInfo.maxRating}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={clearUser}
            className="ml-auto px-3 py-1 text-sm rounded bg-red-500 text-white hover:bg-red-600 transition"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default InputHandler;
