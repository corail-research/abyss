import React, { useState, useMemo } from 'react';
import {
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
    Badge,
    Text,
    HStack,
    VStack,
    Button,
    Menu,
    MenuButton,
    MenuList,
    MenuItemOption,
    MenuOptionGroup,
    MenuItem,
    MenuDivider,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import Loading from './Loading.js';

import { useColors } from '../constants/constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getAgentVsAgentStats, getOpponentAgents } from '../api/fights/fights.ts';

const MAX_STALE_TIME = 5 * 60 * 1000;

const buildStatsParams = (selectedMyAgents, selectedOpponentAgents) => {
    const params = {};
    if (selectedMyAgents.length > 0) {
        params.my_agents = selectedMyAgents.join(',');
    }
    if (selectedOpponentAgents.length > 0) {
        params.opponent_agents = selectedOpponentAgents.join(',');
    }
    return params;
};

const AgentVsAgentStats = ({ myAgents, groupId, selected }) => {
    const colors = useColors();
    const { authState } = useAuth();
    const { t } = useTranslation('agentVsAgentStats');

    const [selectedMyAgents, setSelectedMyAgents] = useState([]);
    const [selectedOpponentAgents, setSelectedOpponentAgents] = useState([]);

    const {
        data: opponentAgents = [],
        isLoading: opponentsLoading,
        error: opponentsError,
    } = useQuery({
        queryKey: ['opponentAgents', groupId],
        queryFn: async () => {
            const response = await getOpponentAgents(groupId, authState.options);
            return response || [];
        },
        enabled: selected && !!groupId && !!authState.options,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const {
        data: agentStats = [],
        isLoading: statsLoading,
        error: statsError,
    } = useQuery({
        queryKey: [
            'agentVsAgentStats',
            groupId,
            selectedMyAgents,
            selectedOpponentAgents],
        queryFn: async () => {
            const params = buildStatsParams(selectedMyAgents, selectedOpponentAgents);
            const response = await getAgentVsAgentStats(
                groupId,
                params,
                authState.options
            );
            return response || [];
        },
        enabled: selected && !!groupId && !!authState.options,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const isLoading = opponentsLoading || statsLoading;
    const error = opponentsError || statsError;

    // Handlers for the multi-select filters
    const handleMyAgentSelect = (agentId) => {
        setSelectedMyAgents((prev) => {
            if (prev.includes(agentId)) {
                return prev.filter((id) => id !== agentId);
            }
            return [...prev, agentId];
        });
    };

    const handleOpponentAgentSelect = (agentId) => {
        setSelectedOpponentAgents(prev => {
            if (prev.includes(agentId)) {
                return prev.filter(id => id !== agentId);
            }
            return [...prev, agentId];
        });
    };

    const getScoreDisplay = (wins1, wins2) => `${wins1} - ${wins2}`;

    // loading state
    if (isLoading) {
        return (
            <VStack spacing={4} py={8} justifyContent="center" alignItems="center">
                <Loading />
            </VStack>
        );
    }

    // error state
    if (error) {
        return (
            <Text color="red.500" textAlign="center" py={4}>
                {t('loadError')}
            </Text>
        );
    }

    return (
        <VStack spacing={4} align="stretch">
            {/* Filtres */}
            <HStack width="100%" justifyContent="center" gap={4} flexWrap="wrap">
                {/* Filtre Mes Agents */}
                <Menu closeOnSelect={false}>
                    <MenuButton as={Button} rightIcon={<ChevronDownIcon />} colorScheme="teal">
                        {t('myAgentsButton')}{' '}
                        {selectedMyAgents.length > 0 && (
                            <Badge
                                ml={2}
                                colorScheme="blue"
                                variant={"solid"}
                            >
                                {selectedMyAgents.length}
                            </Badge>
                        )}
                    </MenuButton>
                    <MenuList minWidth="240px">
                        <MenuItem onClick={() => setSelectedMyAgents([])}>
                            {t('allMyAgents')}
                        </MenuItem>
                        <MenuDivider />
                        <MenuOptionGroup
                            title={t('myAgentsGroupTitle')}
                            type="checkbox"
                            value={selectedMyAgents.map(id => id.toString())}
                        >
                            {myAgents.map(agent => (
                                <MenuItemOption
                                    key={agent.id}
                                    value={agent.id.toString()}
                                    onClick={() => handleMyAgentSelect(agent.id)}
                                >
                                    {agent.name}
                                </MenuItemOption>
                            ))}
                        </MenuOptionGroup>
                    </MenuList>
                </Menu>

                <Menu closeOnSelect={false}>
                    <MenuButton as={Button} rightIcon={<ChevronDownIcon />} colorScheme="blue">
                        {t('opponentsButton')}{' '}
                        {selectedOpponentAgents.length > 0 && (
                            <Badge
                                ml={2}
                                colorScheme="green"
                                bg={colors.badgeBg}
                                color={colors.badgeText}
                                variant={"solid"}
                            >
                                {selectedOpponentAgents.length}
                            </Badge>
                        )}
                    </MenuButton>
                    <MenuList minWidth="240px" maxH="300px" overflowY="auto">
                        <MenuItem onClick={() => setSelectedOpponentAgents([])}>
                            {t('allAgents')}
                        </MenuItem>
                        <MenuDivider />
                        <MenuOptionGroup title={t('opponentAgentsGroupTitle')} type="checkbox" value={selectedOpponentAgents.map(id => id.toString())}>
                            {opponentAgents.map(agent => (
                                <MenuItemOption
                                    key={agent.id}
                                    value={agent.id.toString()}
                                    onClick={() => handleOpponentAgentSelect(agent.id)}
                                >
                                    {agent.name}
                                </MenuItemOption>
                            ))}
                        </MenuOptionGroup>
                    </MenuList>
                </Menu>
            </HStack>
            {/* Desktop/tablet version: table */}
            <TableContainer
                bg={colors.bgColor}
                borderRadius="lg"
                boxShadow="md"
                display={{ base: "none", md: "block" }}
            >
                <Table variant="simple" size={{ md: "sm", lg: "md" }}>
                    <Thead>
                        <Tr>
                            <Th fontSize={{ md: "xs", lg: "sm" }} py={{ md: 3, lg: 3 }}>
                                {t('columnAgent1')}
                            </Th>
                            <Th textAlign="center" fontSize={{ md: "xs", lg: "sm" }} py={{ md: 3, lg: 3 }}>
                                {t('columnScore')}
                            </Th>
                            <Th fontSize={{ md: "xs", lg: "sm" }} py={{ md: 3, lg: 3 }}>
                                {t('columnAgent2')}
                            </Th>
                            <Th textAlign="center" fontSize={{ md: "xs", lg: "sm" }} py={{ md: 3, lg: 3 }}>
                                {t('columnWinrate')}
                            </Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {agentStats.length === 0 ? (
                            <Tr>
                                <Td colSpan={4} textAlign="center" py={8}>
                                    <Text color="gray.500" fontSize={{ md: "sm", lg: "md" }}>
                                        {t('noStats')}
                                    </Text>
                                </Td>
                            </Tr>
                        ) : (
                            agentStats.map((stat) => {
                                const winrate = stat.total_fights > 0
                                    ? ((stat.agent1_wins / stat.total_fights) * 100).toFixed(1)
                                    : '0.0';

                                return (
                                    <Tr key={`${stat.agent1.id}-${stat.agent2.id}`} _hover={{ bg: colors.lighterPanelBg }}>
                                        <Td py={{ md: 3, lg: 3 }}>
                                            <Text
                                                fontWeight="bold"
                                                fontSize={{ md: "sm", lg: "md" }}
                                                noOfLines={stat.agent1.name.length > 20 ? 2 : 1}
                                                whiteSpace="normal"
                                                wordBreak="break-all"
                                            >
                                                {stat.agent1.name}
                                            </Text>
                                        </Td>
                                        <Td textAlign="center" py={{ md: 3, lg: 3 }}>
                                            <Text
                                                fontSize={{ md: "lg", lg: "xl" }}
                                                fontWeight="bold"
                                                color={colors.darkTextColor}
                                            >
                                                {getScoreDisplay(stat.agent1_wins, stat.agent2_wins)}
                                            </Text>
                                        </Td>
                                        <Td py={{ md: 3, lg: 3 }}>
                                            <Text
                                                fontWeight="bold"
                                                fontSize={{ md: "sm", lg: "md" }}
                                                noOfLines={stat.agent2.name.length > 20 ? 2 : 1}
                                                whiteSpace="normal"
                                                wordBreak="break-all"
                                            >
                                                {stat.agent2.name}
                                            </Text>
                                        </Td>
                                        <Td textAlign="center" py={{ md: 3, lg: 3 }}>
                                            <Badge
                                                variant="outline"
                                                colorScheme={winrate >= 50 ? "green" : "red"}
                                                fontSize={{ md: "sm", lg: "md" }}
                                            >
                                                {winrate}%
                                            </Badge>
                                        </Td>
                                    </Tr>
                                );
                            })
                        )}
                    </Tbody>
                </Table>
            </TableContainer>

            {/* Mobile version: vertical cards */}
            <VStack
                spacing={3}
                display={{ base: "flex", md: "none" }}
                width="100%"
            >
                {agentStats.length === 0 ? (
                    <Text color="gray.500" textAlign="center" py={8}>
                        {t('noStats')}
                    </Text>
                ) : (
                    agentStats.map((stat) => {
                        const winrate = stat.total_fights > 0
                            ? ((stat.agent1_wins / stat.total_fights) * 100).toFixed(1)
                            : '0.0';

                        return (
                            <VStack
                                key={`${stat.agent1.id}-${stat.agent2.id}`}
                                bg={colors.bgColor}
                                borderRadius="md"
                                p={4}
                                spacing={3}
                                width="100%"
                                boxShadow="lg"
                            >
                                {/* Agent 1 */}
                                <Text
                                    fontWeight="bold"
                                    fontSize="md"
                                    textAlign="center"
                                    noOfLines={2}
                                >
                                    {stat.agent1.name}
                                </Text>

                                {/* Score et Winrate */}
                                <HStack spacing={6} justify="center">
                                    <Text
                                        fontSize="xl"
                                        fontWeight="bold"
                                        color={colors.darkTextColor}
                                    >
                                        {getScoreDisplay(stat.agent1_wins, stat.agent2_wins)}
                                    </Text>
                                    <Badge
                                        variant="outline"
                                        colorScheme={winrate >= 50 ? "green" : "red"}
                                        fontSize="sm"
                                    >
                                        {winrate}%
                                    </Badge>
                                </HStack>

                                {/* Agent 2 */}
                                <Text
                                    fontWeight="bold"
                                    fontSize="md"
                                    textAlign="center"
                                    noOfLines={2}
                                >
                                    {stat.agent2.name}
                                </Text>
                            </VStack>
                        );
                    })
                )}
            </VStack>

            {agentStats.length > 0 && (
                <Text fontSize="sm" color="gray.500" textAlign="center">
                    {t('pairsShown', { count: agentStats.length })}
                </Text>
            )}
        </VStack >
    );
};

export default AgentVsAgentStats;
