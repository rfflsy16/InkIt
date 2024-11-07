import axios from 'axios';
import { useState } from 'react';
import { useNavigate, Link, Outlet } from "react-router-dom";
import HomePage from './HomePage';

export default function BaseLayout({ base_url }) {
    return (
        <>
            <HomePage />
            {/* <Outlet /> */}
        </>
    );
}