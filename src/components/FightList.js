import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import {
    Box, HStack, VStack, Button, Menu, MenuButton,
    MenuList, MenuItem, MenuOptionGroup, MenuItemOption,
    MenuDivider, Flex, Text, Badge
} from '@chakra-ui/react';
import { DownloadIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';


import Pagination from './Pagination';
import FightCard from './FightCard';
import ErrorPopup from './ErrorPopup';
import FightListSkeleton from './skeletons/FightListSkeleton.js';

import { FightStatus, useColors } from '../constants/constants.js';
import {
    getFightGroup, getCountFightGroup,
    getFightItemLog, getFightItemJson
} from '../api/fights/fights.ts';
import { useAuth } from '../context/AuthContext.jsx';
import { useDelayedFlag } from '../hooks/useDelayedFlag.js';

const MAX_STALE_TIME = 30 * 1000;

const buildParams = (status, page, limit, agentIds, victoryFilter) => {
    const params = {
        paginate: 'true',
        page: page + 1,
        limit,
        status,
    };

    if (agentIds.length > 0) {
        params.agent_ids = agentIds.join(',');
    }
    if (victoryFilter !== 'all') {
        params.victory = victoryFilter === 'victory' ? 'true' : 'false';
    }

    return params;
}



const FightList = ({ myAgents, status, groups, selected }) => {
    const colors = useColors();
    const { authState } = useAuth();
    const { t } = useTranslation('fightList');

    const [currentPage, setCurrentPage] = useState(0);
    const [selectedAgents, setSelectedAgents] = useState([]);
    const [victoryFilter, setVictoryFilter] = useState('all'); // 'all', 'victory', 'defeat'

    const [errorMessage, setErrorMessage] = useState('');
    const [showError, setShowError] = useState(false);

    const fightsPerPage = 5;
    const groupId = authState.student?.group_id;

    // fetch fights
    // TODO: Use refetch and isFetching to create a Refresh button on the list
    const {
        data: fights = [],
        isLoading: fightsLoading,
        error: fightsError,
    } = useQuery({
        queryKey: [
            'fights',
            'group',
            groupId,
            status,
            currentPage,
            selectedAgents,
            victoryFilter,
        ],
        queryFn: async () => {
            const params = buildParams(status, currentPage, fightsPerPage, selectedAgents, victoryFilter);
            const response = await getFightGroup(groupId, params);
            return response || [];
        },
        enabled: selected && !!groupId,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1
    });

    // count total fights
    const {
        data: totalFights = -1,
        isLoading: countLoading,
        error: countError,
    } = useQuery({
        queryKey: [
            'fights',
            'count',
            groupId,
            status,
            selectedAgents,
            victoryFilter,
        ],
        queryFn: async () => {
            const params = buildParams(status, 0, 1, selectedAgents, victoryFilter);
            const count = await getCountFightGroup(groupId, params);
            return count ?? 0;
        },
        enabled: selected && !!groupId,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1
    });


    // combine
    const isLoading = fightsLoading || countLoading || (selected && !fights && totalFights === -1);
    const error = fightsError || countError;

    const handleShowError = () => {
        setShowError(true);
        setErrorMessage(t('downloadError'));
    };

    const handleCloseError = () => {
        setShowError(false);
        setErrorMessage('');
    };

    const handlePageClick = (selectedPage) => {
        setCurrentPage(selectedPage);
    };

    const handleAgentSelect = (agentId) => {
        setCurrentPage(0);
        setSelectedAgents(prev => {
            // If the agent is already selected, remove it
            if (prev.includes(agentId)) {
                return prev.filter(id => id !== agentId);
            }
            // Sinon on l'ajoute
            return [...prev, agentId];
        });
    };

    const handleVictoryFilterChange = (value) => {
        setVictoryFilter(value);
        setCurrentPage(0);
    };

    const downLoadJson = useCallback(async (fightId) => {
        try {
            const response = await getFightItemJson(fightId);
            const blob = new Blob([JSON.stringify(response)], { type: 'application/json' });
            saveAs(blob, `fight_${fightId}.json`);
        } catch (error) {
            handleShowError();
        }
    }, [handleShowError]);

    const downLoadLog = useCallback(async (fightId) => {
        try {
            const response = await getFightItemLog(fightId);
            console.log(response);
            const blob = new Blob([response]);
            saveAs(blob, `fight_${fightId}.log`);
        } catch (error) {
            handleShowError();
        }
    }, [handleShowError]);

    const downloadAllJson = useCallback(async () => {
        try {
            const responseFights = await getFightGroup(groupId, { status: "done" });
            const zip = new JSZip();

            const promises = responseFights.map(async (fight) => {
                try {
                    const json = await getFightItemJson(fight.id);
                    zip.file(`fight_${fight.id}.json`, JSON.stringify(json));
                } catch (error) { undefined }
            });

            await Promise.all(promises);

            const content = await zip.generateAsync({ type: 'blob' })
            saveAs(content, 'fights.zip');
        } catch {
            handleShowError();
        }
    }, [groupId, handleShowError]);

    const filters = useMemo(() => (
        <Flex
            width="100%"
            justifyContent="center"
            gap={4}
            flexWrap="wrap"
            direction={{ base: "column", md: "row", lg: "row" }}
            align="center"
        >
            <Menu closeOnSelect={false}>
                <MenuButton
                    as={Button}
                    rightIcon={<ChevronDownIcon />}
                    colorScheme="teal"
                    width={{ base: "200px", md: "auto" }}
                >
                    {t('filterByAgents')} {selectedAgents.length > 0 && (
                        <Badge
                            ml={2}
                            colorScheme="blue"
                            variant={"solid"}
                        >
                            {selectedAgents.length}
                        </Badge>
                    )}
                </MenuButton>
                <MenuList minWidth="240px">
                    <MenuItem onClick={() => { setSelectedAgents([]); setCurrentPage(0); }}>
                        {t('allAgents')}
                    </MenuItem>
                    <MenuDivider />
                    <MenuOptionGroup title={t('myAgents')} type="checkbox" value={selectedAgents.map(id => id.toString())}>
                        {myAgents.map(agent => (
                            <MenuItemOption
                                key={agent.id}
                                value={agent.id.toString()}
                                onClick={() => handleAgentSelect(agent.id)}
                            >
                                {agent.name}
                            </MenuItemOption>
                        ))}
                    </MenuOptionGroup>
                </MenuList>
            </Menu>
            {status === FightStatus.DONE && (
                <Menu closeOnSelect={true}>
                    <MenuButton
                        as={Button}
                        rightIcon={<ChevronDownIcon />}
                        colorScheme="blue"
                        width={{ base: "200px", md: "auto" }}
                    >
                        {t('filterByResult')}{' '}
                        {victoryFilter === 'all' && (
                            <Badge
                                ml={2}
                                colorScheme="blue"
                                variant={"solid"}
                            >
                                {t('badgeAll')}
                            </Badge>
                        )}
                        {victoryFilter === 'victory' && (
                            <Badge
                                ml={2}
                                colorScheme="green"
                                variant={"solid"}
                            >
                                {t('badgeWins')}
                            </Badge>
                        )}
                        {victoryFilter === 'defeat' && (
                            <Badge
                                ml={2}
                                colorScheme="red"
                                variant={"solid"}
                            >
                                {t('badgeLosses')}
                            </Badge>
                        )}
                    </MenuButton>
                    <MenuList>
                        <MenuOptionGroup title={t('resultGroupTitle')} type="radio" value={victoryFilter} onChange={handleVictoryFilterChange}>
                            <MenuItemOption value="all">{t('optionAll')}</MenuItemOption>
                            <MenuItemOption value="victory">{t('optionWins')}</MenuItemOption>
                            <MenuItemOption value="defeat">{t('optionLosses')}</MenuItemOption>
                        </MenuOptionGroup>
                    </MenuList>
                </Menu>
            )}
        </Flex>
    ), [selectedAgents, victoryFilter, myAgents, status, handleAgentSelect, handleVictoryFilterChange, t]);

    const showSkeleton = useDelayedFlag(isLoading, 150);

    // loading state
    if (isLoading) {
        return (
            <>
                <ErrorPopup
                    message={errorMessage}
                    onClose={handleCloseError}
                    isOpen={showError}
                />
                <Box
                    padding={4}
                    bgColor={colors.panelBg}
                    maxW="5xl"
                    margin="auto"
                    borderRadius="lg"
                    boxShadow="xl"
                >
                    <Flex alignItems="center" flexDirection="column" gap={4}>
                        {/* Filters are rendered immediately — they don't depend on data */}
                        {filters}

                        {/* Reserve vertical space to prevent layout jump */}
                        <Box width="100%" minH="600px">
                            {showSkeleton && <FightListSkeleton rows={4} />}
                        </Box>
                    </Flex>
                </Box>
            </>
        );
    }


    // error state
    if (error) {
        return (
            <>
                <ErrorPopup message={errorMessage} onClose={handleCloseError} isOpen={showError} />
                <Box padding={4} bgColor={colors.panelBg} maxW="5xl" margin="auto" borderRadius="lg" boxShadow="xl">
                    <Flex alignItems="center" flexDirection={"column"} gap={4}>
                        {filters}
                        <Text color="red.500">{t('loadError')}</Text>
                    </Flex>
                </Box>
            </>
        );
    };

    // empty state
    if (fights.length === 0 && totalFights === 0) {
        return (
            <>
                <ErrorPopup message={errorMessage} onClose={handleCloseError} isOpen={showError} />
                <Box padding={4} bgColor={colors.panelBg} maxW="5xl" margin="auto" borderRadius="lg" boxShadow="xl">
                    <Flex alignItems="center" flexDirection={"column"} gap={4}>
                        {filters}
                        <Text color="red.500">{t('noFightsFound')}</Text>
                    </Flex>
                </Box>
            </>
        );
    }

    const totalPages = Math.ceil(totalFights / fightsPerPage);
    const myAgentIds = myAgents.map((a) => a.id);

    return (
        <>
            <ErrorPopup message={errorMessage} onClose={handleCloseError} isOpen={showError} />
            <Box padding={4} bgColor={colors.panelBg} maxW="5xl" margin="auto" borderRadius="lg" boxShadow="xl">
                <Flex alignItems="center" flexDirection={"column"} gap={4}>
                    {filters}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageClick}
                    />
                    <VStack spacing={4} width="100%" mb={4}>
                        {fights.map((fight) => (
                            <VStack key={fight.id} width="100%" spacing={3}>
                                {/* Desktop/tablet layout: HStack with buttons alongside */}
                                <HStack
                                    display={{ base: "none", md: "flex" }}
                                    width="100%"
                                    alignItems="center"
                                >
                                    <Box flex="1">
                                        <FightCard
                                            fightData={fight}
                                            myAgents={myAgentIds}
                                            status={status}
                                            groupData={groups}
                                        />
                                    </Box>
                                    {(status === FightStatus.DONE || status === FightStatus.CANCELLED) && (
                                        <VStack spacing={2}>
                                            <Button leftIcon={<DownloadIcon />} colorScheme="teal" onClick={() => downLoadJson(fight.id)} size="sm">
                                                Json
                                            </Button>
                                            <Button leftIcon={<DownloadIcon />} colorScheme="teal" onClick={() => downLoadLog(fight.id)} size="sm">
                                                Log
                                            </Button>
                                        </VStack>
                                    )}
                                </HStack>

                                {/* Mobile layout: VStack with buttons underneath */}
                                <VStack
                                    display={{ base: "flex", md: "none" }}
                                    width="100%"
                                    spacing={3}
                                    align="stretch"
                                >
                                    <Box width="100%">
                                        <FightCard
                                            fightData={fight}
                                            myAgents={myAgentIds}
                                            status={status}
                                            groupData={groups}
                                        />
                                    </Box>
                                    {(status === FightStatus.DONE || status === FightStatus.CANCELLED) && (
                                        <HStack spacing={3} justify="center" width="100%">
                                            <Button leftIcon={<DownloadIcon />} colorScheme="teal" onClick={() => downLoadJson(fight.id)} size="sm" flex="1" maxW="150px">
                                                Json
                                            </Button>
                                            <Button leftIcon={<DownloadIcon />} colorScheme="teal" onClick={() => downLoadLog(fight.id)} size="sm" flex="1" maxW="150px">
                                                Log
                                            </Button>
                                        </HStack>
                                    )}
                                </VStack>
                            </VStack>
                        ))}
                    </VStack>
                    {(status === FightStatus.DONE || status === FightStatus.CANCELLED) && (
                        <HStack justifyContent="center" alignItems="center" width={"100%"} mt={4}>
                            <Button leftIcon={<DownloadIcon />} colorScheme="teal" onClick={downloadAllJson}>
                                {t('downloadAllJson')}
                            </Button>
                        </HStack>
                    )}
                </Flex>
            </Box>
        </>
    );
};

export default FightList;


FightList.propTypes = {
    myAgents: PropTypes.array.isRequired,
    status: PropTypes.oneOf([
        FightStatus.CANCELLED,
        FightStatus.DONE,
        FightStatus.IN_PROGRESS,
        FightStatus.SCHEDULED
    ]).isRequired,
    groups: PropTypes.object.isRequired,
    selected: PropTypes.bool.isRequired
}
