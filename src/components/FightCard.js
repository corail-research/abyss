import React, { memo, useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Flex,
    Text,
    Tooltip,
    Icon,
    VStack,
    HStack,
    Divider,
    useColorModeValue
} from '@chakra-ui/react';
import { CloseIcon, InfoOutlineIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';

import LoadingDots from './LoadingDots.js';

import { CustomStatsInfos } from '../config';
import { FightStatus } from '../constants/constants';
import { useColors } from '../constants/constants';
import { useLocalized } from '../constants/languages.js';

const parseDate = (dateInput) => {
    if (dateInput instanceof Date) return dateInput;
    return new Date(dateInput);
};

// subcomponent for player info
const PlayerBlock = ({ player, status, score, opponentScore, borderColor, isMyAgent, isMobile }) => {
    // Compute styles based on status & scores
    const { t } = useTranslation('fightCard');

    const doneWinStyle = {
        bg: useColorModeValue('green.100', 'green.900'),
        color: useColorModeValue('green.800', 'green.200'),
    };
    const doneLoseStyle = {
        bg: useColorModeValue('red.100', 'red.900'),
        color: useColorModeValue('red.800', 'red.100'),
    };

    const inProgressStyle = {
        bg: useColorModeValue('yellow.100', 'yellow.900'),
        color: useColorModeValue('yellow.800', 'yellow.200'),
    };

    const cancelledStyle = {
        bg: useColorModeValue('pink.100', 'pink.900'),
        color: useColorModeValue('pink.800', 'pink.200'),
    };

    const defaultStyle = {
        bg: useColorModeValue('cyan.100', 'cyan.900'),
        color: useColorModeValue('cyan.800', 'cyan.200'),
    };

    const style = useMemo(() => {
        if (status === FightStatus.DONE) {
            return score >= opponentScore
                ? doneWinStyle
                : doneLoseStyle;
        }
        if (status === FightStatus.IN_PROGRESS) {
            return inProgressStyle;
        }
        if (status === FightStatus.CANCELLED) {
            return cancelledStyle;
        }
        // SCHEDULED or default
        return defaultStyle;
    }, [status, score, opponentScore]);

    const textSize = isMobile
        ? { fontSize: { base: 'lg' }, nameSize: 'sm', eloSize: 'xs' }
        : { fontSize: { md: 'lg', lg: 'xl' }, nameSize: { md: 'sm', lg: 'md' }, eloSize: { md: 'xs', lg: 'sm' } };

    return (
        <Box
            flex={isMobile ? 'none' : '1'}
            w={isMobile ? 'full' : 'auto'}
            textAlign="center"
            color={style.color}
            bg={style.bg}
            py={isMobile ? 3 : 4}
            px={isMobile ? 2 : 2}
            borderRadius="2xl"
            borderWidth={isMyAgent ? '2px' : '0px'}
            borderColor={borderColor}
            mb={isMobile ? 2 : 0}
        >
            <Text
                fontSize={isMobile ? 'lg' : textSize.fontSize}
                fontWeight="bold"
                lineHeight="1.2"
                sx={{ wordWrap: 'break-word', overflowWrap: 'break-word', hyphens: 'auto' }}
            >
                {player.group?.name || t('na')}
            </Text>
            <VStack spacing={1}>
                <Text
                    fontSize={isMobile ? 'sm' : textSize.nameSize}
                    fontWeight="semibold"
                    maxW="100%"
                    textAlign="center"
                    whiteSpace="normal"
                    wordBreak="break-all"
                    overflow="hidden"
                    display="-webkit-box"
                    sx={{ WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                    {player.name || t('unknownPlayer')}
                </Text>
                <Text fontSize={isMobile ? 'xs' : textSize.eloSize} color="gray.600">
                    {parseInt(player.elo) || 0} Elo
                </Text>
            </VStack>
        </Box>
    );
};

PlayerBlock.propTypes = {
    player: PropTypes.object.isRequired,
    status: PropTypes.string.isRequired,
    score: PropTypes.number,
    opponentScore: PropTypes.number,
    borderColor: PropTypes.string,
    isMyAgent: PropTypes.bool,
    isMobile: PropTypes.bool,
};

const FightCard = memo(({ fightData, status, myAgents }) => {
    const { player1, player2, score_player1, score_player2, date, scheduled_date } = fightData;
    const colors = useColors();
    const { t, i18n } = useTranslation('fightCard');
    const localize = useLocalized();

    const [elapsed, setElapsed] = useState('');
    const [remaining, setRemaining] = useState('');

    useEffect(() => {
        if (status !== FightStatus.IN_PROGRESS || !date) {
            setElapsed('');
            return;
        }

        const startDate = parseDate(date);
        if (isNaN(startDate.getTime())) {
            setElapsed(t('invalidDate'));
            return;
        }

        const updateElapsed = () => {
            const diff = Date.now() - startDate.getTime();
            setElapsed(diff <= 0 ? '0m' : `${Math.floor(diff / 60000)}m`);
        };
        updateElapsed();

        const intervalId = setInterval(updateElapsed, 1000);
        return () => clearInterval(intervalId);
    }, [date, status, t]);

    useEffect(() => {
        if (status !== FightStatus.SCHEDULED || !scheduled_date) {
            setRemaining('');
            return;
        }

        const scheduledDate = parseDate(scheduled_date);
        if (isNaN(scheduledDate.getTime())) {
            setRemaining(t('invalidDate'));
            return;
        }

        const updateRemaining = () => {
            const diff = scheduledDate.getTime() - Date.now();
            if (diff <= 0) {
                setRemaining('0h 0m');
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setRemaining(`${hours}h ${minutes}m`);
            }
        };
        updateRemaining();

        const intervalId = setInterval(updateRemaining, 1000);
        return () => clearInterval(intervalId);
    }, [scheduled_date, status, t]);

    const handleClick = () => {
        if (status !== FightStatus.SCHEDULED) {
            window.open(`/fight?id=${fightData.id}`, '_blank');
        }
    };

    const isScheduled = status === FightStatus.SCHEDULED;
    const isInProgress = status === FightStatus.IN_PROGRESS;
    const isDone = status === FightStatus.DONE;
    const isCancelled = status === FightStatus.CANCELLED;

    const bgColor = useColorModeValue('gray.50', 'gray.700');
    const textColor = useColorModeValue('teal.700', 'teal.200');
    const tooltipBgColor = useColorModeValue('teal.300', 'teal.800');
    const borderColor = useColorModeValue('gray.800', 'gray.200');

    const isMyAgent1 = myAgents?.includes(player1.id);
    const isMyAgent2 = myAgents?.includes(player2.id);

    const drawStyle = {
        bg: useColorModeValue('cyan.100', 'cyan.900'),
        color: useColorModeValue('cyan.800', 'cyan.200'),
    };

    const inProgressStyle = {
        bg: useColorModeValue('yellow.100', 'yellow.900'),
        color: useColorModeValue('yellow.800', 'yellow.200'),
    };

    const cancelledStyle = {
        bg: useColorModeValue('pink.100', 'pink.900'),
        color: useColorModeValue('pink.800', 'pink.200'),
    };

    const opponentInfo = (player, bgColor, textColor) => (
        <VStack align="center" spacing={2} p={3} bg={bgColor} borderRadius="md" boxShadow="lg">
            <Text fontSize="lg" fontWeight="bold" color={textColor}>
                {player.name}
            </Text>
            <Text fontSize="sm" color={textColor}>
                {t('statElo')} <span style={{ fontWeight: 'bold' }}>{player.elo}</span>
            </Text>
            <Text fontSize="sm" color={textColor}>
                {t('statWins')} <span style={{ fontWeight: 'bold' }}>{player.n_victories ?? '-'}</span>
            </Text>
            <Text fontSize="sm" color={textColor}>
                {t('statLosses')} <span style={{ fontWeight: 'bold' }}>{player.n_defeats ?? '-'}</span>
            </Text>
            <Text fontSize="sm" color={textColor}>
                {t('statPointsScored')} <span style={{ fontWeight: 'bold' }}>{player.n_points_scored ?? '-'}</span>
            </Text>
            <Text fontSize="sm" color={textColor}>
                {t('statPointsConceded')} <span style={{ fontWeight: 'bold' }}>{player.n_points_conceded ?? '-'}</span>
            </Text>
            {CustomStatsInfos.map((stat) => (
                <Text key={stat.key} fontSize="sm" color={textColor}>
                    {localize(stat.title)}:{' '}
                    <span style={{ fontWeight: 'bold' }}>
                        {fightData.custom_stats
                            ?.filter((cs) => cs.agent_id === player.id
                                && cs.name === stat.key)
                            .reduce((acc, curr) => acc + curr.value, 0) ?? 0}
                    </span>
                </Text>
            ))}
        </VStack>
    );

    const renderMiddle = (isMobile = false) => {
        const fontSize = isMobile
            ? { score: '2xl', date: 'sm', label: 'lg', time: 'lg' }
            : { score: { md: '2xl', lg: '3xl' }, date: { md: 'sm', lg: 'md' }, label: { md: 'lg', lg: '2xl' }, time: { md: 'lg', lg: '2xl' } };

        if (isDone) {
            return (
                <Box textAlign="center" color={drawStyle.color} my={isMobile ? 2 : 0}>
                    <Text fontSize={fontSize.score} fontWeight="bold">
                        {`${score_player1} - ${score_player2}`}
                    </Text>
                    <Text fontSize={fontSize.date} color={drawStyle.color} mt={isMobile ? 1 : 2}>
                        {new Date(date).toLocaleDateString(
                            i18n.language === 'fr' ? 'fr-CA' : 'en-CA',
                            {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                            }
                        )}
                    </Text>
                </Box>
            );
        }
        if (isScheduled) {
            return (
                <Box textAlign="center" color={drawStyle.color} my={isMobile ? 2 : 0}>
                    <Text fontSize={fontSize.label} color={colors.blackTextColor} fontWeight="bold">
                        {t('scheduledIn')}
                    </Text>
                    <Text fontSize={fontSize.time} fontWeight="bold" mt={isMobile ? 1 : 2} color={drawStyle.color}>
                        {remaining}
                    </Text>
                </Box>
            );
        }
        if (isInProgress) {
            return (
                <Box textAlign="center" color={inProgressStyle.color} my={isMobile ? 2 : 0}>
                    <LoadingDots />
                    <Text fontSize={fontSize.time} fontWeight="bold" mt={isMobile ? 1 : 2} color={drawStyle.color}>
                        {elapsed}
                    </Text>
                </Box>
            );
        }
        if (isCancelled) {
            return (
                <Box textAlign="center" color={cancelledStyle.color} my={isMobile ? 2 : 0}>
                    <Text fontSize={isMobile ? 'sm' : { md: 'sm', lg: 'xl' }} color={colors.blackTextColor} fontWeight="bold" mb={isMobile ? 1 : 2}>
                        {new Date(date).toLocaleDateString('ca-CA', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </Text>
                    <CloseIcon w={isMobile ? 5 : { md: 5, lg: 7 }} h={isMobile ? 5 : { md: 5, lg: 7 }} color={cancelledStyle.color} />
                </Box>
            );
        }
        return null;
    };

    const desktopView = (
        <Flex
            display={{ base: 'none', md: 'flex' }}
            bg={colors.bgColor}
            boxShadow="md"
            borderRadius="3xl"
            overflow="hidden"
            transition="transform 0.2s, box-shadow 0.2s"
            _hover={!isScheduled ? { transform: 'scale(1.02)', boxShadow: 'xl' } : {}}
            p={6}
            align="center"
            justify="space-between"
            w="full"
            cursor={!isScheduled ? 'pointer' : 'default'}
            onClick={handleClick}
        >
            {/* Player 1 */}
            <PlayerBlock
                player={player1}
                status={status}
                score={score_player1}
                opponentScore={score_player2}
                borderColor={borderColor}
                isMyAgent={isMyAgent1}
                isMobile={false}
            />

            {/* Middle */}
            <Box flex="1" px={4}>
                {renderMiddle(false)}
            </Box>

            {/* Player 2 */}
            <PlayerBlock
                player={player2}
                status={status}
                score={score_player2}
                opponentScore={score_player1}
                borderColor={borderColor}
                isMyAgent={isMyAgent2}
                isMobile={false}
            />

            {/* Info Icon */}
            <Tooltip
                label={
                    <HStack spacing={4} p={2} bg={'rbga(0,0,0,0)'}>
                        {opponentInfo(player1, bgColor, textColor)}
                        <Divider orientation="vertical" borderColor="white" borderWidth="2px" height="100px" />
                        {opponentInfo(player2, bgColor, textColor)}
                    </HStack>
                }
                placement="top"
                bg={tooltipBgColor}
                color={'white'}
                borderRadius="md"
                maxWidth={1000}
            >
                <Box ml={2}>
                    <Icon as={InfoOutlineIcon} w={5} h={5} color="gray.500" />
                </Box>
            </Tooltip>
        </Flex>
    );

    const mobileView = (
        <Box
            display={{ base: 'block', md: 'none' }}
            bg={colors.bgColor}
            boxShadow="md"
            borderRadius="3xl"
            overflow="hidden"
            transition="transform 0.2s, box-shadow 0.2s"
            _hover={!isScheduled ? { transform: 'scale(1.02)', boxShadow: 'xl' } : {}}
            p={4}
            w="full"
            cursor={!isScheduled ? 'pointer' : 'default'}
            onClick={handleClick}
        >
            {/* Player 1 */}
            <PlayerBlock
                player={player1}
                status={status}
                score={score_player1}
                opponentScore={score_player2}
                borderColor={borderColor}
                isMyAgent={isMyAgent1}
                isMobile={true}
            />

            {/* Middle */}
            {renderMiddle(true)}

            {/* Player 2 */}
            <PlayerBlock
                player={player2}
                status={status}
                score={score_player2}
                opponentScore={score_player1}
                borderColor={borderColor}
                isMyAgent={isMyAgent2}
                isMobile={true}
            />
        </Box>
    );

    return (
        <>
            {mobileView}
            {desktopView}
        </>
    );
});

FightCard.propTypes = {
    fightData: PropTypes.shape({
        id: PropTypes.string.isRequired,
        date: PropTypes.string,
        scheduled_date: PropTypes.string,
        score_player1: PropTypes.number,
        score_player2: PropTypes.number,
        player1: PropTypes.object.isRequired,
        player2: PropTypes.object.isRequired,
    }).isRequired,
    status: PropTypes.oneOf([
        FightStatus.CANCELLED,
        FightStatus.DONE,
        FightStatus.IN_PROGRESS,
        FightStatus.SCHEDULED
    ]).isRequired,
    myAgents: PropTypes.array,
}

FightCard.displayName = 'FightCard';

export default FightCard;
