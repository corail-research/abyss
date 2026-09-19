import React from 'react';
import {
    Box,
    Flex,
    HStack,
    VStack,
    Skeleton,
} from '@chakra-ui/react';
import FightCardSkeleton from './FightCardSkeleton';

/**
 * Skeleton matching the shape of FightList.
 * Includes:
 *  - a top bar (pagination + "Go to page" controls)
 *  - a list of fight rows, each with download buttons
 */
const FightListSkeleton = ({ rows = 4 }) => {
    return (
        <Box
            padding={4}
            bgColor="white"
            maxW="5xl"
            margin="auto"
            borderRadius="lg"
            boxShadow="xl"
        >
            <Flex alignItems="center" flexDirection="column" gap={4}>
                {/* ─── Pagination bar skeleton ─── */}
                <HStack
                    justifyContent="space-between"
                    alignItems="center"
                    width="100%"
                    flexWrap="wrap"
                    gap={2}
                >
                    {/* Pagination buttons */}
                    <HStack spacing={2}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} height="32px" width="36px" borderRadius="md" />
                        ))}
                    </HStack>

                    {/* Page input + Go button */}
                    <HStack>
                        <Skeleton height="36px" width="100px" borderRadius="md" />
                        <Skeleton height="36px" width="50px" borderRadius="md" />
                    </HStack>
                </HStack>

                {/* ─── Fight rows ─── */}
                <VStack spacing={4} width="100%">
                    {Array.from({ length: rows }).map((_, i) => (
                        <VStack key={i} width="100%" spacing={3}>
                            {/* Desktop / tablet: card + buttons side by side */}
                            <HStack
                                display={{ base: 'none', md: 'flex' }}
                                width="100%"
                                alignItems="center"
                            >
                                <Box flex="1">
                                    <FightCardSkeleton />
                                </Box>

                                {/* Download buttons column */}
                                <VStack spacing={2}>
                                    <Skeleton height="32px" width="70px" borderRadius="md" />
                                    <Skeleton height="32px" width="70px" borderRadius="md" />
                                </VStack>
                            </HStack>

                            {/* Mobile: card on top, buttons below */}
                            <VStack
                                display={{ base: 'flex', md: 'none' }}
                                width="100%"
                                spacing={3}
                                align="stretch"
                            >
                                <Box width="100%">
                                    <FightCardSkeleton />
                                </Box>
                                <HStack spacing={3} justify="center" width="100%">
                                    <Skeleton height="32px" flex="1" maxW="150px" borderRadius="md" />
                                    <Skeleton height="32px" flex="1" maxW="150px" borderRadius="md" />
                                </HStack>
                            </VStack>
                        </VStack>
                    ))}
                </VStack>
            </Flex>
        </Box>
    );
};

export default FightListSkeleton;
