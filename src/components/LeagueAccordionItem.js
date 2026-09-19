import React, { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import {
    Box, Heading, Text, Image, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import GroupCard from './GroupCard';

import { LeagueLogos, useLeagueColors } from '../constants/constants';


const LeagueAccordionItem = memo(({ id, league, index, leagueGroups, textColor }) => {
    const [selectedGroup, setSelectedGroup] = useState(null);
    const { t } = useTranslation('leaderboard');

    const handleGroupClick = useCallback((group) => {
        setSelectedGroup(prev => (prev === group ? null : group));
    }, []);

    //const numGroups = leagueGroups.length;
    const minElo = leagueGroups.length > 0 ? leagueGroups[leagueGroups.length - 1].elo : '';
    const maxElo = leagueGroups.length > 0 ? leagueGroups[0].elo : '';
    const leagueColors = useLeagueColors();
    return (
        <AccordionItem>
            <AccordionButton borderRadius={"3xl"}>
                <Box
                    flex="1"
                    textAlign="left"
                    display="flex"
                    alignItems="center"
                    p={{ base: 2, md: 4 }}
                    borderRadius="3xl"
                    bgColor={leagueColors[id]}
                    backgroundSize="cover"
                    backgroundPosition="center"
                    border="2px solid teal"
                    boxShadow="lg"
                    _hover={{ transform: 'scale(1.01)', boxShadow: 'xl' }}
                >
                    <Image
                        src={LeagueLogos[id]}
                        alt={`${league} logo`}
                        boxSize={{ base: "80px", md: "120px" }}
                        mr={{ base: 2, md: 4 }}
                    />
                    <Box flex="1" minW="0">
                        <Heading
                            size={{ base: "md", md: "lg" }}
                            color={"black"}
                            mb={2}
                            textAlign={'center'}
                            isTruncated
                        >
                            {t('leagueTitle', { league: league })}
                        </Heading>
                        <Box textAlign={'center'}>
                            {/* <Text color={textColor}>{numGroups} groupes</Text> */}
                            {minElo !== '' && maxElo !== '' &&
                                <Text
                                    as={'b'}
                                    color={'black'}
                                    fontSize={{ base: "sm", md: "md" }}
                                >
                                    {t('eloRange', { minElo, maxElo })}
                                </Text>
                            }
                        </Box>
                    </Box>
                    <Image
                        src={LeagueLogos[id]}
                        alt={t('leagueLogoAlt', { league: league })}
                        boxSize={{ base: "60px", md: "120px" }}
                        mr={{ base: 1, md: 4 }}
                        display={{ base: 'none', md: 'block' }}
                    />
                    <AccordionIcon />
                </Box>
            </AccordionButton>
            <AccordionPanel pb={4} display="flex" justifyContent="center" flexDirection="column" alignItems="center" px={{ base: 1, md: 4 }}>
                {leagueGroups.map((group) => (
                    <Box key={group.id} w={{ base: "100%", md: "90%" }}>
                        <GroupCard
                            parentIndex={index}
                            group={group}
                            selectedGroup={selectedGroup}
                            handleGroupClick={handleGroupClick}
                            boxSize="small"
                        />
                    </Box>
                ))}
            </AccordionPanel>
        </AccordionItem>
    );
});

LeagueAccordionItem.displayName = 'LeagueAccordionItem';

LeagueAccordionItem.propTypes = {
    id: PropTypes.string.isRequired,
    league: PropTypes.string.isRequired,
    index: PropTypes.number,
    leagueGroups: PropTypes.array.isRequired,
    textColor: PropTypes.string
}

export default LeagueAccordionItem;
