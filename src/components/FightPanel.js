import React, { useState, useCallback, Fragment } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Input,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
    HStack,
    IconButton,
    useToast,
    Select,
    Button
} from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EditIcon, CheckIcon, CloseIcon, DeleteIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';

import Pagination from './Pagination.js';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

import { getFightCollection, patchFightItem, deleteFightItem, getCountFights } from '../api/fights/fights.ts';
import { getAgentCollection } from '../api/agents/agents.ts';
import { CustomStatsInfos } from '../config.js';
import { FightStatus, useColors } from '../constants/constants.js';
import { useLocalized } from '../constants/languages.js';
import { useAuth } from '../context/AuthContext.jsx';

const FIGHTS_PER_PAGE = 100;
const MAX_STALE_TIME = 5 * 60 * 1000;
const FIGHTS_MAX_STALE_TIME = 30 * 1000;

const FightPanel = ({ selected }) => {
    const [editFightId, setEditFightId] = useState(null);
    const [editFightData, setEditFightData] = useState({});
    const [currentPage, setCurrentPage] = useState(0);
    const [inputPage, setInputPage] = useState('');
    const { t } = useTranslation('fightPanel');
    const localize = useLocalized();

    const toast = useToast();
    const colors = useColors();
    const { authState } = useAuth();
    const queryClient = useQueryClient();

    const {
        data: agents = {},
        isLoading: agentsLoading,
        error: agentsError,
    } = useQuery({
        queryKey: ['admin', 'agents', 'id,group{name,id},name'],
        queryFn: async () => {
            const response = await getAgentCollection({}, { headers: { "X-Fields": "id,group{name,id},name" } });
            const agentsData = response.reduce((acc, agent) => {
                acc[agent.id] = agent;
                return acc;
            }, {});
            return agentsData;
        },
        enabled: selected && !!authState?.options,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const {
        data: totalFights = -1,
        isLoading: countLoading,
        error: countError,
    } = useQuery({
        queryKey: ['admin', 'fights', 'count'],
        queryFn: async () => await getCountFights(),
        enabled: selected,
        staleTime: FIGHTS_MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const {
        data: fights = [],
        isLoading: fightsLoading,
        error: fightsError,
    } = useQuery({
        queryKey: ['admin', 'fights', currentPage],
        queryFn: async () => {
            const response = await getFightCollection(
                { paginate: true, page: currentPage + 1, limit: FIGHTS_PER_PAGE },
                { headers: { "X-Fields": "id,player1_id,player2_id,winner_id,status,score_player1,score_player2,custom_stats" } }
            );
            return response;
        },
        enabled: selected && totalFights > 0,
        staleTime: FIGHTS_MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
        placeholderData: (previousData) => previousData,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => patchFightItem(id, data, authState.options),
        onSuccess: () => {
            toast({ title: t('updated'), status: 'success', duration: 5000, isClosable: true });
            setEditFightId(null);
            setEditFightData({});
            queryClient.invalidateQueries({ queryKey: ['admin', 'fights'] });
        },
        onError: () => {
            toast({ title: t('updateError'), status: 'error', duration: 5000, isClosable: true });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => deleteFightItem(id, authState.options),
        onSuccess: () => {
            toast({ title: t('deleted'), status: 'success', duration: 5000, isClosable: true });
            queryClient.invalidateQueries({ queryKey: ['admin', 'fights'] });
        },
        onError: () => {
            toast({ title: t('deleteError'), status: 'error', duration: 5000, isClosable: true });
        },
    });

    const handleUpdate = useCallback((id) => {
        const data = { ...editFightData };
        if (data.winner_id === '') data.winner_id = null;
        updateMutation.mutate({ id, data });
    }, [editFightData, updateMutation]);

    const handleDelete = useCallback((id) => {
        deleteMutation.mutate(id);
    }, [deleteMutation]);

    const startEditing = (fight) => {
        const { player1, player2, group, ...editableFields } = fight;
        setEditFightId(fight.id);
        setEditFightData(editableFields);
        if (!editableFields.custom_stats) {
            setEditFightData(prev => ({ ...prev, custom_stats: [] }));
        }
    }

    const cancelEditing = () => {
        setEditFightId(null);
        setEditFightData({});
    };

    const confirmEditing = useCallback(() => {
        if (editFightId) handleUpdate(editFightId);
    }, [editFightId, handleUpdate]);

    const handlePageClick = (selectedPage) => {
        setCurrentPage(selectedPage);
        setInputPage('');
    };

    const totalPages = Math.ceil(totalFights / FIGHTS_PER_PAGE);

    const handleDirectPageChange = useCallback(() => {
        const pageNumber = parseInt(inputPage, 10) - 1;
        if (!isNaN(pageNumber) && pageNumber >= 0 && pageNumber < totalPages) {
            setCurrentPage(pageNumber);
            setInputPage('');
        } else {
            toast({
                title: t('invalidPage'),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    }, [inputPage, totalPages, toast, t]);

    const isLoading = agentsLoading || countLoading || fightsLoading;
    const error = agentsError || countError || fightsError;

    if (isLoading) return <Loading />;
    if (error) return <ErrorMessage message={t('loadError')} />;

    return (
        <Box p={{ base: 0, sm: 0, md: 5 }} bg={colors.panelBg} borderRadius="md" mx="auto" w="100%" boxShadow="lg">
            <HStack justifyContent="space-between" alignItems="center">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(index) => handlePageClick(index)}
                />
                <HStack>
                    <Input
                        placeholder={t('pagePlaceholder')}
                        value={inputPage}
                        onChange={(e) => setInputPage(e.target.value)}
                        width="100px"
                        borderColor="cyan.600"
                        focusBorderColor="cyan.400"
                    />
                    <Button colorScheme="teal" onClick={handleDirectPageChange} size={{ base: "sm", md: "md" }}>
                        {t('goButton')}
                    </Button>
                </HStack>
            </HStack>
            {/* TODO: better display whe more than one customstats (selector?) */}
            <Table bgColor={colors.tabBg} mt={5} borderRadius="md" boxShadow="md" size={{ base: "sm", md: "md" }}>
                <Thead>
                    {/* Desktop version - single row */}
                    <Tr display={{ base: "none", md: "none", lg: "table-row" }}>
                        <Th>{t('colId')}</Th>
                        <Th>{t('colStatus')}</Th>
                        <Th>{t('colAgent1')}</Th>
                        <Th>{t('colAgent2')}</Th>
                        <Th>{t('colWinner')}</Th>
                        <Th width="80px" fontSize="sm">{t('colScoreAgent1')}</Th>
                        <Th width="80px" fontSize="sm">{t('colScoreAgent2')}</Th>
                        {CustomStatsInfos.map((info) => (
                            <Fragment key={info.key}>
                                <Th key={info.key + '1'} width="70px" fontSize="xs">{localize(info.title)} {t('colAgent1')}</Th>
                                <Th key={info.key + '2'} width="70px" fontSize="xs">{localize(info.title)} {t('colAgent2')}</Th>
                            </Fragment>
                        ))}
                        <Th>{t('colActions')}</Th>
                    </Tr>

                    {/* Mobile version - First row: ID, Status, Winner */}
                    <Tr display={{ base: "table-row", md: "none", lg: "none" }}>
                        <Th fontSize="2xs" width="33.33%" p={1}>{t('colId')}</Th>
                        <Th fontSize="2xs" width="33.33%" p={1}>{t('colStatus')}</Th>
                        <Th fontSize="2xs" width="33.33%" p={1}>{t('colWinner')}</Th>
                    </Tr>

                    {/* Mobile version - Second row: Agent 1, Agent 2 */}
                    <Tr display={{ base: "table-row", md: "none", lg: "none" }}>
                        <Th fontSize="2xs" width="33.33%" p={1}>{t('colAgent1')}</Th>
                        <Th fontSize="2xs" width="33.33%" p={1}>{t('colAgent2')}</Th>
                        <Th fontSize="2xs" width="33.33%" p={1}></Th>
                    </Tr>

                    {/* Mobile version - Third row: Score 1, Score 2, Actions */}
                    <Tr display={{ base: "table-row", md: "none", lg: "none" }}>
                        <Th fontSize="2xs" width="33.33%" p={1}>{t('colScore1')}</Th>
                        <Th fontSize="2xs" width="33.33%" p={1}>{t('colScore2')}</Th>
                        <Th fontSize="2xs" width="33.33%" p={1}>{t('colActions')}</Th>
                    </Tr>

                    {/* Mobile version - Fourth row and going: Custom stats */}
                    {CustomStatsInfos.map((info) => (
                        <Fragment key={info.key}>
                            <Tr display={{ base: "table-row", md: "none", lg: "none" }}>
                                <Th fontSize="2xs" width="33.33%" p={1}>{localize(info.title)} 1</Th>
                                <Th fontSize="2xs" width="33.33%" p={1}>{localize(info.title)} 2</Th>
                                <Th fontSize="2xs" width="33.33%" p={1}></Th>
                            </Tr>
                        </Fragment>
                    ))}

                    {/* Tablet version - First row */}
                    <Tr display={{ base: "none", md: "table-row", lg: "none" }}>
                        <Th fontSize="xs">{t('colId')}</Th>
                        <Th fontSize="xs">{t('colStatus')}</Th>
                        <Th fontSize="xs">{t('colAgent1')}</Th>
                        <Th fontSize="xs">{t('colAgent2')}</Th>
                        <Th fontSize="xs">{t('colWinner')}</Th>
                    </Tr>

                    {/* Tablet version - second row */}
                    <Tr display={{ base: "none", md: "table-row", lg: "none" }}>
                        <Th fontSize="xs">{t('colScore1')}</Th>
                        <Th fontSize="xs">{t('colScore2')}</Th>
                        {CustomStatsInfos.map((info) => (
                            <Fragment key={info.key}>
                                <Th key={info.key + '1'} fontSize="xs">{localize(info.title)} 1</Th>
                                <Th key={info.key + '2'} fontSize="xs">{localize(info.title)} 2</Th>
                            </Fragment>
                        ))}
                        <Th fontSize="xs">{t('colActions')}</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {fights.map((fight, index) => {
                        const isEditing = editFightId === fight.id;
                        const isDeleting = deleteMutation.isPending && deleteMutation.variables === fight.id;
                        const isUpdating = updateMutation.isPending && updateMutation.variables?.id === fight.id;

                        return (
                            <React.Fragment key={fight.id}>
                                {/* Desktop version - single row */}
                                <Tr display={{ base: "none", md: "none", lg: "table-row" }} bg={{ base: "transparent", md: "transparent", lg: index % 2 === 0 ? "#2d3748" : undefined }}>
                                    <Td fontWeight="bold">{fight.id}</Td>
                                    <Td>
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.status}
                                                onChange={(e) => setEditFightData({ ...editFightData, status: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                            >
                                                {Object.keys(FightStatus).map((key) => (
                                                    <option key={key} value={FightStatus[key]}>
                                                        {t(`status.${FightStatus[key]}`, key)}
                                                    </option>
                                                ))}
                                            </Select>
                                        ) : (
                                            t(`status.${fight.status}`, fight.status.toUpperCase())
                                        )}
                                    </Td>
                                    <Td>
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.player1_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, player1_id: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                            >
                                                {Object.keys(agents).map((key) => (
                                                    <option key={key} value={key}>{agents[key]?.group.name} : {agents[key]?.name}</option>
                                                ))}
                                            </Select>
                                        ) : (
                                            <>
                                                <Box as="span" fontWeight="bold" wordBreak="break-all" whiteSpace="normal">{agents[fight.player1_id]?.id} - {agents[fight.player1_id]?.name}</Box>
                                                <Box as="span" display="block" wordBreak="break-word" whiteSpace="normal">{agents[fight.player1_id]?.group.id} - {agents[fight.player1_id]?.group.name}</Box>
                                            </>
                                        )}
                                    </Td>
                                    <Td>
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.player2_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, player2_id: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                            >
                                                {Object.keys(agents).map((key) => (
                                                    <option key={key} value={key}>{agents[key]?.group.name} : {agents[key]?.name}</option>
                                                ))}
                                            </Select>
                                        ) : (
                                            <>
                                                <Box as="span" fontWeight="bold" wordBreak="break-all" whiteSpace="normal">{agents[fight.player2_id]?.id} - {agents[fight.player2_id]?.name}</Box>
                                                <Box as="span" display="block" wordBreak="break-word" whiteSpace="normal">{agents[fight.player2_id]?.group.id} - {agents[fight.player2_id]?.group.name}</Box>
                                            </>
                                        )}
                                    </Td>
                                    <Td>
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.winner_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, winner_id: parseInt(e.target.value) })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                            >
                                                <option value="">{t('winnerNone')}</option>
                                                {editFightData.player1_id && (
                                                    <option value={editFightData.player1_id}>
                                                        {agents[editFightData.player1_id]?.name || ''}
                                                    </option>
                                                )}
                                                {editFightData.player2_id && (
                                                    <option value={editFightData.player2_id}>
                                                        {agents[editFightData.player2_id]?.name || ''}
                                                    </option>
                                                )}
                                            </Select>
                                        ) : (
                                            fight.winner_id ? (
                                                <Box wordBreak="break-all" whiteSpace="normal">
                                                    {agents[fight.winner_id]?.name || ''}
                                                </Box>
                                            ) : (
                                                t('noWinner')
                                            )
                                        )}
                                    </Td>
                                    <Td width="80px">
                                        {isEditing ? (
                                            <Input
                                                value={editFightData.score_player1}
                                                onChange={(e) => setEditFightData({ ...editFightData, score_player1: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            />
                                        ) : (
                                            fight.score_player1
                                        )}
                                    </Td>
                                    <Td width="80px">
                                        {isEditing ? (
                                            <Input
                                                value={editFightData.score_player2}
                                                onChange={(e) => setEditFightData({ ...editFightData, score_player2: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            />
                                        ) : (
                                            fight.score_player2
                                        )}
                                    </Td>
                                    {CustomStatsInfos.map((info) => (
                                        <React.Fragment key={info.key}>
                                            <Td width="70px">
                                                {isEditing ? (
                                                    <Input
                                                        value={editFightData.custom_stats?.find((stat) => stat.name === info.key && stat.agent_id === fight.player1_id)?.value ?? ''}
                                                        onChange={(e) =>
                                                            setEditFightData({
                                                                ...editFightData,
                                                                custom_stats: editFightData.custom_stats?.some(stat => stat.name === info.key && stat.agent_id === fight.player1_id) ?
                                                                    editFightData.custom_stats.map((stat) => {
                                                                        if (stat.name === info.key && stat.agent_id === fight.player1_id) {
                                                                            return { ...stat, value: e.target.value };
                                                                        } else {
                                                                            return stat;
                                                                        }
                                                                    }) :
                                                                    [
                                                                        ...editFightData.custom_stats,
                                                                        {
                                                                            name: info.key,
                                                                            agent_id: fight.player1_id,
                                                                            value: e.target.value
                                                                        }
                                                                    ]
                                                            })
                                                        }
                                                        borderColor="cyan.600"
                                                        focusBorderColor="cyan.400"
                                                        size="sm"
                                                    />
                                                ) : (
                                                    fight.custom_stats?.find(stat => stat.name === info.key && stat.agent_id === fight.player1_id)?.value ?? ''
                                                )}
                                            </Td>
                                            <Td width="70px">
                                                {isEditing ? (
                                                    <Input
                                                        value={editFightData.custom_stats?.find((stat) => stat.name === info.key && stat.agent_id === fight.player2_id)?.value ?? ''}
                                                        onChange={(e) =>
                                                            setEditFightData({
                                                                ...editFightData,
                                                                custom_stats: editFightData.custom_stats?.some(stat => stat.name === info.key && stat.agent_id === fight.player2_id) ?
                                                                    editFightData.custom_stats.map((stat) => {
                                                                        if (stat.name === info.key && stat.agent_id === fight.player2_id) {
                                                                            return { ...stat, value: e.target.value };
                                                                        } else {
                                                                            return stat;
                                                                        }
                                                                    }) :
                                                                    [
                                                                        ...editFightData.custom_stats,
                                                                        {
                                                                            name: info.key,
                                                                            agent_id: fight.player2_id,
                                                                            value: e.target.value
                                                                        }
                                                                    ]
                                                            })
                                                        }
                                                        borderColor="cyan.600"
                                                        focusBorderColor="cyan.400"
                                                        size="sm"
                                                    />
                                                ) : (
                                                    fight.custom_stats?.find(stat => stat.name === info.key && stat.agent_id === fight.player2_id)?.value ?? ''
                                                )}
                                            </Td>
                                        </React.Fragment>
                                    ))}
                                    <Td>
                                        {isEditing ? (
                                            <HStack spacing={2}>
                                                <IconButton
                                                    icon={<CheckIcon />}
                                                    colorScheme="green"
                                                    onClick={confirmEditing}
                                                    size="sm"
                                                    isLoading={isUpdating}
                                                />
                                                <IconButton
                                                    icon={<CloseIcon />}
                                                    colorScheme="red"
                                                    onClick={cancelEditing}
                                                    size="sm"
                                                />
                                            </HStack>
                                        ) : (
                                            <HStack spacing={2}>
                                                <IconButton
                                                    icon={<EditIcon />}
                                                    colorScheme="cyan"
                                                    onClick={() => startEditing(fight)}
                                                    size="sm"
                                                />
                                                <IconButton
                                                    icon={<DeleteIcon />}
                                                    colorScheme="pink"
                                                    onClick={() => handleDelete(fight.id)}
                                                    size="sm"
                                                    isLoading={isDeleting}
                                                />
                                            </HStack>
                                        )}
                                    </Td>
                                </Tr>

                                {/* Mobile version - First row: ID, Status, Winner */}
                                <Tr display={{ base: "table-row", md: "none", lg: "none" }} bg={{ base: index % 2 === 0 ? "#2d3748" : undefined, md: "transparent", lg: "transparent" }}>
                                    <Td fontWeight="bold" fontSize="2xs" width="33.33%" p={1}>{fight.id}</Td>
                                    <Td fontSize="2xs" width="33.33%" p={1}>
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.status}
                                                onChange={(e) => setEditFightData({ ...editFightData, status: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="xs"
                                                fontSize="2xs"
                                            >
                                                {Object.keys(FightStatus).map((key) => (
                                                    <option key={key} value={FightStatus[key]}>
                                                        {t(`status.${FightStatus[key]}`, key)}
                                                    </option>
                                                ))}
                                            </Select>
                                        ) : (
                                            t(`status.${fight.status}`, fight.status.toUpperCase())
                                        )}
                                    </Td>
                                    <Td fontSize="2xs" width="33.33%" p={1}>
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.winner_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, winner_id: parseInt(e.target.value) })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="xs"
                                                fontSize="2xs"
                                            >
                                                <option value="">{t('winnerNone')}</option>
                                                {editFightData.player1_id && (
                                                    <option value={editFightData.player1_id}>
                                                        {agents[editFightData.player1_id]?.name || ''}
                                                    </option>
                                                )}
                                                {editFightData.player2_id && (
                                                    <option value={editFightData.player2_id}>
                                                        {agents[editFightData.player2_id]?.name || ''}
                                                    </option>
                                                )}
                                            </Select>
                                        ) : (
                                            fight.winner_id ? (
                                                <Box wordBreak="break-all" whiteSpace="normal">
                                                    {agents[fight.winner_id]?.name || ''}
                                                </Box>
                                            ) : (
                                                t('noWinner')
                                            )
                                        )}
                                    </Td>
                                </Tr>

                                {/* Mobile version - Second row: Agent 1, Agent 2 */}
                                <Tr display={{ base: "table-row", md: "none", lg: "none" }} bg={{ base: index % 2 === 0 ? "#2d3748" : undefined, md: "transparent", lg: "transparent" }}>
                                    <Td fontSize="2xs" width="33.33%" p={1}>
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.player1_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, player1_id: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="xs"
                                                fontSize="2xs"
                                            >
                                                {Object.keys(agents).map((key) => (
                                                    <option key={key} value={key}>{agents[key]?.group.name} : {agents[key]?.name}</option>
                                                ))}
                                            </Select>
                                        ) : (
                                            <>
                                                <Box as="span" fontWeight="bold" wordBreak="break-all" whiteSpace="normal">{agents[fight.player1_id]?.id} - {agents[fight.player1_id]?.name}</Box>
                                                <Box as="span" display="block" wordBreak="break-word" whiteSpace="normal">{agents[fight.player1_id]?.group.id} - {agents[fight.player1_id]?.group.name}</Box>
                                            </>
                                        )}
                                    </Td>
                                    <Td fontSize="2xs" width="33.33%" p={1}>
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.player2_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, player2_id: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="xs"
                                                fontSize="2xs"
                                            >
                                                {Object.keys(agents).map((key) => (
                                                    <option key={key} value={key}>{agents[key]?.group.name} : {agents[key]?.name}</option>
                                                ))}
                                            </Select>
                                        ) : (
                                            <>
                                                <Box as="span" fontWeight="bold" wordBreak="break-all" whiteSpace="normal">{agents[fight.player2_id]?.id} - {agents[fight.player2_id]?.name}</Box>
                                                <Box as="span" display="block" wordBreak="break-word" whiteSpace="normal">{agents[fight.player2_id]?.group.id} - {agents[fight.player2_id]?.group.name}</Box>
                                            </>
                                        )}
                                    </Td>
                                    <Td fontSize="2xs" width="33.33%" p={1}></Td>
                                </Tr>

                                {/* Mobile version - Third row: Score 1, Score 2, Actions */}
                                <Tr display={{ base: "table-row", md: "none", lg: "none" }} bg={{ base: index % 2 === 0 ? "#2d3748" : undefined, md: "transparent", lg: "transparent" }}>
                                    <Td fontSize="2xs" width="33.33%" p={1}>
                                        {isEditing ? (
                                            <Input
                                                value={editFightData.score_player1}
                                                onChange={(e) => setEditFightData({ ...editFightData, score_player1: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="xs"
                                                fontSize="2xs"
                                            />
                                        ) : (
                                            fight.score_player1
                                        )}
                                    </Td>
                                    <Td fontSize="2xs" width="33.33%" p={1}>
                                        {isEditing ? (
                                            <Input
                                                value={editFightData.score_player2}
                                                onChange={(e) => setEditFightData({ ...editFightData, score_player2: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="xs"
                                                fontSize="2xs"
                                            />
                                        ) : (
                                            fight.score_player2
                                        )}
                                    </Td>
                                    <Td fontSize="2xs" width="33.33%" p={1}>
                                        {isEditing ? (
                                            <HStack spacing={1}>
                                                <IconButton
                                                    icon={<CheckIcon />}
                                                    colorScheme="green"
                                                    onClick={confirmEditing}
                                                    size="xs"
                                                    isLoading={isUpdating}
                                                />
                                                <IconButton
                                                    icon={<CloseIcon />}
                                                    colorScheme="red"
                                                    onClick={cancelEditing}
                                                    size="xs"
                                                />
                                            </HStack>
                                        ) : (
                                            <HStack spacing={1}>
                                                <IconButton
                                                    icon={<EditIcon />}
                                                    colorScheme="cyan"
                                                    onClick={() => startEditing(fight)}
                                                    size="xs"
                                                />
                                                <IconButton
                                                    icon={<DeleteIcon />}
                                                    colorScheme="pink"
                                                    onClick={() => handleDelete(fight.id)}
                                                    size="xs"
                                                    isLoading={isDeleting}
                                                />
                                            </HStack>
                                        )}
                                    </Td>
                                </Tr>


                                {/* Mobile version - Fourth row and going: CustomStats */}
                                {CustomStatsInfos.map((info) => (
                                    <Tr
                                        key={`${fight.id}-${info.key}`}
                                        display={{ base: "table-row", md: "none", lg: "none" }}
                                        bg={{ base: index % 2 === 0 ? "#2d3748" : undefined, md: "transparent", lg: "transparent" }}
                                    >
                                        {/* Custom stat - Agent 1 */}
                                        <Td fontSize="2xs" width="33.33%" p={1}>
                                            {isEditing ? (
                                                <Input
                                                    value={editFightData.custom_stats?.find(
                                                        (stat) => stat.name === info.key && stat.agent_id === fight.player1_id
                                                    )?.value ?? ''}
                                                    onChange={(e) =>
                                                        setEditFightData({
                                                            ...editFightData,
                                                            custom_stats: editFightData.custom_stats?.some(
                                                                (stat) => stat.name === info.key && stat.agent_id === fight.player1_id
                                                            )
                                                                ? editFightData.custom_stats.map((stat) => {
                                                                    if (stat.name === info.key && stat.agent_id === fight.player1_id) {
                                                                        return { ...stat, value: e.target.value };
                                                                    }
                                                                    return stat;
                                                                })
                                                                : [
                                                                    ...(editFightData.custom_stats || []),
                                                                    {
                                                                        name: info.key,
                                                                        agent_id: fight.player1_id,
                                                                        value: e.target.value,
                                                                    },
                                                                ],
                                                        })
                                                    }
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    size="xs"
                                                    fontSize="2xs"
                                                />
                                            ) : (
                                                fight.custom_stats?.find(
                                                    (stat) => stat.name === info.key && stat.agent_id === fight.player1_id
                                                )?.value ?? ''
                                            )}
                                        </Td>

                                        {/* Custom stat - Agent 2 */}
                                        <Td fontSize="2xs" width="33.33%" p={1}>
                                            {isEditing ? (
                                                <Input
                                                    value={editFightData.custom_stats?.find(
                                                        (stat) => stat.name === info.key && stat.agent_id === fight.player2_id
                                                    )?.value ?? ''}
                                                    onChange={(e) =>
                                                        setEditFightData({
                                                            ...editFightData,
                                                            custom_stats: editFightData.custom_stats?.some(
                                                                (stat) => stat.name === info.key && stat.agent_id === fight.player2_id
                                                            )
                                                                ? editFightData.custom_stats.map((stat) => {
                                                                    if (stat.name === info.key && stat.agent_id === fight.player2_id) {
                                                                        return { ...stat, value: e.target.value };
                                                                    }
                                                                    return stat;
                                                                })
                                                                : [
                                                                    ...(editFightData.custom_stats || []),
                                                                    {
                                                                        name: info.key,
                                                                        agent_id: fight.player2_id,
                                                                        value: e.target.value,
                                                                    },
                                                                ],
                                                        })
                                                    }
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    size="xs"
                                                    fontSize="2xs"
                                                />
                                            ) : (
                                                fight.custom_stats?.find(
                                                    (stat) => stat.name === info.key && stat.agent_id === fight.player2_id
                                                )?.value ?? ''
                                            )}
                                        </Td>

                                        {/* Empty spacer cell to match the 3-column layout */}
                                        <Td fontSize="2xs" width="33.33%" p={1}></Td>
                                    </Tr>
                                ))}

                                {/* Tablet version - First row: ID, STATUS, AGENT1, AGENT2, WINNER */}
                                <Tr display={{ base: "none", md: "table-row", lg: "none" }} bg={{ base: "transparent", md: index % 2 === 0 ? "#2d3748" : undefined, lg: "transparent" }}>
                                    <Td fontWeight="bold" fontSize="sm">{fight.id}</Td>
                                    <Td fontSize="sm">
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.status}
                                                onChange={(e) => setEditFightData({ ...editFightData, status: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            >
                                                {Object.keys(FightStatus).map((key) => (
                                                    <option key={key} value={FightStatus[key]}>
                                                        {t(`status.${FightStatus[key]}`, key)}
                                                    </option>
                                                ))}
                                            </Select>
                                        ) : (
                                            t(`status.${fight.status}`, fight.status.toUpperCase())
                                        )}
                                    </Td>
                                    <Td fontSize="sm">
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.player1_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, player1_id: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            >
                                                {Object.keys(agents).map((key) => (
                                                    <option key={key} value={key}>{agents[key]?.group.name} : {agents[key]?.name}</option>
                                                ))}
                                            </Select>
                                        ) : (
                                            <>
                                                <Box as="span" fontWeight="bold" wordBreak="break-all" whiteSpace="normal">{agents[fight.player1_id]?.id} - {agents[fight.player1_id]?.name}</Box>
                                                <Box as="span" display="block" wordBreak="break-word" whiteSpace="normal">{agents[fight.player1_id]?.group.id} - {agents[fight.player1_id]?.group.name}</Box>
                                            </>
                                        )}
                                    </Td>
                                    <Td fontSize="sm">
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.player2_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, player2_id: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            >
                                                {Object.keys(agents).map((key) => (
                                                    <option key={key} value={key}>{agents[key]?.group.name} : {agents[key]?.name}</option>
                                                ))}
                                            </Select>
                                        ) : (
                                            <>
                                                <Box as="span" fontWeight="bold" wordBreak="break-all" whiteSpace="normal">{agents[fight.player2_id]?.id} - {agents[fight.player2_id]?.name}</Box>
                                                <Box as="span" display="block" wordBreak="break-word" whiteSpace="normal">{agents[fight.player2_id]?.group.id} - {agents[fight.player2_id]?.group.name}</Box>
                                            </>
                                        )}
                                    </Td>
                                    <Td fontSize="sm">
                                        {isEditing ? (
                                            <Select
                                                value={editFightData.winner_id}
                                                onChange={(e) => setEditFightData({ ...editFightData, winner_id: parseInt(e.target.value) })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            >
                                                <option value="">{t('winnerNone')}</option>
                                                {editFightData.player1_id && (
                                                    <option value={editFightData.player1_id}>
                                                        {agents[editFightData.player1_id]?.name || ''}
                                                    </option>
                                                )}
                                                {editFightData.player2_id && (
                                                    <option value={editFightData.player2_id}>
                                                        {agents[editFightData.player2_id]?.name || ''}
                                                    </option>
                                                )}
                                            </Select>
                                        ) : (
                                            fight.winner_id ? (
                                                <Box wordBreak="break-all" whiteSpace="normal">
                                                    {agents[fight.winner_id]?.name || ''}
                                                </Box>
                                            ) : (
                                                t('noWinner')
                                            )
                                        )}
                                    </Td>
                                </Tr>

                                {/* Tablet version - second row: SCORE1, SCORE2, DIV1, DIV2, ACTIONS */}
                                <Tr display={{ base: "none", md: "table-row", lg: "none" }} bg={{ base: "transparent", md: index % 2 === 0 ? "#2d3748" : undefined, lg: "transparent" }}>
                                    <Td fontSize="sm">
                                        {isEditing ? (
                                            <Input
                                                value={editFightData.score_player1}
                                                onChange={(e) => setEditFightData({ ...editFightData, score_player1: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            />
                                        ) : (
                                            fight.score_player1
                                        )}
                                    </Td>
                                    <Td fontSize="sm">
                                        {isEditing ? (
                                            <Input
                                                value={editFightData.score_player2}
                                                onChange={(e) => setEditFightData({ ...editFightData, score_player2: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            />
                                        ) : (
                                            fight.score_player2
                                        )}
                                    </Td>
                                    {CustomStatsInfos.map((info) => (
                                        <React.Fragment key={info.key}>
                                            <Td fontSize="sm">
                                                {isEditing ? (
                                                    <Input
                                                        value={editFightData.custom_stats?.find((stat) => stat.name === info.key && stat.agent_id === fight.player1_id)?.value ?? ''}
                                                        onChange={(e) =>
                                                            setEditFightData({
                                                                ...editFightData,
                                                                custom_stats: editFightData.custom_stats?.some(stat => stat.name === info.key && stat.agent_id === fight.player1_id) ?
                                                                    editFightData.custom_stats.map((stat) => {
                                                                        if (stat.name === info.key && stat.agent_id === fight.player1_id) {
                                                                            return { ...stat, value: e.target.value };
                                                                        } else {
                                                                            return stat;
                                                                        }
                                                                    }) :
                                                                    [
                                                                        ...editFightData.custom_stats,
                                                                        {
                                                                            name: info.key,
                                                                            agent_id: fight.player1_id,
                                                                            value: e.target.value
                                                                        }
                                                                    ]
                                                            })
                                                        }
                                                        borderColor="cyan.600"
                                                        focusBorderColor="cyan.400"
                                                        size="sm"
                                                    />
                                                ) : (
                                                    fight.custom_stats?.find(stat => stat.name === info.key && stat.agent_id === fight.player1_id)?.value ?? ''
                                                )}
                                            </Td>
                                            <Td fontSize="sm">
                                                {isEditing ? (
                                                    <Input
                                                        value={editFightData.custom_stats?.find((stat) => stat.name === info.key && stat.agent_id === fight.player2_id)?.value ?? ''}
                                                        onChange={(e) =>
                                                            setEditFightData({
                                                                ...editFightData,
                                                                custom_stats: editFightData.custom_stats?.some(stat => stat.name === info.key && stat.agent_id === fight.player2_id) ?
                                                                    editFightData.custom_stats.map((stat) => {
                                                                        if (stat.name === info.key && stat.agent_id === fight.player2_id) {
                                                                            return { ...stat, value: e.target.value };
                                                                        } else {
                                                                            return stat;
                                                                        }
                                                                    }) :
                                                                    [
                                                                        ...editFightData.custom_stats,
                                                                        {
                                                                            name: info.key,
                                                                            agent_id: fight.player2_id,
                                                                            value: e.target.value
                                                                        }
                                                                    ]
                                                            })
                                                        }
                                                        borderColor="cyan.600"
                                                        focusBorderColor="cyan.400"
                                                        size="sm"
                                                    />
                                                ) : (
                                                    fight.custom_stats?.find(stat => stat.name === info.key && stat.agent_id === fight.player2_id)?.value ?? ''
                                                )}
                                            </Td>
                                        </React.Fragment>
                                    ))}
                                    <Td>
                                        {isEditing ? (
                                            <HStack spacing={1}>
                                                <IconButton
                                                    icon={<CheckIcon />}
                                                    colorScheme="green"
                                                    onClick={confirmEditing}
                                                    size="sm"
                                                    isLoading={isUpdating}
                                                />
                                                <IconButton
                                                    icon={<CloseIcon />}
                                                    colorScheme="red"
                                                    onClick={cancelEditing}
                                                    size="sm"
                                                />
                                            </HStack>
                                        ) : (
                                            <HStack spacing={1}>
                                                <IconButton
                                                    icon={<EditIcon />}
                                                    colorScheme="cyan"
                                                    onClick={() => startEditing(fight)}
                                                    size="sm"
                                                />
                                                <IconButton
                                                    icon={<DeleteIcon />}
                                                    colorScheme="pink"
                                                    onClick={() => handleDelete(fight.id)}
                                                    size="sm"
                                                    isLoading={isDeleting}
                                                />
                                            </HStack>
                                        )}
                                    </Td>
                                </Tr>
                            </React.Fragment>
                        )
                    })}
                </Tbody>
            </Table>
        </Box>
    );
};

FightPanel.propTypes = {
    selected: PropTypes.bool.isRequired
}

export default FightPanel;
