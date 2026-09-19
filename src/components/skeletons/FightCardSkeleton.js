import React from 'react';
import { Box, Flex, Skeleton, SkeletonCircle } from '@chakra-ui/react';

/**
 * Skeleton matching the shape of FightCard.
 * Renders two variants: mobile (stacked) and desktop (horizontal).
 */
const FightCardSkeleton = () => {
    // ─── Desktop / Tablet version ───
    const desktopView = (
        <Flex
            display={{ base: 'none', md: 'flex' }}
            bg="white"
            boxShadow="md"
            borderRadius="3xl"
            p={6}
            align="center"
            justify="space-between"
            w="full"
        >
            {/* Player 1 block */}
            <Box flex="1" textAlign="center" py={4} px={2} borderRadius="2xl">
                <Skeleton height="20px" width="70%" mx="auto" mb={2} />
                <Skeleton height="14px" width="50%" mx="auto" mb={1} />
                <Skeleton height="12px" width="30%" mx="auto" />
            </Box>

            {/* Middle (score / date) */}
            <Box flex="1" px={4} textAlign="center">
                <Skeleton height="28px" width="60%" mx="auto" mb={2} />
                <Skeleton height="14px" width="80%" mx="auto" />
            </Box>

            {/* Player 2 block */}
            <Box flex="1" textAlign="center" py={4} px={2} borderRadius="2xl">
                <Skeleton height="20px" width="70%" mx="auto" mb={2} />
                <Skeleton height="14px" width="50%" mx="auto" mb={1} />
                <Skeleton height="12px" width="30%" mx="auto" />
            </Box>

            {/* Info icon */}
            <Box ml={2}>
                <SkeletonCircle size="5" />
            </Box>
        </Flex>
    );

    // ─── Mobile version ───
    const mobileView = (
        <Box
            display={{ base: 'block', md: 'none' }}
            bg="white"
            boxShadow="md"
            borderRadius="3xl"
            p={4}
            w="full"
        >
            {/* Player 1 */}
            <Box py={3} px={2} borderRadius="2xl" mb={2}>
                <Skeleton height="20px" width="70%" mx="auto" mb={2} />
                <Skeleton height="14px" width="50%" mx="auto" mb={1} />
                <Skeleton height="12px" width="30%" mx="auto" />
            </Box>

            {/* Middle */}
            <Box textAlign="center" my={2}>
                <Skeleton height="24px" width="50%" mx="auto" mb={1} />
                <Skeleton height="12px" width="70%" mx="auto" />
            </Box>

            {/* Player 2 */}
            <Box py={3} px={2} borderRadius="2xl">
                <Skeleton height="20px" width="70%" mx="auto" mb={2} />
                <Skeleton height="14px" width="50%" mx="auto" mb={1} />
                <Skeleton height="12px" width="30%" mx="auto" />
            </Box>
        </Box>
    );

    return (
        <>
            {mobileView}
            {desktopView}
        </>
    );
};

export default FightCardSkeleton;
