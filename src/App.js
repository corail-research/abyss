import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ChakraProvider, theme, ColorModeScript } from '@chakra-ui/react';

import './css/global.css';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ModalProvider } from "./context/ModalContext";
import AdminRestrictedRoute from "./components/AdminRestrictedRoute";

// lazy loadings
import Loading from './components/Loading';

const Home = lazy(() => import('./components/Home'));
const Profile = lazy(() => import('./components/Profile'));
const FightDetails = lazy(() => import('./components/FightDetails'));
const LeaderBoard = lazy(() => import('./components/Leaderboard'));
const FightPage = lazy(() => import("./components/FightPage"));
const Palmares = lazy(() => import('./components/Palmares'));
const RulesDisplay = lazy(() => import("./components/RulesDisplay"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const NotFoundPage = lazy(() => import("./components/NotFoundPage"));

// import MaintenancePage from "./components/MaintenancePage";

function App() {

    return (
        <ChakraProvider theme={theme}>
            <ColorModeScript initialColorMode={theme.config.initialColorMode} />
            <AuthProvider>
                <ModalProvider>
                    <Router>
                        <Navbar />
                        <Suspense fallback={<Loading fullPage />}>
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/profile" element={<ProtectedRoute element={<Profile />} />} />
                                <Route path="/fight" element={<FightDetails />} />
                                <Route path="/leaderboard" element={<LeaderBoard />} />
                                <Route path="/fights" element={<FightPage />} />
                                <Route path="/palmares" element={<Palmares />} />
                                <Route path="/rules" element={<RulesDisplay />} />
                                <Route path="/admin" element={<AdminRestrictedRoute element={<AdminDashboard />} />} />
                                <Route path="*" element={<NotFoundPage />} />
                                {/* <Route path="*" element={<MaintenancePage />} /> */}
                            </Routes>
                        </Suspense>
                        <Footer />
                    </Router>
                </ModalProvider>
            </AuthProvider>
        </ChakraProvider>
    );
}

export default App;
