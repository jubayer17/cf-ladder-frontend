"use client";

import React from "react";
import { useAppContext } from "@/context/AppContext";
import Navbar from "./Navbar";

/**
 * NavbarWrapper - A client component that wraps the Navbar with AppContext
 * This ensures the navbar uses the global handle state and impacts all pages
 */
const NavbarWrapper: React.FC = () => {
    const { handle, loadingUser, setHandleAndFetch, clearUser } = useAppContext();

    return (
        <Navbar
            handle={handle ?? undefined}
            onHandleSubmit={setHandleAndFetch}
            onHandleClear={clearUser}
            userLoading={loadingUser}
        />
    );
};

export default NavbarWrapper;
