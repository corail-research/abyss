import React, { useState, useCallback } from 'react';
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
    Button,
} from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EditIcon, CheckIcon, CloseIcon, DeleteIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';

import Pagination from './Pagination';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

import { getAgentCollection, patchAgentItem, deleteAgentItem, getCountAgent } from '../api/agents/agents.ts';
import { getGroupCollection } from '../api/groups/groups.ts';
import { AgentStatus, useColors } from '../constants/constants.js';
import { useAuth } from '../context/AuthContext.jsx';

const AGENTS_PER_PAGES = 100;
const MAX_STALE_TIME = 5 * 60 * 1000;
const AGENTS_MAX_STALE_TIME = 30 * 1000;

const AGENT_NAME_MAX_LENGTH = import.meta.env.VITE_AGENT_NAME_MAX_LENGTH;

const AgentPanel = ({ selected }) => {
    const [editAgentId, setEditAgentId] = useState(null);
    const [editAgentData, setEditAgentData] = useState({});
    const [currentPage, setCurrentPage] = useState(0);
    const [inputPage, setInputPage] = useState('');

    const toast = useToast();
    const colors = useColors();
    const { authState } = useAuth();
    const queryClient = useQueryClient();
    const { t } = useTranslation('agentPanel');

    const {
        data: groups = {},
        isLoading: groupsLoading,
        error: groupsError,
    } = useQuery({
        queryKey: ['admin', 'groups', 'id,name'],
        queryFn: async () => {
            const response = await getGroupCollection(
                {},
                { headers: { "X-Fields": "id,name" } }
            );
            const map = {};
            response.forEach((g) => (map[g.id] = g.name));
            return map;
        },
        enabled: selected && !!authState?.options,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const {
        data: totalAgents = -1,
        isLoading: countLoading,
        error: countError,
    } = useQuery({
        queryKey: ['admin', 'agents', 'count'],
        queryFn: async () => await getCountAgent(),
        enabled: selected,
        staleTime: AGENTS_MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const {
        data: agents = [],
        isLoading: agentsLoading,
        error: agentsError,
    } = useQuery({
        queryKey: ['admin', 'agents', currentPage],
        queryFn: async () => await getAgentCollection(
            { paginate: true, page: currentPage + 1, limit: AGENTS_PER_PAGES },
            { headers: { 'X-Fields': 'id,name,group{id},status,refusal_message' } }
        ),
        enabled: selected && totalAgents > 0,
        staleTime: AGENTS_MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
        placeholderData: (previousData) => previousData,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => patchAgentItem(id, data, authState.options),
        onSuccess: () => {
            toast({ title: t('updated'), status: 'success', duration: 5000, isClosable: true });
            setEditAgentId(null);
            setEditAgentData({});
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
        },
        onError: () => {
            toast({ title: t('updateError'), status: 'error', duration: 5000, isClosable: true });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => deleteAgentItem(id, authState.options),
        onSuccess: () => {
            toast({ title: t('deleted'), status: 'success', duration: 5000, isClosable: true });
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
        },
        onError: () => {
            toast({ title: t('deleteError'), status: 'error', duration: 5000, isClosable: true });
        },
    });


    const handleUpdate = useCallback((id) => {
        const data = { ...editAgentData };
        if (!data.group_id) {
            toast({ title: t('selectGroupWarning'), status: 'warning', duration: 3000, isClosable: true });
            return;
        }
        updateMutation.mutate({ id, data });
    }, [editAgentData, updateMutation, toast, t]);

    const handleDelete = useCallback(
        (id) => deleteMutation.mutate(id),
        [deleteMutation]
    );

    const startEditing = (agent) => {
        setEditAgentId(agent.id);
        setEditAgentData({
            name: agent.name || '',
            group_id: agent.group.id,
            status: agent.status || '',
            refusal_message: agent.refusal_message || ''
        });
    };

    const cancelEditing = () => {
        setEditAgentId(null);
        setEditAgentData({});
    };

    const confirmEditing = useCallback(() => {
        if (editAgentId) handleUpdate(editAgentId);
    }, [editAgentId, handleUpdate]);

    const totalPages = Math.ceil(totalAgents / AGENTS_PER_PAGES);

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

    const handlePageClick = (selectedPage) => {
        setCurrentPage(selectedPage);
        setInputPage('');
    };

    const isLoading = groupsLoading || countLoading || agentsLoading;
    const error = groupsError || countError || agentsError;

    if (isLoading) return <Loading />;
    if (error) return <ErrorMessage message={t('loadError')} />;

    return (
        <Box p={{ base: 5, md: 0, lg: 5 }} bg={colors.panelBg} borderRadius="md" mx="auto" w={{ base: "100%", md: "95%", lg: "75%" }} boxShadow="lg">
            <HStack justifyContent="space-between" alignItems="center" p={{ base: 0, md: 2, lg: 0 }} flexDirection={{ base: "column", md: "row" }} spacing={{ base: 2, md: 0 }}>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageClick}
                />
                <HStack>
                    <Input
                        placeholder={t('pagePlaceholder')}
                        value={inputPage}
                        onChange={(e) => setInputPage(e.target.value)}
                        width="100px"
                        borderColor="cyan.600"
                        focusBorderColor="cyan.400"
                        size={{ base: "sm", md: "md" }}
                    />
                    <Button colorScheme="teal" onClick={handleDirectPageChange} size={{ base: "sm", md: "md" }}>
                        {t('goButton')}
                    </Button>
                </HStack>
            </HStack>

            <Box overflowX="auto" mt={{ base: 2, md: 0, lg: 0 }} >
                <Table
                    bgColor={colors.tabBg}
                    borderRadius={{ base: "sm", md: "md" }}
                    boxShadow="md"
                    size={{ base: "sm", md: "md", tableLayout: "fixed" }}
                    w={{ base: "100%", md: "100%" }}
                    sx={{
                        '@media (min-width: 768px) and (max-width: 991px)': {
                            '& th:nth-of-type(1), & td:nth-of-type(1)': { width: '70px !important', maxWidth: '70px !important' },
                            '& th:nth-of-type(2), & td:nth-of-type(2)': { width: '120px !important', maxWidth: '120px !important' },
                            '& th:nth-of-type(3), & td:nth-of-type(3)': { width: '120px !important', maxWidth: '120px !important' },
                            '& th:nth-of-type(4), & td:nth-of-type(4)': { width: '100px !important', maxWidth: '100px !important' },
                            '& th:nth-of-type(5), & td:nth-of-type(5)': { width: 'calc(100% - 470px) !important', minWidth: '110px !important' },
                            '& th:nth-of-type(6), & td:nth-of-type(6)': { width: '70px !important', maxWidth: '70px !important' }
                        },
                        '@media (max-width: 767px)': {
                            '& th:nth-of-type(1), & td:nth-of-type(1)': { width: '50px !important', maxWidth: '50px !important', minWidth: '50px !important' },
                            '& th:nth-of-type(2), & td:nth-of-type(2)': { width: '80px !important', maxWidth: '80px !important', minWidth: '80px !important' },
                            '& th:nth-of-type(3), & td:nth-of-type(3)': { width: 'calc(100% - 130px) !important', minWidth: '120px !important' },
                            '& td': { verticalAlign: 'top !important' }
                        }
                    }}
                >
                    <Thead>
                        <Tr display={{ base: "none", md: "table-row" }}>
                            <Th
                                px={{ base: 1, md: 4 }}
                                fontSize={{ base: "xs", md: "sm" }}
                            >
                                {t('colId')}
                            </Th>
                            <Th
                                px={{ base: 1, md: 4 }}
                                fontSize={{ base: "xs", md: "sm" }}
                            >
                                {t('colName')}
                            </Th>
                            <Th
                                px={{ base: 1, md: 4 }}
                                fontSize={{ base: "xs", md: "sm" }}
                            >
                                {t('colGroup')}
                            </Th>
                            <Th
                                px={{ base: 1, md: 4 }}
                                fontSize={{ base: "xs", md: "sm" }}
                            >
                                {t('colStatus')}
                            </Th>
                            <Th
                                px={{ base: 1, md: 4 }}
                                fontSize={{ base: "xs", md: "sm" }}
                            >
                                {t('colRefusalMessage')}
                            </Th>
                            <Th
                                px={{ base: 1, md: 4 }}
                                fontSize={{ base: "xs", md: "sm" }}
                            >
                                {t('colActions')}
                            </Th>
                        </Tr>
                        <Tr display={{ base: "table-row", md: "none" }}>
                            <Th
                                px={1}
                                fontSize="xs"
                                w="50px"
                                maxW="50px"
                                minW="50px"
                            >
                                {t('colId')}
                            </Th>
                            <Th
                                px={1}
                                fontSize="xs"
                                w="80px"
                                maxW="80px"
                                minW="80px"
                            >
                                {t('colName')}
                            </Th>
                            <Th
                                px={1}
                                fontSize="xs"
                            >
                                {t('colGroup')}
                            </Th>
                        </Tr>
                        <Tr display={{ base: "table-row", md: "none" }}>
                            <Th
                                px={1}
                                fontSize="xs"
                                w="50px"
                                maxW="50px"
                                minW="50px"
                            >

                            </Th>
                            <Th
                                px={1}
                                fontSize="xs"
                                w="80px"
                                maxW="80px"
                                minW="80px"
                            >
                                {t('colStatus')}
                            </Th>
                            <Th
                                px={1}
                                fontSize="xs"
                            >
                                {t('colMessageShort')}
                            </Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {agents.map((agent, index) => {
                            const isEditing = editAgentId === agent.id;
                            const isDeleting = deleteMutation.isPending && deleteMutation.variables === agent.id;
                            const isUpdating = updateMutation.isPending && updateMutation.variables?.id === agent.id;

                            return (
                                <React.Fragment key={agent.id}>
                                    {/* Desktop/tablet version */}
                                    <Tr display={{ base: "none", md: "table-row" }} bg={index % 2 === 0 ? "#2d3748" : undefined}>
                                        <Td fontWeight="bold" px={{ base: 1, md: 4 }} fontSize={{ base: "xs", md: "sm" }}>{agent.id}</Td>
                                        <Td px={{ base: 1, md: 4 }}>
                                            {editAgentId === agent.id ? (
                                                <Input
                                                    value={editAgentData.name || ''}
                                                    onChange={(e) =>
                                                        setEditAgentData({ ...editAgentData, name: e.target.value.slice(0, AGENT_NAME_MAX_LENGTH) })
                                                    }
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    maxLength={AGENT_NAME_MAX_LENGTH}
                                                    size={{ base: "sm", md: "md" }}
                                                />
                                            ) : (
                                                <Box fontSize={{ base: "xs", md: "sm" }} wordBreak="break-word">
                                                    {agent.name}
                                                </Box>
                                            )}
                                        </Td>
                                        <Td px={{ base: 1, md: 4 }}>
                                            {isEditing ? (
                                                <Select
                                                    value={editAgentData.group_id}
                                                    onChange={(e) =>
                                                        setEditAgentData({ ...editAgentData, group_id: e.target.value })}
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    size={{ base: "sm", md: "md" }}
                                                >
                                                    {Object.keys(groups).map((key) => (
                                                        <option key={key} value={key}>{groups[key]}</option>
                                                    ))}
                                                </Select>
                                            ) : (
                                                <Box fontSize={{ base: "xs", md: "sm" }} wordBreak="break-word">
                                                    {agent.group.id + ' - ' + (groups[agent.group.id] || '')}
                                                </Box>
                                            )}
                                        </Td>
                                        <Td px={{ base: 1, md: 4 }}>
                                            {isEditing ? (
                                                <Select
                                                    value={editAgentData.status}
                                                    onChange={(e) =>
                                                        setEditAgentData({ ...editAgentData, status: e.target.value })}
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    size={{ base: "sm", md: "md" }}
                                                >
                                                    {Object.keys(AgentStatus).map((key) => (
                                                        <option key={key} value={AgentStatus[key]}>
                                                            {t(`status.${AgentStatus[key]}`, key)}
                                                        </option>
                                                    ))}

                                                </Select>
                                            ) : (
                                                <Box fontSize={{ base: "xs", md: "sm" }}>
                                                    {t(`status.${agent.status}`, agent.status.toUpperCase())}

                                                </Box>
                                            )
                                            }
                                        </Td>
                                        <Td px={{ base: 1, md: 4 }}>
                                            {isEditing ? (
                                                <Input
                                                    value={editAgentData.refusal_message || ''}
                                                    onChange={(e) =>
                                                        setEditAgentData({ ...editAgentData, refusal_message: e.target.value })
                                                    }
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    size={{ base: "sm", md: "md" }}
                                                />
                                            ) : (
                                                <Box fontSize={{ base: "xs", md: "sm" }} wordBreak="break-word">
                                                    {agent.refusal_message ?? ''}
                                                </Box>
                                            )}

                                        </Td>
                                        <Td px={{ base: 1, md: 4 }}>
                                            {isEditing ? (
                                                <HStack spacing={1} flexDirection={{ base: "row", md: "column", lg: "row" }}>
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
                                                <HStack spacing={1} flexDirection={{ base: "row", md: "column", lg: "row" }}>
                                                    <IconButton
                                                        icon={<EditIcon />}
                                                        colorScheme="cyan"
                                                        onClick={() => startEditing(agent)}
                                                        size="xs"
                                                    />
                                                    <IconButton
                                                        icon={<DeleteIcon />}
                                                        colorScheme="pink"
                                                        onClick={() => handleDelete(agent.id)}
                                                        size="xs"
                                                        isLoading={isDeleting}
                                                    />
                                                </HStack>
                                            )}
                                        </Td>
                                    </Tr>

                                    {/* Mobile version - First row: ID, NAME, GROUP */}
                                    <Tr display={{ base: "table-row", md: "none" }} bg={{ base: index % 2 === 0 ? "#2d3748" : undefined, md: "transparent" }}>
                                        <Td fontWeight="bold" px={1} fontSize="xs" w="50px" maxW="50px" minW="50px" overflow="hidden" textOverflow="ellipsis">
                                            {agent.id}
                                        </Td>
                                        <Td px={0} w="80px" maxW="80px" minW="80px" overflow="hidden">
                                            {isEditing ? (
                                                <Input
                                                    value={editAgentData.name || ''}
                                                    onChange={(e) =>
                                                        setEditAgentData({ ...editAgentData, name: e.target.value.slice(0, 6) }) // TODO: use a const
                                                    }
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    maxLength={6}
                                                    size="xs"
                                                    fontSize="xs"
                                                />
                                            ) : (
                                                <Box fontSize="xs" overflow="hidden" wordBreak="break-word">
                                                    {agent.name}
                                                </Box>
                                            )}
                                        </Td>
                                        <Td px={0} verticalAlign="top">
                                            {isEditing ? (
                                                <Select
                                                    value={editAgentData.group_id}
                                                    onChange={(e) =>
                                                        setEditAgentData({ ...editAgentData, group_id: e.target.value })}
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    size="xs"
                                                    fontSize="xs"
                                                >
                                                    {Object.keys(groups).map((key) => (
                                                        <option key={key} value={key}>
                                                            {groups[key]}
                                                        </option>
                                                    ))}
                                                </Select>
                                            ) : (
                                                <Box fontSize="xs" wordBreak="break-word" whiteSpace="normal">
                                                    {agent.group.id + ' - ' + (groups[agent.group.id] || '')}
                                                </Box>
                                            )}
                                        </Td>
                                    </Tr>

                                    {/* Mobile version - Second row: ACTION, STATUS, MESSAGE */}
                                    <Tr display={{ base: "table-row", md: "none" }} bg={{ base: index % 2 === 0 ? "#2d3748" : undefined, md: "transparent" }}>
                                        <Td px={0} w="50px" maxW="50px" minW="50px">
                                            {isEditing ? (
                                                <Box>
                                                    <IconButton
                                                        icon={<CheckIcon />}
                                                        colorScheme="green"
                                                        onClick={confirmEditing}
                                                        size="xs"
                                                        mb={1}
                                                        isLoading={isUpdating}
                                                    />
                                                    <IconButton
                                                        icon={<CloseIcon />}
                                                        colorScheme="red"
                                                        onClick={cancelEditing}
                                                        size="xs"
                                                    />
                                                </Box>
                                            ) : (
                                                <Box>
                                                    <IconButton
                                                        icon={<EditIcon />}
                                                        colorScheme="cyan"
                                                        onClick={() => startEditing(agent)}
                                                        size="xs"
                                                        mb={1}
                                                    />
                                                    <IconButton
                                                        icon={<DeleteIcon />}
                                                        colorScheme="pink"
                                                        onClick={() => handleDelete(agent.id)}
                                                        size="xs"
                                                        isLoading={isDeleting}
                                                    />
                                                </Box>
                                            )}
                                        </Td>
                                        <Td px={0} w="80px" maxW="80px" minW="80px" overflow="hidden">
                                            {isEditing ? (
                                                <Select
                                                    value={editAgentData.status}
                                                    onChange={(e) =>
                                                        setEditAgentData({ ...editAgentData, status: e.target.value })}
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    size="xs"
                                                    fontSize="xs"
                                                >
                                                    {Object.keys(AgentStatus).map((key) => (
                                                        <option key={key} value={AgentStatus[key]}>
                                                            {t(`status.${AgentStatus[key]}`, key)}
                                                        </option>
                                                    ))}
                                                </Select>
                                            ) : (
                                                <Box fontSize="xs" overflow="hidden" wordBreak="break-word">
                                                    {t(`status.${agent.status}`, agent.status.toUpperCase())}
                                                </Box>
                                            )}
                                        </Td>
                                        <Td px={0} verticalAlign="top">
                                            {isEditing ? (
                                                <Input
                                                    value={editAgentData.refusal_message || ''}
                                                    onChange={(e) =>
                                                        setEditAgentData({ ...editAgentData, refusal_message: e.target.value })
                                                    }
                                                    borderColor="cyan.600"
                                                    focusBorderColor="cyan.400"
                                                    size="xs"
                                                    fontSize="xs"
                                                />
                                            ) : (
                                                <Box fontSize="xs" wordBreak="break-word" whiteSpace="normal">
                                                    {agent.refusal_message ?? ''}
                                                </Box>
                                            )}
                                        </Td>
                                    </Tr>
                                </React.Fragment>
                            )
                        })}
                    </Tbody>
                </Table>
            </Box>
        </Box>
    );
};

AgentPanel.propTypes = {
    selected: PropTypes.bool.isRequired
}

export default AgentPanel;
