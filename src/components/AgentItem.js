import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
    Tr, Td, Switch, IconButton, Box, Flex, Text, HStack
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { DownloadIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';

import StatusIconWithMessage from './StatusIcon.js';

import { putAgentToggleActive } from '../api/agents/agents.ts';
import { AgentStatus } from '../constants/constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useColors } from '../constants/constants.js';
import { getAgentDownload } from '../api/agents/agents.ts';

const AgentItem = ({
    agent,
    setErrorMessage,
    setShowError,
    openDeleteDialog,
    isMobile = false
}) => {
    const [isActive, setIsActive] = useState(agent.status === AgentStatus.ACTIVE);
    const { authState } = useAuth();
    const colors = useColors();
    const { t } = useTranslation('agentList');

    const toggleActiveStatus = async () => {
        try {
            const updatedStatus = !isActive ? AgentStatus.ACTIVE : AgentStatus.INACTIVE;
            const response = await putAgentToggleActive(agent.id, authState.options);
            setIsActive(response.status === AgentStatus.ACTIVE);
            if (updatedStatus !== response.status) {
                setErrorMessage(t('cannotActivate'));
                setShowError(true);
            }
        } catch (error) {
            setErrorMessage(t('updateStatusError'));
            setShowError(true);
        }
    };

    const downLoadAgent = async () => {
        try {
            const response = await getAgentDownload(agent.id, { responseType: 'blob', ...authState.options });
            const url = window.URL.createObjectURL(response);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${agent.name}.zip`;
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            setErrorMessage(t('downloadError'));
            setShowError(true);
        };
    };

    const handleDeleteClick = () => {
        openDeleteDialog(agent);
    }

    // Mobile view
    if (isMobile) {
        return (
            <Box
                bg={colors.tabBg}
                borderRadius="lg"
                p={4}
                w="100%"
                boxShadow="md"
            >
                <Flex align="center" justify="flex-start" mb={3}>
                    <Box mr={3}>
                        <StatusIconWithMessage
                            status={agent.status}
                            errorInfo={agent.refusal_message}
                        />
                    </Box>
                    <Text fontSize="lg" fontWeight="bold" flex={1} noOfLines={1} textAlign="center">
                        {agent.name}
                    </Text>
                </Flex>

                {/* Second row: Performance + ELO */}
                <Flex justify="space-between" align="center" mb={3}>
                    <Text fontSize="md" color="gray.600">
                        {t('recordShort', { wins: agent.n_victories, losses: agent.n_defeats })}
                    </Text>
                    <Text fontSize="md" fontWeight="semibold">
                        {t('eloLabel', { elo: agent.elo })}
                    </Text>
                </Flex>

                {/* Third row: Active switch + action buttons */}
                <Flex justify="space-between" align="center">
                    <Flex align="center">
                        <Text fontSize="sm" mr={2}>{t('activeLabel')}</Text>
                        <Switch
                            isChecked={isActive}
                            colorScheme="pink"
                            onChange={toggleActiveStatus}
                            size="sm"
                        />
                    </Flex>
                    <HStack spacing={2}>
                        <IconButton
                            icon={<DeleteIcon />}
                            colorScheme="pink"
                            onClick={handleDeleteClick}
                            aria-label={t('deleteAriaLabel')}
                            size="sm"
                        />
                        <IconButton
                            icon={<DownloadIcon />}
                            colorScheme="teal"
                            onClick={downLoadAgent}
                            aria-label={t('downloadAriaLabel')}
                            size="sm"
                        />
                    </HStack>
                </Flex>
            </Box>
        );
    }

    // Desktop/Tablet view
    return (
        <Tr>
            <Td textAlign="center" px={{ base: 4, md: 2, lg: 4 }} py={{ base: 4, md: 2, lg: 4 }}>
                <StatusIconWithMessage
                    status={agent.status}
                    errorInfo={agent.refusal_message}
                />
            </Td>
            <Td textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }} py={{ base: 4, md: 2, lg: 4 }}>{agent.name}</Td>
            <Td textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }} py={{ base: 4, md: 2, lg: 4 }}>{t('recordShort', { wins: agent.n_victories, losses: agent.n_defeats })}</Td>
            <Td textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }} py={{ base: 4, md: 2, lg: 4 }}>{agent.elo}</Td>
            <Td textAlign="center" fontSize={{ base: 'lg', md: 'sm', lg: 'lg' }} px={{ base: 4, md: 2, lg: 4 }} py={{ base: 4, md: 2, lg: 4 }}>
                <Switch isChecked={isActive} colorScheme="pink" onChange={toggleActiveStatus} size={{ base: "md", md: "sm", lg: "md" }} />
            </Td>
            <Td textAlign="center" px={{ base: 4, md: 2, lg: 4 }} py={{ base: 4, md: 2, lg: 4 }}>
                <IconButton
                    icon={<DeleteIcon />}
                    colorScheme="pink"
                    onClick={handleDeleteClick}
                    aria-label="Delete agent"
                    size={{ base: "md", md: "sm", lg: "md" }}
                />
                <IconButton
                    icon={<DownloadIcon />}
                    colorScheme="teal"
                    onClick={downLoadAgent}
                    aria-label="Download agent"
                    ml={{ base: 3, md: 2, lg: 3 }}
                    size={{ base: "md", md: "sm", lg: "md" }}
                />
            </Td>
        </Tr>
    );
};

AgentItem.propTypes = {
    agent: PropTypes.object.isRequired,
    setErrorMessage: PropTypes.func.isRequired,
    setShowError: PropTypes.func.isRequired,
    openDeleteDialog: PropTypes.func.isRequired,
    isMobile: PropTypes.bool
}

export default AgentItem;
