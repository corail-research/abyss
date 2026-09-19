import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    TableContainer,
    Button,
    VStack,
    Box,
    useBreakpointValue
} from '@chakra-ui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import ErrorPopup from './ErrorPopup';
import AgentItem from './AgentItem';
import AlertVerification from './AlertVerification';
import UploadAgentModal from './UploadAgentModal';

import { putAgentDelete } from '../api/agents/agents.ts';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../constants/constants.js';

const AgentList = ({ agents, onAgentDeleted }) => {
    const colors = useColors();
    const { authState } = useAuth();
    const queryClient = useQueryClient();
    const { t } = useTranslation('agentList');

    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [agentToDelete, setAgentToDelete] = useState(null);

    // Detect whether we are on mobile
    const isMobile = useBreakpointValue({ base: true, md: false, lg: false });

    const deleteMutation = useMutation({
        mutationFn: (agentId) => putAgentDelete(agentId, authState.options),
        onSuccess: (_, agentId) => {
            setIsDialogOpen(false);
            if (onAgentDeleted) {
                onAgentDeleted(agentId);
            }
        },
        onError: (error) => {
            setErrorMessage(error?.response?.data?.message || t('deleteError'));
            setShowError(true);
            setIsDialogOpen(false);
        },
    });

    const handleDeleteAgent = () => {
        if (agentToDelete) {
            deleteMutation.mutate(agentToDelete.id);
        }
    };

    const openDeleteDialog = (agent) => {
        setAgentToDelete(agent);
        setIsDialogOpen(true);
    };

    // Empty state
    if (!agents || agents.length === 0) {
        return (
            <VStack spacing={4} w="100%">
                <Box textAlign="center" py={8} color="gray.500">
                    {t('noAgentsFound')}
                </Box>
                <UploadAgentModal />
            </VStack>
        );
    }

    return (
        <>
            <ErrorPopup
                message={errorMessage}
                onClose={() => setShowError(false)}
                isOpen={showError}
            />
            <AlertVerification
                isDialogOpen={isDialogOpen}
                setIsDialogOpen={setIsDialogOpen}
                handleDelete={handleDeleteAgent}
                name={agentToDelete?.name || ''}
                isLoading={deleteMutation.isPending}
            />

            <VStack>
                {/* Table layout - tablet and desktop */}
                {!isMobile && (
                    <TableContainer marginY={4} w="100%">
                        <Table
                            variant='striped'
                            mt={5}
                            bgColor={colors.tabBg}
                            size={{ base: 'lg', md: 'sm', lg: 'lg' }}
                            borderRadius={'lg'}
                            boxShadow={'md'}
                        >
                            <Thead>
                                <Tr>
                                    <Th textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }}></Th>
                                    <Th textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }}>{t('columnName')}</Th>
                                    <Th textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }}>{t('columnPerformance')}</Th>
                                    <Th textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }}>{t('columnElo')}</Th>
                                    <Th textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }}>{t('columnActive')}</Th>
                                    <Th textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }}>{t('columnActions')}</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {agents.map((agent) => (
                                    <AgentItem
                                        key={agent.id}
                                        agent={agent}
                                        setErrorMessage={setErrorMessage}
                                        setShowError={setShowError}
                                        openDeleteDialog={openDeleteDialog}
                                        isMobile={false}
                                    />
                                ))}
                            </Tbody>
                        </Table>
                    </TableContainer>
                )}

                {/* Card layout - mobile */}
                {isMobile && (
                    <VStack spacing={4} w="100%" mt={4}>
                        {agents.map((agent) => (
                            <AgentItem
                                key={agent.id}
                                agent={agent}
                                setErrorMessage={setErrorMessage}
                                setShowError={setShowError}
                                openDeleteDialog={openDeleteDialog}
                                isMobile={true}
                            />
                        ))}
                    </VStack>
                )}

                <UploadAgentModal />
            </VStack>
        </>
    );
};

AgentList.propTypes = {
    agents: PropTypes.array.isRequired,
    onAgentDeleted: PropTypes.func,
}

export default AgentList;
