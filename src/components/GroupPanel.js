import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Button,
    Input,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tr,
    VStack,
    HStack,
    IconButton,
    useToast,
    FormControl,
    FormLabel,
    Select,
} from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EditIcon, CheckIcon, CloseIcon, DeleteIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';

import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

import { LeagueNames, LeagueDisplayNames, useColors } from '../constants/constants.js';
import { useLocalized } from '../constants/languages.js';
import { getGroupCollection, postGroupCollection, patchGroupItem, deleteGroupItem } from '../api/groups/groups.ts';
import { useAuth } from '../context/AuthContext.jsx';

const MAX_STALE_TIME = 5 * 60 * 1000;

const GroupPanel = ({ selected }) => {
    const [newGroup, setNewGroup] = useState({ name: '' });
    const [editGroupId, setEditGroupId] = useState(null);
    const [editGroupData, setEditGroupData] = useState({});
    const toast = useToast();
    const colors = useColors();
    const { authState } = useAuth();
    const queryClient = useQueryClient();
    const { t } = useTranslation('groupPanel');
    const localize = useLocalized();

    const {
        data: groups = [],
        isLoading: groupsLoading,
        error: groupsError,
    } = useQuery({
        queryKey: ['admin', 'groups', 'id,name,league'],
        queryFn: async () => {
            const response = await getGroupCollection({}, { headers: { "X-Fields": "id,name,league_history" } });
            return response;
        },
        enabled: selected && !!authState?.options,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const createMutation = useMutation({
        mutationFn: (data) => postGroupCollection(data, authState.options),
        onSuccess: () => {
            toast({ title: t('created'), status: "success", duration: 5000, isClosable: true });
            setNewGroup({ name: '' });
            queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] });
        },
        onError: () => {
            toast({ title: t('createError'), status: "error", duration: 5000, isClosable: true });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => patchGroupItem(id, data, authState.options),
        onSuccess: () => {
            toast({ title: t('updated'), status: "success", duration: 5000, isClosable: true });
            setEditGroupId(null);
            setEditGroupData({});
            queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] });
        },
        onError: () => {
            toast({ title: t('updateError'), status: "error", duration: 5000, isClosable: true });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => deleteGroupItem(id, authState.options),
        onSuccess: () => {
            toast({ title: t('deleted'), status: "success", duration: 5000, isClosable: true });
            queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] });
        },
        onError: () => {
            toast({ title: t('deleteError'), status: "error", duration: 5000, isClosable: true });
        },
    });

    const handleCreate = useCallback(() => {
        createMutation.mutate(newGroup);
    }, [newGroup, createMutation]);

    const handleUpdate = useCallback((id) => {
        updateMutation.mutate({ id, data: editGroupData });
    }, [editGroupData, updateMutation]);

    const handleDelete = useCallback((id) => {
        deleteMutation.mutate(id);
    }, [deleteMutation]);

    const startEditing = (group) => {
        setEditGroupId(group.id);
        setEditGroupData({
            name: group.name,
            league: group.league_history.current_league,
        });
    };

    const cancelEditing = () => {
        setEditGroupId(null);
        setEditGroupData({});
    };

    const confirmEditing = useCallback(() => {
        if (editGroupId) handleUpdate(editGroupId);
    }, [editGroupId, handleUpdate]);

    if (groupsLoading) return <Loading />;
    if (groupsError) return <ErrorMessage message={t('loadError')} />;

    return (
        <Box p={{ sm: 0, md: 5, lg: 5 }} bg={colors.panelBg} borderRadius="md" mx="auto" w={{ sm: "100%", md: "95%", lg: "80%" }} boxShadow="lg">
            <Box p={5} bg={colors.lighterPanelBg} borderRadius="md" mx="auto" w={{ sm: "100%", md: "50%" }} boxShadow="md">
                <VStack spacing={4}>
                    <Box fontSize="xl" fontWeight="bold" mb={4}>
                        {t('createTitle')}
                    </Box>
                    <FormControl as='form' autoComplete="off">
                        <HStack justify="space-between">
                            <FormLabel w="30%" textAlign="left" fontWeight="bold">
                                {t('labelGroupName')}
                            </FormLabel>
                            <Input
                                w="70%"
                                placeholder={t('placeholderName')}
                                value={newGroup.name}
                                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                                borderColor="cyan.600"
                                focusBorderColor="cyan.400"
                            />
                        </HStack>
                    </FormControl>
                    <Button
                        colorScheme="cyan"
                        onClick={handleCreate}
                        isLoading={createMutation.isPending}
                        loadingText={t('creating')}
                    >
                        {t('createButton')}
                    </Button>
                </VStack>
            </Box>

            <Box overflowX="auto">
                <Table
                    variant="striped"
                    bgColor={colors.tabBg}
                    mt={20}
                    borderRadius={{ base: "sm", md: "md" }}
                    boxShadow="md"
                    size={{ base: "sm", md: "md", tableLayout: "fixed" }}
                    w={{ base: "100%", md: "100%" }}
                    sx={{
                        '@media (max-width: 480px)': {
                            '& th:nth-of-type(1), & td:nth-of-type(1)': { width: '55px !important', maxWidth: '55px !important' },
                            '& th:nth-of-type(2), & td:nth-of-type(2)': { width: 'calc(100% - 170px) !important', minWidth: '100px !important' },
                            '& th:nth-of-type(3), & td:nth-of-type(3)': { width: '80px !important', maxWidth: '80px !important' },
                            '& th:nth-of-type(4), & td:nth-of-type(4)': { width: '40px !important', maxWidth: '40px !important' }
                        }
                    }}
                >
                    <Thead>
                        <Tr>
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
                                {t('colLeague')}
                            </Th>
                            <Th
                                px={{ base: 1, md: 4 }}
                                fontSize={{ base: "xs", md: "sm" }}
                                display={{ base: "none", md: "table-cell" }}
                            >
                                {t('colActions')}
                            </Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {groups.map((group) => (
                            <Tr key={group.id}>
                                <Td fontWeight="bold" px={{ base: 1, md: 4 }} fontSize={{ base: "xs", md: "sm" }}>
                                    {group.id}
                                </Td>
                                <Td px={{ base: 1, md: 4 }}>
                                    {editGroupId === group.id ? (
                                        <Input
                                            value={editGroupData.name}
                                            onChange={(e) =>
                                                setEditGroupData({ ...editGroupData, name: e.target.value })
                                            }
                                            borderColor="cyan.600"
                                            focusBorderColor="cyan.400"
                                            size={{ base: "sm", md: "md" }}
                                        />
                                    ) : (
                                        <Box fontSize={{ base: "xs", md: "sm" }} wordBreak="break-word">
                                            {group.name}
                                        </Box>
                                    )}
                                </Td>
                                <Td px={{ base: 1, md: 4 }}>
                                    {editGroupId === group.id ? (
                                        <Select
                                            value={editGroupData.league} //TODO: update number for best and worst leagues if necessary
                                            onChange={(e) =>
                                                setEditGroupData({ ...editGroupData, league: e.target.value })
                                            }
                                            borderColor="cyan.600"
                                            focusBorderColor="cyan.400"
                                            size={{ base: "sm", md: "md" }}
                                        >
                                            {LeagueNames.map((league) => (
                                                <option key={league} value={league}>
                                                    {localize(LeagueDisplayNames[league])}
                                                </option>
                                            ))}
                                        </Select>
                                    ) : (
                                        <Box fontSize={{ base: "xs", md: "sm" }}>
                                            {localize(LeagueDisplayNames[group.league_history.current_league])}
                                        </Box>
                                    )}
                                </Td>
                                <Td px={{ base: 1, md: 4 }}>
                                    {editGroupId === group.id ? (
                                        <HStack spacing={1} flexDirection={{ base: "column", md: "row" }}>
                                            <IconButton
                                                icon={<CheckIcon />}
                                                colorScheme="green"
                                                onClick={confirmEditing}
                                                size="xs"
                                                isLoading={updateMutation.isPending}
                                            />
                                            <IconButton
                                                icon={<CloseIcon />}
                                                colorScheme="red"
                                                onClick={cancelEditing}
                                                size="xs"
                                            />
                                        </HStack>
                                    ) : (
                                        <HStack spacing={1} flexDirection={{ base: "column", md: "row" }}>
                                            <IconButton
                                                icon={<EditIcon />}
                                                colorScheme="cyan"
                                                onClick={() => startEditing(group)}
                                                size="xs"
                                            />
                                            <IconButton
                                                icon={<DeleteIcon />}
                                                colorScheme="pink"
                                                onClick={() => handleDelete(group.id)}
                                                size="xs"
                                                isLoading={deleteMutation.isPending && deleteMutation.variables === group.id}
                                            />
                                        </HStack>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </Box>
        </Box>
    );
};

GroupPanel.propTypes = {
    selected: PropTypes.bool.isRequired
}

export default GroupPanel;
