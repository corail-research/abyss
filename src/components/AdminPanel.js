import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Button,
    Input,
    VStack,
    HStack,
    useToast,
    FormControl,
    FormLabel
} from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import Loading from './Loading';

import { useColors } from '../constants/constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getArenaState, patchArenaState } from '../api/arena/arena.ts';

const MAX_STALE_TIME = 30 * 1000;

const AdminPanel = ({ selected }) => {
    const toast = useToast();
    const colors = useColors();
    const { authState } = useAuth();
    const queryClient = useQueryClient();
    const { t } = useTranslation('adminPanel');

    const [numSimultaneousMatches, setNumSimultaneousMatches] = useState(0);

    const {
        data: arena,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['arena', 'state'],
        queryFn: async () => {
            const response = await getArenaState(authState.options);
            return response;
        },
        enabled: selected && !!authState.options,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 1
    });

    useEffect(() => {
        if (arena) setNumSimultaneousMatches(arena.parallel_match);
    }, [arena]);

    const updateParallelMutation = useMutation({
        mutationFn: (parallelMatch) =>
            patchArenaState({ parallel_match: parallelMatch }, authState.options),
        onSuccess: () => {
            toast({
                title: t('parallelUpdateSuccess'),
                status: 'success',
                duration: 5000,
                isClosable: true,
            });
            queryClient.invalidateQueries({ queryKey: ['arena', 'state'] });
        },
        onError: () => {
            toast({
                title: t('parallelUpdateError'),
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        },
    });

    const toggleStateMutation = useMutation({
        mutationFn: (newState) =>
            patchArenaState({ state: newState }, authState.options),
        onSuccess: () => {
            toast({
                title: arena?.state ? t('matchesStopped') : t('matchesStarted'),
                status: 'success',
                duration: 5000,
                isClosable: true,
            });
            queryClient.invalidateQueries({ queryKey: ['arena', 'state'] });
        },
        onError: () => {
            toast({
                title: t('toggleError'),
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        },
    });

    const handleNumberChange = (value) => {
        setNumSimultaneousMatches(parseInt(value, 10) || 0);
    };

    const handleNumberMatch = useCallback(() => {
        if (numSimultaneousMatches !== null && numSimultaneousMatches !== arena?.parallel_match) {
            updateParallelMutation.mutate(numSimultaneousMatches);
        }
    }, [numSimultaneousMatches, arena, updateParallelMutation]);

    const handleState = useCallback(() => {
        if (arena) toggleStateMutation.mutate(!arena.state);
    }, [arena, toggleStateMutation]);

    const isNumberChanged = useMemo(
        () => numSimultaneousMatches !== arena?.parallel_match,
        [numSimultaneousMatches, arena]
    );

    useEffect(() => {
        if (error) {
            toast({
                title: t('loadError'),
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    }, [error, toast, t]);

    if (isLoading) return (
        <Box
            p={{ base: 4, md: 5, lg: 5 }}
            bg={colors.panelBg}
            borderRadius="md"
            mx="auto"
            w={{ base: '95%', md: '80%', lg: '50%' }}
            boxShadow="lg"
        >
            <Loading size="md" minHeight="200px" />
        </Box>
    );
    if (error) return null;
    if (!arena) return null;

    return (
        <Box
            p={{ base: 4, md: 5, lg: 5 }}
            bg={colors.panelBg}
            borderRadius="md"
            mx="auto"
            w={{ base: "95%", md: "80%", lg: "50%" }}
            boxShadow="lg"
        >
            <VStack spacing={4}>
                <Box fontSize="xl" fontWeight="bold" mb={4}>
                    {t('sectionTitle')}
                </Box>
                <FormControl>
                    <HStack justify="space-between">
                        <FormLabel w="50%" textAlign="left" fontWeight="bold">
                            {t('parallelLabel')}
                        </FormLabel>
                        <Input
                            w="50%"
                            type="number"
                            value={numSimultaneousMatches}
                            onChange={(e) => handleNumberChange(e.target.value)}
                            borderColor="cyan.600"
                            focusBorderColor="cyan.400"
                            isDisabled={updateParallelMutation.isPending}
                        />
                        <Button
                            colorScheme="blue"
                            onClick={handleNumberMatch}
                            isDisabled={!isNumberChanged || updateParallelMutation.isPending}
                            isLoading={updateParallelMutation.isPending}
                            loadingText={t('updating')}
                        >
                            {t('updateButton')}
                        </Button>
                    </HStack>
                </FormControl>

                {/* Buttons: VStack on mobile, HStack on tablet/desktop */}
                <VStack
                    spacing={4}
                    mt={15}
                    width="100%"
                    display={{ base: "flex", md: "none", lg: "none" }}
                >
                    <Button
                        colorScheme="green"
                        onClick={handleState}
                        isDisabled={arena.state || toggleStateMutation.isPending}
                        isLoading={toggleStateMutation.isPending}
                        loadingText={t('starting')}
                        width="100%"
                    >
                        {t('startButton')}
                    </Button>
                    <Button
                        colorScheme="red"
                        onClick={handleState}
                        isDisabled={!arena.state || toggleStateMutation.isPending}
                        isLoading={toggleStateMutation.isPending}
                        loadingText={t('stopping')}
                        width="100%"
                    >
                        {t('stopButton')}
                    </Button>
                </VStack>
                <HStack
                    spacing={4}
                    mt={15}
                    width="100%"
                    justify="center"
                    display={{ base: "none", md: "flex", lg: "flex" }}
                >
                    <Button
                        colorScheme="green"
                        onClick={handleState}
                        isDisabled={arena.state || toggleStateMutation.isPending}
                        isLoading={toggleStateMutation.isPending}
                        loadingText={t('starting')}
                    >
                        {t('startButton')}
                    </Button>
                    <Button
                        colorScheme="red"
                        onClick={handleState}
                        isDisabled={!arena.state || toggleStateMutation.isPending}
                        isLoading={toggleStateMutation.isPending}
                        loadingText={t('stopping')}
                    >
                        {t('stopButton')}
                    </Button>
                </HStack>
            </VStack>
        </Box>
    );
};

AdminPanel.propTypes = {
    selected: PropTypes.bool.isRequired
}

export default AdminPanel;
