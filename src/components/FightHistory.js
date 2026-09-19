import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Text,
    VStack,
    Button,
    Center
} from '@chakra-ui/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useColorModeValue } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import FightCard from './FightCard.js';
import ErrorMessage from './ErrorMessage.js';
import Loading from './Loading.js'
import SearchBar from './SearchBar.js';
import FightCardSkeleton from './skeletons/FightCardSkeleton';

import { getFightCollection } from '../api/fights/fights.ts';
import { FightStatus, useColors } from '../constants/constants.js';
import { useDelayedFlag } from '../hooks/useDelayedFlag';

const IS_FREEZE = import.meta.env.VITE_FREEZE === '1';
const PAGE_SIZE = 20;
const MAX_STALE_TIME = 30 * 1000;
const MAX_GC_TIME = 5 * 60 * 1000;

const fetchFightsPage = async ({ pageParam = 1, status }) => {
    const params = {
        page: pageParam,
        limit: PAGE_SIZE,
        status,
    };

    if (IS_FREEZE) {
        const response = await fetch(
            `/api/fights/${status}/${PAGE_SIZE}/${pageParam}/index.json`
        );
        if (!response.ok) throw new Error(`Failed to load ${status} fights`);
        const json = await response.json();

        const sorted = json.sort((a, b) =>
            status === FightStatus.SCHEDULED
                ? new Date(a.scheduled_date) - new Date(b.scheduled_date)
                : new Date(b.date) - new Date(a.date)
        );

        return {
            data: sorted,
            nextPage: sorted.length === PAGE_SIZE ? pageParam + 1 : undefined,
        };
    }
    const response = await getFightCollection(params, {
        headers: {
            "X-Fields":
                "id,date,scheduled_date,score_player1,score_player2," +
                "player1{name,group{id,name},elo,id,custom_stats{name,value}}," +
                "player2{name,group{id,name},elo,id,custom_stats{name,value}}"
        },
    });

    const sorted = response.sort((a, b) =>
        status === FightStatus.SCHEDULED
            ? new Date(a.scheduled_date) - new Date(b.scheduled_date)
            : new Date(b.date) - new Date(a.date)
    );

    return {
        data: sorted,
        nextPage: sorted.length === PAGE_SIZE ? pageParam + 1 : undefined,
    };
};

const FightHistory = ({ status, groups, selected }) => {
    const textColor = useColorModeValue('teal.500', 'teal.300');
    const buttonColorScheme = useColorModeValue('pink', 'purple');
    const colors = useColors();
    const [searchTerm, setSearchTerm] = useState('');
    const { t } = useTranslation('fightPage');

    const getTitle = (status) => {
        switch (status) {
            case FightStatus.DONE:
                return t('titleDone');
            case FightStatus.SCHEDULED:
                return t('titleScheduled');
            case FightStatus.IN_PROGRESS:
                return t('titleInProgress');
            case FightStatus.CANCELLED:
                return t('titleCancelled');
            default:
                return '';
        }
    };

    const {
        data,
        isLoading,
        isFetchingNextPage,
        error,
        hasNextPage,
        fetchNextPage,
        refetch
    } = useInfiniteQuery({
        queryKey: ['fights', status],
        queryFn: ({ pageParam = 1 }) => fetchFightsPage({ pageParam, status }),
        getNextPageParam: (lastPage) => lastPage.nextPage,
        initialPageParam: 1,
        enabled: selected,
        staleTime: MAX_STALE_TIME,
        refetchOnReconnect: true,
        gcTime: MAX_GC_TIME,
        retry: 1,
    });

    // Pages array
    const allFights = useMemo(() => {
        if (!data) return [];
        return data.pages.flatMap((page) => page.data);
    }, [data]);

    const enrichedFights = useMemo(() => {
        if (!allFights || !groups) return allFights;
        return allFights.map((fight) => {
            const p1GroupStats = groups[fight.player1.group.id];
            const p2GroupStats = groups[fight.player2.group.id];

            const p1Stats = p1GroupStats?.agents?.find(
                (a) => a.id === fight.player1.id
            );
            const p2Stats = p2GroupStats?.agents?.find(
                (a) => a.id === fight.player2.id
            );

            return {
                ...fight,
                player1: {
                    ...fight.player1,
                    n_victories: p1Stats?.n_victories ?? fight.player1.n_victories,
                    n_defeats: p1Stats?.n_defeats ?? fight.player1.n_defeats,
                    n_points_scored: p1Stats?.n_points_scored ?? fight.player1.n_points_scored,
                    n_points_conceded: p1Stats?.n_points_conceded ?? fight.player1.n_points_conceded,
                    custom_stats: fight.player1.custom_stats || [],
                },
                player2: {
                    ...fight.player2,
                    n_victories: p2Stats?.n_victories ?? fight.player2.n_victories,
                    n_defeats: p2Stats?.n_defeats ?? fight.player2.n_defeats,
                    n_points_scored: p2Stats?.n_points_scored ?? fight.player2.n_points_scored,
                    n_points_conceded: p2Stats?.n_points_conceded ?? fight.player2.n_points_conceded,
                    custom_stats: fight.player2.custom_stats || [],
                },
            };
        });
    }, [allFights, groups]);

    // Search filter
    const filteredFights = useMemo(() => {
        if (!searchTerm.trim()) return enrichedFights;
        const term = searchTerm.toLowerCase().trim();
        return enrichedFights.filter(
            (fight) =>
                fight.player1.group.name.toLowerCase().includes(term) ||
                fight.player2.group.name.toLowerCase().includes(term)
        );
    }, [enrichedFights, searchTerm]);

    useEffect(() => {
        if (selected) {
            refetch();
        }
    }, [selected, refetch]);

    const showSkeleton = useDelayedFlag(isLoading, 150);

    if (error) return <ErrorMessage message={t('loadError')} />;
    if (isLoading) return (
        <Box minHeight="100vh" maxW={'7xl'} bg={colors.panelBg}>
            <Box maxW={'5xl'} mx="auto">
                <Text fontSize="4xl" fontWeight="bold" textAlign="center" mb={6} color={textColor}>
                    {getTitle(status)}
                </Text>
                <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                <Box minH="600px">
                    {showSkeleton && (
                        <VStack spacing={6} animation="fadeIn 0.2s ease-in">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <FightCardSkeleton key={i} />
                            ))}
                        </VStack>
                    )}
                </Box>
            </Box>
        </Box>
    );

    // Empty state
    if (!enrichedFights.length) {
        return (
            <Box minHeight="100vh" maxW={'7xl'} bg={colors.panelBg}>
                <Box maxW={'5xl'} mx="auto" >
                    <Text fontSize="4xl" fontWeight="bold" textAlign="center" mb={6} color={textColor}>
                        {getTitle(status)}
                    </Text>
                    <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                    <Text textAlign="center" mt={8} color="gray.500">
                        {t('noFightsFound')}
                    </Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box minHeight="100vh" maxW={'7xl'} bg={colors.panelBg}>
            <Box maxW={'5xl'} mx="auto" >
                <Text fontSize="4xl" fontWeight="bold" textAlign="center" mb={6} color={textColor}>
                    {getTitle(status)}
                </Text>
                <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
                <VStack spacing={6}>
                    {filteredFights.map((fight) => (
                        <FightCard
                            key={fight.id}
                            fightData={fight}
                            status={status}
                        />
                    ))}
                </VStack>

                {isFetchingNextPage && <Loading size="md" minHeight="60px" />}

                {hasNextPage && !isFetchingNextPage && (
                    <Center>
                        <Button
                            mt={4}
                            colorScheme={buttonColorScheme}
                            onClick={() => fetchNextPage()}
                            isDisabled={isFetchingNextPage}
                        >
                            {t('loadMore')}
                        </Button>
                    </Center>
                )}
            </Box>
        </Box>
    );
};

FightHistory.propTypes = {
    status: PropTypes.oneOf([
        FightStatus.CANCELLED,
        FightStatus.DONE,
        FightStatus.IN_PROGRESS,
        FightStatus.SCHEDULED
    ]).isRequired,
    groups: PropTypes.object.isRequired,
    selected: PropTypes.bool.isRequired
}

FightHistory.displayName = 'FightHistory';

export default FightHistory;
