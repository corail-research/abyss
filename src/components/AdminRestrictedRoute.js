import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PropTypes } from 'prop-types';
import { useToast } from '@chakra-ui/react';

import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';
import Loading from './Loading.js';


const AdminRestrictedRoute = ({ element }) => {
    const { isAdmin, isAdminLoading, isLoading, wasConnected } = useAuth();
    const { t } = useTranslation('protectedRoute');
    const toast = useToast();

    useEffect(() => {
        if (!isLoading && !isAdminLoading && !isAdmin && wasConnected) {
            toast({
                title: t('sessionExpired'),
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    }, [isLoading, isAdminLoading, isAdmin, wasConnected, toast, t]);

    if (isLoading || isAdminLoading) return <Loading fullPage />;
    if (isAdmin) return element;

    return <Navigate to="/" />;
}

AdminRestrictedRoute.propTypes = {
    element: PropTypes.object.isRequired
}
export default AdminRestrictedRoute;
