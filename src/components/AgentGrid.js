import React, { useMemo, memo } from 'react';
import { PropTypes } from 'prop-types';
import { useTranslation } from 'react-i18next';

import { Box, Text, Badge, Grid, GridItem, Heading } from '@chakra-ui/react';
import { useColors } from '../constants/constants.js';

const AGENT_NAME_MAX_LENGTH = import.meta.env.VITE_AGENT_NAME_MAX_LENGTH

const AgentGrid = memo(({ agents }) => {
    const colors = useColors();
    const sortedAgents = useMemo(() => [...agents].sort((a, b) => b.elo - a.elo), [agents]);
    const { t } = useTranslation('agentGrid');

    return (
        <Box mt={{ base: 2, md: 4 }}>
            <Heading as="h4" size="sm" color={colors.darkTextColor} mb={2} textAlign={'center'}>
                {t('title')}
            </Heading>
            {sortedAgents.map((agent) => (
                <Grid
                    key={agent.id}
                    templateColumns={{ base: "2fr 1fr 1fr 1fr", md: "repeat(4, 1fr)" }}
                    gap={{ base: 1, md: 4 }}
                    alignItems="center"
                    mb={2}
                    p={{ base: 1, md: 2 }}
                    borderWidth="1px"
                    borderRadius="md"
                >
                    <GridItem>
                        <Text as="b" color={colors.darkTextColor} fontSize={{ base: "xs", md: "md" }}> {agent.name.length > AGENT_NAME_MAX_LENGTH ? agent.name.substring(0, AGENT_NAME_MAX_LENGTH - 3) + '...' : agent.name} </Text>
                    </GridItem>
                    <GridItem>
                        <Badge colorScheme="blue" fontSize={{ base: "xs", md: "sm" }}>
                            <Box display={{ base: "block", md: "none" }}>{agent.elo}</Box>
                            <Box display={{ base: "none", md: "block" }}>{t('eloLabel', { elo: agent.elo })}</Box>
                        </Badge>
                    </GridItem>
                    <GridItem>
                        <Badge colorScheme="green" fontSize={{ base: "xs", md: "sm" }}>
                            <Box display={{ base: "block", md: "none" }}>{t('winsShort', { count: agent.n_victories })}</Box>
                            <Box display={{ base: "none", md: "block" }}>{t('winsLong', { count: agent.n_victories })}</Box>
                        </Badge>
                    </GridItem>
                    <GridItem>
                        <Badge colorScheme="red" fontSize={{ base: "xs", md: "sm" }}>
                            <Box display={{ base: "block", md: "none" }}>{t('lossesShort', { count: agent.n_defeats })}</Box>
                            <Box display={{ base: "none", md: "block" }}>{t('lossesLong', { count: agent.n_defeats })}</Box>
                        </Badge>
                    </GridItem>
                </Grid>
            ))}
        </Box>
    );
});

AgentGrid.displayName = 'AgentGrid';

AgentGrid.propTypes = {
    agents: PropTypes.array.isRequired
}

export default AgentGrid;
