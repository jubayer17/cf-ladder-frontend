"use client"
import Navbar from '@/components/navbar/Navbar';
import { useAppContext } from '@/context/AppContext';
import React from 'react'

export default function page() {
    const {
        problems,
        tagCounts,
        unsolvedProblems,
        handle,
        userInfo,
        userSolvedSet,
        loadingProblems,
        loadingUser,
        errorProblems,
        setHandleAndFetch,
        clearUser,
    } = useAppContext();
    return (
        <div>
            <Navbar
                handle={handle ?? undefined}
                onHandleSubmit={async (h: string) => await setHandleAndFetch(h)}
                onHandleClear={() => clearUser()}
                userLoading={loadingUser}
            />
            <h3>this is the category page</h3>
        </div>
    )
}
