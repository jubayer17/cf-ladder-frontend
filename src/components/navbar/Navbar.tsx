"use client";
import React from "react";
import { useRouter } from "next/navigation";
import ThemeToggleButton from "./ThemeToggleButton";
import ReportBug from "./ReportBug";
import EnterHandle from "./EnterHandle";
import ApplauseCounter from "./ApplauseCounter";
import { Button } from "../ui/button";

interface NavbarProps {
  handle?: string;
  onHandleSubmit: (handle: string) => Promise<void>;
  onHandleClear: () => void;
  userLoading?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  handle,
  onHandleSubmit,
  onHandleClear,
  userLoading = false,
}) => {
  const router = useRouter();

  return (
    <header className="w-full px-6 sm:px-15 font-mono font-semibold sticky top-0 z-50 bg-[var(--card-bg)] shadow-md py-3 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-code-branch" />
        <Button className="text-2xl cursor-pointer" variant="ghost" onClick={() => router.push("/")}>CF Ladder</Button>
        <div className="flex flex-row ml-5 ">
          <Button className="cursor-pointer" variant="link" onClick={() => router.push("/contests")}>
            Contests
          </Button>
          {/* <Button className="cursor-pointer" variant="link" onClick={() => router.push("/categories")}>
            Categories
          </Button> */}
          <Button className="cursor-pointer" variant="link" onClick={() => router.push("/stats")}>
            stats
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {handle ? (
          <div className="flex items-center gap-2 px-3 py-1 border rounded-full bg-gray-100 dark:bg-gray-700">
            <button
              onClick={() => onHandleSubmit(handle)}
              className="font-medium dark:text-white cursor-pointer hover:underline flex items-center gap-2"
              disabled={userLoading}
            >
              {handle}
              {userLoading && (
                <svg
                  className="w-4 h-4 animate-spin text-gray-600"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-25"
                  />
                  <path
                    d="M22 12a10 10 0 00-10-10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
            <button
              className="text-red-500 font-bold ml-1"
              onClick={onHandleClear}
            >
              ✕
            </button>
          </div>
        ) : (
          <EnterHandle
            onSubmitHandle={onHandleSubmit}
            onClear={onHandleClear}
            isLoading={userLoading}
          />
        )}

        <ThemeToggleButton />
        <ReportBug />
        <ApplauseCounter />
      </div>
    </header >
  );
};

export default Navbar;
