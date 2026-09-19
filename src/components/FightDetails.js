import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import { Game } from '../config';
import Loading from './Loading';

const FREEZE = import.meta.env.VITE_FREEZE;
const API_BASE_URL = import.meta.env.VITE_ABYSS_API_URL;

const FightDetails = () => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('id');
    const { t } = useTranslation('fightDetails');
    const [iframeLoaded, setIframeLoaded] = useState(false);

    const url = useMemo(() => {
        if (!id) return null;
        const baseUrl = Game.frontURL;
        const params = new URLSearchParams({
            fightId: id,
            freeze: FREEZE,
            apiBaseUrl: API_BASE_URL,
        });

        return `${baseUrl}?${params.toString()}`;

    }, [id]);

    if (!id) {
        return <Box p={5}>{t('invalidId')}</Box>;
    }

    if (!url) {
        return (
            <Box p={5} textAlign="center">
                <Text fontSize="lg" color="red.500">
                    {t('urlNotConfigured')}
                </Text>
            </Box>
        );
    }

    return (
        <Box position="relative" w="100%" h="100vh">
            {!iframeLoaded && (
                <Box position="absolute" top={0} left={0} right={0} bottom={0} zIndex={1}>
                    <Loading fullPage />
                </Box>
            )}
            <iframe
                id='fightDetails'
                src={url}
                onLoad={() => setIframeLoaded(true)}
                style={{
                    width: '100%',
                    height: '100vh',
                    border: 'none',
                    opacity: iframeLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                }}
                title={t('iframeTitle')}
            />
        </Box>
    );
};

export default FightDetails;
