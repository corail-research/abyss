import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabList, TabPanels, Tab, TabPanel, Box } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import Loading from './Loading';
import FightHistory from './FightHistory';
import ErrorMessage from './ErrorMessage';

import { getGroupMinStats } from '../api/groups/groups.ts'
import { FightStatus, useColors } from '../constants/constants';

const IS_FREEZE = import.meta.env.VITE_FREEZE === '1';
const MAX_STALE_TIME = 5 * 60 * 1000;


const fetchGroupMinStats = async () => {
    if (IS_FREEZE) {
        const response = await fetch("/api/groups/agents_min_stats.json");
        if (!response.ok) throw new Error('Failed to load frozen groups with min stats');
        const data = await response.json();
        return data.reduce((acc, group) => {
            acc[group.id] = group;
            return acc;
        }, {});
    }
    const data = await getGroupMinStats();
    return data.reduce((acc, group) => {
        acc[group.id] = group;
        return acc;
    }, {});
};

const FightPage = () => {
    const colors = useColors();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation('fightPage');

    const tabIndex = parseInt(searchParams.get('tab') || '0', 10);
    const handleTabChange = (index) => {
        setSearchParams({ tab: index });
    };

    const TAB_STATUSES = [
        { status: FightStatus.DONE, label: t('tabDone') },
        { status: FightStatus.IN_PROGRESS, label: t('tabInProgress') },
        { status: FightStatus.SCHEDULED, label: t('tabScheduled') },
        { status: FightStatus.CANCELLED, label: t('tabCancelled') },
    ]
    const {
        data: groupsMap = {},
        isLoading: groupsLoading,
        error: groupsError,
    } = useQuery({
        queryKey: ['groups', 'minStats'],
        queryFn: fetchGroupMinStats,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: true,
    });

    const tabConfig = useMemo(() => TAB_STATUSES, []);

    if (groupsLoading) return <Loading />;
    if (groupsError) return <ErrorMessage message={t('groupsLoadError')} />;

    return (
        <Box p={5} bg={colors.panelBg} minH="100vh" maxW="7xl" mx="auto" borderRadius="lg">
            <Tabs
                variant="soft-rounded"
                mt={10}
                index={tabIndex}
                onChange={handleTabChange}
                isLazy
            >
                <TabList
                    justifyContent={'center'}
                    mb={10}
                    flexWrap={{ base: 'wrap', md: 'nowrap' }}
                    gap={{ base: 2, md: 0 }}
                >
                    {tabConfig.map(({ status, label }) => (
                        <Tab
                            key={status}
                            fontWeight="bold"
                            bg={colors.tabBg}
                            color={colors.tabColor}
                            _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                            mr={{ base: 0, md: 2 }}
                            mb={{ base: 2, md: 0 }}
                            fontSize={{ base: "sm", md: "md" }}
                            px={{ base: 3, md: 4 }}
                            py={{ base: 2, md: 3 }}
                        >
                            {label}
                        </Tab>
                    ))}
                </TabList>

                <TabPanels>
                    {tabConfig.map(({ status }, index) => (
                        <TabPanel key={status}>
                            <FightHistory
                                status={status}
                                groups={groupsMap}
                                selected={tabIndex === index} />
                        </TabPanel>
                    ))}
                </TabPanels>
            </Tabs>
        </Box>
    );
}

export default FightPage;
