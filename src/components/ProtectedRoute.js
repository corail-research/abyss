import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { useToast } from '@chakra-ui/react';
import { Navigate } from 'react-router-dom';

import Loading from './Loading.js';

import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ element }) => {
    const toast = useToast()
    const { authState, isLoading, wasConnected } = useAuth();
    const { t } = useTranslation('protectedRoute');

    useEffect(() => {
        if (!isLoading && !authState.student && wasConnected) {
            toast({
                title: t('sessionExpired'),
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    }, [isLoading, authState.student, wasConnected, toast, t]);

    if (isLoading) return <Loading fullPage />;
    if (authState.student) return element;

    return <Navigate to="/" />;
};

ProtectedRoute.propTypes = {
    element: PropTypes.element.isRequired
}

export default ProtectedRoute;
