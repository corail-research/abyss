import React from 'react';
import {
    Container,
    Heading,
    Accordion,
    useColorModeValue,
    Box
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import LeagueAccordionItem from './LeagueAccordionItem';

import { LeagueNames, LeagueDisplayNames, useColors } from '../constants/constants.js';
import { useLocalized } from '../constants/languages.js';
import { getGroupLevd } from '../api/groups/groups.ts';

const IS_FREEZE = import.meta.env.VITE_FREEZE === '1';
const MAX_STALE_TIME = 5 * 60 * 1000;

const fetchGroupLeaderboard = async () => {
    if (IS_FREEZE) {
        const response = await fetch('/api/groups/levd.json');
        if (!response.ok) throw new Error('Failed to load frozen data');
        return response.json();
    }
    return await getGroupLevd();
};

const Leaderboard = () => {
    const textColor = useColorModeValue('black', 'gray.300');
    const colors = useColors();
    const { t } = useTranslation('leaderboard');
    const localize = useLocalized();

    const { data: groups = [], isLoading, error, } = useQuery({
        queryKey: ['groups', 'leaderboard'],
        queryFn: fetchGroupLeaderboard,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 2,
    });

    if (isLoading) return <Loading />;
    if (error) return <ErrorMessage message={t('loadError')} />;
    if (groups.length === 0) return <ErrorMessage message={t('noData')} />;

    const leaguesGroups = {};
    LeagueNames.slice()
        .reverse()
        .forEach((name) => {
            leaguesGroups[name] = groups
                .filter(group => group.league === name)
                .sort((a, b) => b.elo - a.elo);
        });

    return (
        <Container maxW={'7xl'} padding={{ base: 2, md: 5 }}>
            <Heading as="h1" size="xl" color={colors.headingColor} mb={6} textAlign={'center'}>
                {t('title')}
            </Heading>
            <Box maxW="5xl" mx="auto" p={{ base: 2, md: 5 }}>
                <Accordion allowMultiple>
                    {Object.keys(leaguesGroups).map((league, index) => (
                        <LeagueAccordionItem
                            key={league}
                            id={league}
                            league={localize(LeagueDisplayNames[league])}
                            index={index}
                            leagueGroups={leaguesGroups[league]}
                            textColor={textColor}
                        />
                    ))}
                </Accordion>
            </Box>
        </Container>
    );
};

export default Leaderboard;
