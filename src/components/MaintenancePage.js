import React from 'react';
import { Box, Heading, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

const MaintenancePage = () => {
    const { t } = useTranslation('maintenancePage');

    return (
        <Box textAlign="center" mt="20">
            <Heading size="xl" mb="4">{t('title')}</Heading>
            <Text fontSize="lg" mt={20}>
                {t('message')}
            </Text>
        </Box>
    );
};

export default MaintenancePage;
