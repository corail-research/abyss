import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Cookies from 'js-cookie';

import { deleteStudentLogout, postStudentLogin, postStudentConnected, getStudentAdminCheck } from '../api/students/students.ts';
import ErrorPopup from '../components/ErrorPopup.jsx';
import SuccessPopup from '../components/SuccessPopup.jsx';
import Loading from '../components/Loading.js';

const AuthContext = createContext();

const IS_FREEZE = import.meta.env.VITE_FREEZE === '1'
const MAX_STALE_TIME = 5 * 60 * 1000

export const AuthProvider = ({ children }) => {
    const [wasConnected, setWasConnected] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showError, setShowError] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const { t } = useTranslation('auth');

    const queryClient = useQueryClient();

    const { data: authData, isLoading } = useQuery({
        queryKey: ['auth'],
        queryFn: async () => {
            if (IS_FREEZE) {
                return { student: null, options: null };
            }

            try {
                const options = {
                    credentials: 'same-origin',
                    headers: { 'X-CSRF-TOKEN': Cookies.get('csrf_access_token') },
                }
                const response = await postStudentConnected(options);
                if (response.connected) {
                    return { student: response.identity, options };
                } else {
                    Cookies.remove('csrf_access_token');
                }
            } catch {
                Cookies.remove('csrf_access_token');
            }
            return { student: null, options: null };
        },
        staleTime: MAX_STALE_TIME,
        refetchInterval: MAX_STALE_TIME,
        refetchIntervalInBackground: false,
        retry: 1,
    });

    useEffect(() => {
        if (authData?.student) {
            setWasConnected(true);
        }
    }, [authData]);

    const { data: isAdmin = false, isLoading: isAdminLoading } = useQuery({
        queryKey: ['admin', authData?.student?.id],
        queryFn: async () => {
            if (!authData?.student || authData.student.role !== 'admin') return false;
            const response = await getStudentAdminCheck(authData.options);
            return response.is_admin;
        },
        enabled: !!authData?.student && authData.student.role === 'admin',
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
    });

    const loginMutation = useMutation({
        mutationFn: ({ student_id, password }) => postStudentLogin({ id: student_id, password }),
        onSuccess: (_) => {
            queryClient.invalidateQueries({ queryKey: ['auth'] });
            setWasConnected(true);
            setSuccessMessage(t('loginSuccess'));
            setShowSuccess(true);
        },
        onError: (_) => {
            setErrorMessage(t('loginError'));
            setShowError(true);
        },
    });

    const login = useCallback((student_id, password) => {
        loginMutation.mutate({ student_id, password });
    }, [loginMutation]);

    const logout = useCallback(async () => {
        if (authData?.options) {
            await deleteStudentLogout(authData.options);
        }
        // Invalidate the cache to force a re-fetch
        await queryClient.invalidateQueries({ queryKey: ['auth'] });
        // Reset to null manually while refetching
        queryClient.removeQueries({ queryKey: ['auth'] });
        setWasConnected(false);
    }, [authData, queryClient]);

    const value = useMemo(() => ({
        authState: {
            student: authData?.student ?? null,
            options: authData?.options ?? null,
        },
        login,
        logout,
        isAdmin,
        isLoading,
        isAdminLoading,
        isLoginPending: loginMutation.isPending,
        loginSuccess: loginMutation.isSuccess,
        wasConnected,
    }), [authData, isAdmin, isLoading, isAdminLoading, loginMutation.isPending,
        loginMutation.isSuccess, wasConnected, login, logout]);

    if (isLoading) return <Loading fullPage />;

    return (
        <AuthContext.Provider value={value}>
            <ErrorPopup message={errorMessage} onClose={() => setShowError(false)} isOpen={showError} />
            <SuccessPopup message={successMessage} onClose={() => setShowSuccess(false)} isOpen={showSuccess} />
            {children}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.element.isRequired
}

export const useAuth = () => useContext(AuthContext);
