import { useState, useEffect } from 'react';
import { Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import { useColors } from '../constants/constants';

function LoadingDots() {
    const [dots, setDots] = useState('');
    const colors = useColors();
    const { t } = useTranslation('loadingDots');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots((prevDots) => (prevDots.length < 3 ? prevDots + '.' : ''));
        }, 500);

        return () => clearInterval(interval);
    }, []);

    return (
        <Text fontSize="2xl" color={colors.blackTextColor} fontWeight="bold">
            {t('inProgress')}{dots}
        </Text>
    );
}

export default LoadingDots;
