import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Box, Flex, Heading, Badge, Icon } from '@chakra-ui/react';
import { ArrowDownIcon, ChevronDownIcon, ChevronUpIcon, ArrowUpIcon } from '@chakra-ui/icons';
import { FaEquals } from "react-icons/fa";

import AgentGrid from './AgentGrid';

import { LeagueNames } from '../constants/constants';
import { useColors } from '../constants/constants.js';

const GroupCard = memo(({ group, parentIndex, selectedGroup, handleGroupClick }) => {
    const colors = useColors();
    const { t } = useTranslation('groupCard');

    return (
        <Box
            bgColor={colors.bgColor}
            p={{ base: 2, md: 4 }}
            mb={{ base: 2, md: 4 }}
            mx={{ base: 0, md: 'auto' }}
            rounded="2xl"
            border={group.n_victories >= group.n_defeats ? '2px solid green' : '2px solid red'}
            cursor={'pointer'}
            overflow="hidden"
        >
            <Flex justify="space-between" align="center" onClick={() => handleGroupClick(group)}>
                <Box flex="1" minW="0" mr={{ base: 1, md: 4 }}>
                    <Flex align="center">
                        {(group.previous_league !== '' && (LeagueNames.indexOf(group.league) > LeagueNames.indexOf(group.previous_league))) ?
                            <ArrowUpIcon w={4} h={4} color={"green"} mr={{ base: 1, md: 3 }} flexShrink={0} /> :
                            (group.previous_league !== '' && (LeagueNames.indexOf(group.league) < LeagueNames.indexOf(group.previous_league))) ?
                                <ArrowDownIcon w={4} h={4} color={"red"} mr={{ base: 1, md: 3 }} flexShrink={0} />
                                :
                                <Icon as={FaEquals} w={4} h={4} color={"gray"} mr={{ base: 1, md: 3 }} flexShrink={0} />
                        }
                        <Box minW="0" flex="1">
                            <Heading
                                as="h3"
                                size={{ base: "sm", md: "md" }}
                                color={colors.darkTextColor}
                                isTruncated
                            >
                                {t('groupNameWithElo', { name: group.name, elo: group.elo })}
                            </Heading>
                            {/* Colored text under the name on mobile */}
                            <Badge
                                colorScheme={group.n_victories > group.n_defeats ? 'green' : 'red'}
                                fontSize="xs"
                                mt={1}
                                display={{ base: 'inline-block', md: 'none' }}
                                whiteSpace="nowrap"  // prevents wrapping, keeps compact width
                            >
                                {t('victoriesDefeats', { wins: group.n_victories, losses: group.n_defeats })}
                            </Badge>

                        </Box>
                    </Flex>
                </Box>
                <Flex align="center" flexShrink={0}>
                    {/* Badge on the right on tablet/desktop */}
                    <Badge
                        colorScheme={group.n_victories > group.n_defeats ? 'green' : 'red'}
                        fontSize="lg"
                        ml={4}
                        display={{ base: 'none', md: 'block' }}
                    >
                        {group.n_victories} Wins / {group.n_defeats} Losses
                    </Badge>
                    {(!selectedGroup || selectedGroup !== group) ? (
                        <ChevronDownIcon w={5} h={5} ml={{ base: 1, md: 2 }} />
                    ) : (
                        <ChevronUpIcon w={5} h={5} ml={{ base: 1, md: 2 }} />
                    )}
                </Flex>
            </Flex>
            {selectedGroup === group && <AgentGrid agents={group.agents} />}
        </Box>
    );
});

GroupCard.displayName = 'GroupCard';

GroupCard.propTypes = {
    group: PropTypes.object.isRequired,
    parentIndex: PropTypes.number,
    selectedGroup: PropTypes.object,
    handleGroupClick: PropTypes.func.isRequired
}

export default GroupCard;
