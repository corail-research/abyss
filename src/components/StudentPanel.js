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
    useBreakpointValue
} from '@chakra-ui/react';
import { EditIcon, CheckIcon, CloseIcon, DeleteIcon } from '@chakra-ui/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import Loading from './Loading.js';
import ErrorMessage from './ErrorMessage.js';

import { getStudentCollectionAdmin, postStudentCollection, patchStudentItem, deleteStudentItem } from '../api/students/students.ts';
import { getGroupCollection } from '../api/groups/groups.ts';
import { useAuth } from '../context/AuthContext.jsx';
import { useColors } from '../constants/constants.js';

const MAX_STALE_TIME = 5 * 60 * 1000;

const StudentPanel = ({ selected }) => {
    const [newStudent, setNewStudent] = useState({ username: '', id: '', role: 'student', group_id: '', password: '' });
    const [editStudentId, setEditStudentId] = useState(null);
    const [editStudentData, setEditStudentData] = useState({});
    const toast = useToast();
    const colors = useColors();
    const { authState } = useAuth();
    const queryClient = useQueryClient();
    const { t } = useTranslation('studentPanel');

    // Detect if we're on tablet (between mobile and desktop)
    const isTablet = useBreakpointValue({ base: false, md: true, lg: false }, { ssr: false });
    // Detect if we're on mobile
    const isMobile = useBreakpointValue({ base: true, md: false }, { ssr: false });

    const {
        data: students = [],
        isLoading: studentsLoading,
        error: studentsError,
    } = useQuery({
        queryKey: ['admin', 'students'],
        queryFn: async () => {
            const options = { ...authState.options, headers: { ...authState.options?.headers, "X-Fields": "id,username,group_id,role" } };
            return await getStudentCollectionAdmin(options);
        },
        enabled: selected && !!authState?.options,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const {
        data: groups = {},
        isLoading: groupsLoading,
        error: groupsError,
    } = useQuery({
        queryKey: ['admin', 'groups', 'id,name'],
        queryFn: async () => {
            const response = await getGroupCollection({}, { headers: { "X-Fields": "id,name" } });
            const map = {};
            response.forEach((g) => (map[g.id] = g.name));
            return map;
        },
        enabled: selected && !!authState?.options,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1,
    });

    const createMutation = useMutation({
        mutationFn: (data) => postStudentCollection(data, authState.options),
        onSuccess: () => {
            toast({ title: t('created'), status: "success", duration: 5000, isClosable: true });
            setNewStudent({ username: '', id: '', group_id: '', role: 'student', password: '' });
            queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
        },
        onError: () => {
            toast({ title: t('createError'), status: "error", duration: 5000, isClosable: true });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => patchStudentItem(id, data, authState.options),
        onSuccess: () => {
            toast({ title: t('updated'), status: "success", duration: 5000, isClosable: true });
            setEditStudentId(null);
            setEditStudentData({});
            queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
        },
        onError: () => {
            toast({ title: t('updatedError'), status: "error", duration: 5000, isClosable: true });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => deleteStudentItem(id, authState.options),
        onSuccess: () => {
            toast({ title: t('deleted'), status: "success", duration: 5000, isClosable: true });
            queryClient.invalidateQueries({ queryKey: ['admin', 'students'] });
        },
        onError: () => {
            toast({ title: t('deletedError'), status: "error", duration: 5000, isClosable: true });
        },
    });

    const handleCreate = useCallback(() => {
        createMutation.mutate(newStudent);
    }, [newStudent, createMutation]);

    const handleUpdate = useCallback((id) => {
        const data = { ...editStudentData };
        if (data.password === '') delete data.password;
        updateMutation.mutate({ id, data });
    }, [editStudentData, updateMutation]);

    const handleDelete = useCallback((id) => {
        deleteMutation.mutate(id);
    }, [deleteMutation]);

    const startEditing = (student) => {
        setEditStudentId(student.id);
        const { password, ...rest } = student;
        setEditStudentData(rest);
    };

    const cancelEditing = () => {
        setEditStudentId(null);
        setEditStudentData({});
    };

    const confirmEditing = useCallback(() => {
        if (editStudentId) handleUpdate(editStudentId);
    }, [editStudentId, handleUpdate]);

    if (studentsLoading || groupsLoading) return <Loading />;
    if (studentsError || groupsError) return <ErrorMessage message={t('loadError')} />;

    return (
        <Box p={{ sm: 0, md: 5, lg: 5 }} bg={colors.panelBg} borderRadius="md" mx="auto" w={{ sm: "100%", md: "95%", lg: "80%" }} boxShadow="lg">
            <Box p={5} bg={colors.lighterPanelBg} borderRadius="md" mx="auto" w={{ sm: "100%", md: "50%" }} boxShadow="md">
                <VStack spacing={4}>
                    <Box fontSize="xl" fontWeight="bold" mb={4}>
                        {t('createTitle')}
                    </Box>
                    <FormControl as='form' autoComplete="off">
                        <HStack justify="space-between">
                            <FormLabel w="30%" textAlign="left" fontWeight="bold">{t('labelName')}</FormLabel>
                            <Input
                                w="70%"
                                placeholder={t('placeholderName')}
                                value={newStudent.username}
                                onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                                borderColor="cyan.600"
                                focusBorderColor="cyan.400"
                            />
                        </HStack>
                    </FormControl>
                    <FormControl as='form' autoComplete="off">
                        <HStack justify="space-between">
                            <FormLabel w="30%" textAlign="left" fontWeight="bold">{t('labelId')}</FormLabel>
                            <Input
                                w="70%"
                                placeholder={t('placeholderId')}
                                value={newStudent.id}
                                onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
                                borderColor="cyan.600"
                                focusBorderColor="cyan.400"
                            />
                        </HStack>
                    </FormControl>
                    <FormControl as='form' autoComplete="off">
                        <HStack justify="space-between">
                            <FormLabel w="30%" textAlign="left" fontWeight="bold">{t('labelRole')}</FormLabel>
                            <Select
                                w="70%"
                                placeholder={t('placeholderRole')}
                                value={newStudent.role}
                                onChange={(e) => setNewStudent({ ...newStudent, role: e.target.value })}
                                borderColor="cyan.600"
                                focusBorderColor="cyan.400"
                            >
                                <option value="student">{t('roleStudent')}</option>
                                <option value="admin">{t('roleAdmin')}</option>
                            </Select>
                        </HStack>
                    </FormControl>
                    <FormControl as='form' autoComplete="off">
                        <HStack justify="space-between">
                            <FormLabel w="30%" textAlign="left" fontWeight="bold">{t('labelGroup')}</FormLabel>
                            <Select
                                w="70%"
                                placeholder={t('placeholderGroup')}
                                value={newStudent.group_id}
                                onChange={(e) => setNewStudent({ ...newStudent, group_id: e.target.value })}
                                borderColor="cyan.600"
                                focusBorderColor="cyan.400"
                            >
                                {Object.keys(groups).map((key) => (
                                    <option key={key} value={key}>{groups[key]}</option>
                                ))}
                            </Select>
                        </HStack>
                    </FormControl>
                    <FormControl as='form' autoComplete="off">
                        <HStack justify="space-between">
                            <FormLabel w="30%" textAlign="left" fontWeight="bold">{t('labelPassword')}</FormLabel>
                            <Input
                                w="70%"
                                placeholder={t('placeholderPassword')}
                                type="password"
                                value={newStudent.password}
                                onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                                borderColor="cyan.600"
                                focusBorderColor="cyan.400"
                            />
                        </HStack>
                    </FormControl>
                    <Button colorScheme="cyan" onClick={handleCreate} isLoading={createMutation.isPending} loadingText={t('creating')} >
                        {t('createButton')}
                    </Button>
                </VStack>
            </Box>

            <Table
                variant={isMobile ? "simple" : "striped"}
                bgColor={colors.tabBg}
                mt={20}
                borderRadius="md"
                boxShadow="md"
                size={isTablet ? "sm" : "md"}
            >
                <Thead>
                    {isMobile ? (
                        <>
                            <Tr>
                                <Th fontSize="xs" width="25%" px={1}>{t('colId')}</Th>
                                <Th fontSize="xs" width="20%" px={1}>{t('colRole')}</Th>
                                <Th fontSize="xs" width="55%" px={1}>{t('colName')}</Th>
                            </Tr>
                            <Tr>
                                <Th fontSize="xs" width="25%" px={1}>{t('colGroup')}</Th>
                                <Th fontSize="xs" width="20%" px={1}>{t('colPwdShort')}</Th>
                                <Th fontSize="xs" width="55%" px={1}>{t('colActions')}</Th>
                            </Tr>
                        </>
                    ) : (
                        <Tr>
                            <Th fontSize={isTablet ? "xs" : "sm"} width={isTablet ? "60px" : "auto"}>{t('colId')}</Th>
                            <Th fontSize={isTablet ? "xs" : "sm"} width={isTablet ? "80px" : "auto"}>{t('colRole')}</Th>
                            <Th fontSize={isTablet ? "xs" : "sm"} width={isTablet ? "120px" : "auto"}>{t('colName')}</Th>
                            <Th fontSize={isTablet ? "xs" : "sm"} width={isTablet ? "100px" : "auto"}>{t('colGroup')}</Th>
                            <Th fontSize={isTablet ? "xs" : "sm"} width={isTablet ? "80px" : "auto"}>{t('colPassword')}</Th>
                            <Th fontSize={isTablet ? "xs" : "sm"} width={isTablet ? "120px" : "auto"}>{t('colActions')}</Th>
                        </Tr>
                    )}
                </Thead>
                <Tbody>
                    {students.map((student, index) => (
                        isMobile ? (
                            // Mobile version: two rows per student, colored in pairs
                            <React.Fragment key={student.id}>
                                {/* First row: ID, Role, Name */}
                                <Tr bg={index % 2 === 0 ? "gray.50" : undefined}>
                                    <Td fontWeight="bold" fontSize="xs" width="25%" px={1}>
                                        {student.id}
                                    </Td>
                                    <Td fontSize="xs" width="20%" px={1}>
                                        {editStudentId === student.id ? (
                                            <Select
                                                value={editStudentData.role}
                                                onChange={(e) =>
                                                    setEditStudentData({ ...editStudentData, role: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            >
                                                <option value="student">{t('roleStudent')}</option>
                                                <option value="admin">{t('roleAdmin')}</option>
                                            </Select>
                                        ) : (
                                            student.role === 'student' ? t('roleStudent') : t('roleAdmin')
                                        )}
                                    </Td>
                                    <Td fontSize="xs" width="55%" whiteSpace="normal" wordBreak="break-word" px={1}>
                                        {editStudentId === student.id ? (
                                            <Input
                                                value={editStudentData.username}
                                                onChange={(e) =>
                                                    setEditStudentData({ ...editStudentData, username: e.target.value })
                                                }
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            />
                                        ) : (
                                            student.username
                                        )}
                                    </Td>
                                </Tr>
                                {/* Second row: Group, Pwd, Actions */}
                                <Tr bg={index % 2 === 0 ? "gray.50" : undefined}>
                                    <Td fontSize="xs" width="25%" whiteSpace="normal" wordBreak="break-word" px={1}>
                                        {editStudentId === student.id ? (
                                            <Select
                                                value={editStudentData.group_id}
                                                onChange={(e) =>
                                                    setEditStudentData({ ...editStudentData, group_id: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            >
                                                {Object.keys(groups).map((key) => (
                                                    <option key={key} value={key}>{groups[key]}</option>
                                                ))}
                                            </Select>
                                        ) : (
                                            groups[student.group_id]
                                        )}
                                    </Td>
                                    <Td fontSize="xs" width="20%" px={1}>
                                        {editStudentId === student.id ? (
                                            <Input
                                                placeholder={t('placeholderPwdShort')}
                                                type="password"
                                                onChange={(e) =>
                                                    setEditStudentData({ ...editStudentData, password: e.target.value })}
                                                borderColor="cyan.600"
                                                focusBorderColor="cyan.400"
                                                size="sm"
                                            />
                                        ) : ('...')}
                                    </Td>
                                    <Td width="55%" px={1}>
                                        {editStudentId === student.id ? (
                                            <HStack spacing={1}>
                                                <IconButton
                                                    icon={<CheckIcon />}
                                                    colorScheme="green"
                                                    onClick={confirmEditing}
                                                    size="sm"
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
                                                    onClick={() => startEditing(student)}
                                                    size="sm"
                                                />
                                                <IconButton
                                                    icon={<DeleteIcon />}
                                                    colorScheme="pink"
                                                    onClick={() => handleDelete(student.id)}
                                                    size="sm"
                                                    isLoading={deleteMutation.isPending && deleteMutation.variables === student.id}
                                                />
                                            </HStack>
                                        )}
                                    </Td>
                                </Tr>
                            </React.Fragment>
                        ) : (
                            // Tablet/desktop version: one row per student
                            <Tr key={student.id}>
                                <Td
                                    fontWeight="bold"
                                    fontSize={isTablet ? "xs" : "sm"}
                                    width={isTablet ? "60px" : "auto"}
                                >
                                    {student.id}
                                </Td>
                                <Td
                                    fontSize={isTablet ? "xs" : "sm"}
                                    width={isTablet ? "80px" : "auto"}
                                    whiteSpace={isTablet ? "normal" : "nowrap"}
                                    wordBreak={isTablet ? "break-word" : "normal"}
                                >
                                    {editStudentId === student.id ? (
                                        <Select
                                            value={editStudentData.role}
                                            onChange={(e) =>
                                                setEditStudentData({ ...editStudentData, role: e.target.value })}
                                            borderColor="cyan.600"
                                            focusBorderColor="cyan.400"
                                            size={isTablet ? "sm" : "md"}
                                        >
                                            <option value="student">{t('roleStudent')}</option>
                                            <option value="admin">{t('roleAdmin')}</option>
                                        </Select>
                                    ) : (
                                        student.role === 'student' ? 'Student' : 'Admin'
                                    )}
                                </Td>

                                <Td
                                    fontSize={isTablet ? "xs" : "sm"}
                                    width={isTablet ? "120px" : "auto"}
                                    whiteSpace={isTablet ? "normal" : "nowrap"}
                                    wordBreak={isTablet ? "break-word" : "normal"}
                                >
                                    {editStudentId === student.id ? (
                                        <Input
                                            value={editStudentData.username}
                                            onChange={(e) =>
                                                setEditStudentData({ ...editStudentData, username: e.target.value })
                                            }
                                            borderColor="cyan.600"
                                            focusBorderColor="cyan.400"
                                            size={isTablet ? "sm" : "md"}
                                        />
                                    ) : (student.username)}
                                </Td>
                                <Td
                                    fontSize={isTablet ? "xs" : "sm"}
                                    width={isTablet ? "100px" : "auto"}
                                    whiteSpace={isTablet ? "normal" : "nowrap"}
                                    wordBreak={isTablet ? "break-word" : "normal"}
                                >
                                    {editStudentId === student.id ? (
                                        <Select
                                            value={editStudentData.group_id}
                                            onChange={(e) =>
                                                setEditStudentData({ ...editStudentData, group_id: e.target.value })}
                                            borderColor="cyan.600"
                                            focusBorderColor="cyan.400"
                                            size={isTablet ? "sm" : "md"}
                                        >
                                            {Object.keys(groups).map((key) => (
                                                <option key={key} value={key}>{groups[key]}</option>
                                            ))}
                                        </Select>
                                    ) : (groups[student.group_id])}
                                </Td>
                                <Td
                                    fontSize={isTablet ? "xs" : "sm"}
                                    width={isTablet ? "80px" : "auto"}
                                    whiteSpace={isTablet ? "normal" : "nowrap"}
                                    wordBreak={isTablet ? "break-word" : "normal"}
                                >
                                    {editStudentId === student.id ? (
                                        <Input
                                            placeholder={t('placeholderPassword')}
                                            type="password"
                                            //value={editStudentData.password}
                                            onChange={(e) =>
                                                setEditStudentData({ ...editStudentData, password: e.target.value })}
                                            borderColor="cyan.600"
                                            focusBorderColor="cyan.400"
                                            size={isTablet ? "sm" : "md"}
                                        />
                                    ) : ('...')}
                                </Td>
                                <Td width={isTablet ? "120px" : "auto"}>
                                    {editStudentId === student.id ? (
                                        <HStack spacing={isTablet ? 1 : 2}>
                                            <IconButton
                                                icon={<CheckIcon />}
                                                colorScheme="green"
                                                onClick={confirmEditing}
                                                size={isTablet ? "sm" : "md"}
                                            />
                                            <IconButton
                                                icon={<CloseIcon />}
                                                colorScheme="red"
                                                onClick={cancelEditing}
                                                size={isTablet ? "sm" : "md"}
                                            />
                                        </HStack>
                                    ) : (
                                        <HStack spacing={isTablet ? 1 : 2}>
                                            <IconButton
                                                icon={<EditIcon />}
                                                colorScheme="cyan"
                                                onClick={() => startEditing(student)}
                                                size={isTablet ? "sm" : "md"}
                                            />
                                            <IconButton
                                                icon={<DeleteIcon />}
                                                colorScheme="pink"
                                                onClick={() => handleDelete(student.id)}
                                                size={isTablet ? "sm" : "md"}
                                                isLoading={deleteMutation.isPending && deleteMutation.variables === student.id}
                                            />
                                        </HStack>
                                    )}
                                </Td>
                            </Tr>
                        )
                    ))}
                </Tbody>
            </Table>
        </Box>
    );
};

StudentPanel.propTypes = {
    selected: PropTypes.bool.isRequired
};

export default StudentPanel;
