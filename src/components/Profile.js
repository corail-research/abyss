import React, { useState, useEffect, useMemo } from 'react';
import {
    Container, Heading, useColorModeValue, Box, Tabs, TabList, Divider, useDisclosure,
    TabPanels, Tab, TabPanel, Badge, Image, Flex, Grid, Stat, StatLabel, StatNumber, VStack
} from '@chakra-ui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import Loading from './Loading';
import AgentList from './AgentList';
import FightList from './FightList';
import AgentVsAgentStats from './AgentVsAgentStats';
import ErrorMessage from './ErrorMessage';
import BannerSelectionModal from './BannerSelectionModal';

import { getGroupItem, getGroupMinStats } from '../api/groups/groups.ts';
import { getAgentGroup } from '../api/agents/agents.ts';
import { useAuth } from '../context/AuthContext.jsx';
import {
    LeagueLogos,
    FightStatus,
    StatsInfos,
    LeagueDisplayNames,
    useColors,
    banners,
} from '../constants/constants.js';
import { useLocalized } from '../constants/languages.js'

const MAX_STALE_TIME = 5 * 60 * 1000;

const fetchGroupItem = async (groupId) => {
    const response = await getGroupItem(
        groupId,
        { include_stats: true },
        {
            headers: {
                'X-Fields': 'id,name,elo,league_history,custom_stats' +
                    StatsInfos.reduce((acc, item) => acc + ',' + item.value_key, ''),
            },
        }
    );
    return response;
};

const fetchAgentsForGroup = async (groupId) => {
    const response = await getAgentGroup(
        groupId,
        {
            status: 'active,inactive,invalid,pending,quarantine',
            include_stats: true
        },
        {
            headers: {
                'X-Fields': 'id,name,status,n_victories,n_defeats,elo,refusal_message',
            },
        }
    );
    return response;
};

const fetchGroupMinStats = async () => {
    const data = await getGroupMinStats();
    return data.reduce((acc, group) => {
        acc[group.id] = group;
        return acc;
    }, {});
}

const Profile = () => {
    const { authState } = useAuth();
    const queryClient = useQueryClient();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { t } = useTranslation('profile');
    const localize = useLocalized();
    const colors = useColors();

    const boxBgColor = useColorModeValue('white', 'gray.800');
    const headingColor = useColorModeValue('teal.500', 'teal.300');
    const statLabelColor = useColorModeValue('pink.500', 'pink.300');
    const statNumberColor = useColorModeValue('cyan.600', 'cyan.400');

    const [selectedBanner, setSelectedBanner] = useState('/banners/banner.png');
    const [activeTab, setActiveTab] = useState(0)

    useEffect(() => {
        const saved = localStorage.getItem('banner');
        if (saved && banners.indexOf(saved) !== -1) {
            setSelectedBanner(`/banners/${saved}`);
        }
    }, []);

    const {
        data: groupData,
        isLoading: groupLoading,
        error: groupError,
    } = useQuery({
        queryKey: ['group', authState.student?.group_id],
        queryFn: () => fetchGroupItem(authState.student.group_id),
        enabled: !!authState.student?.group_id,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
    });

    const {
        data: agents = [],
        isLoading: agentsLoading,
        error: agentsError,
    } = useQuery({
        queryKey: ['agents', authState.student?.group_id],
        queryFn: () => fetchAgentsForGroup(authState.student.group_id),
        enabled: !!authState.student?.group_id,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
    });

    const {
        data: groupsMap = {},
        isLoading: groupsLoading,
        error: groupsError,
    } = useQuery({
        queryKey: ['groups', 'minStats'],
        queryFn: fetchGroupMinStats,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
    });

    const myAgents = useMemo(() => {
        return agents.map((agent) => ({ id: agent.id, name: agent.name }));
    }, [agents]);

    const handleTabChange = async (index) => {
        setActiveTab(index);

        switch (index) {
            case 0:
                queryClient.refetchQueries({
                    queryKey: ['agents', authState.student?.group_id]
                });
                break;

            case 1:
                queryClient.refetchQueries({
                    queryKey: ['fights', FightStatus.DONE]
                });
                break;

            case 2:
                queryClient.refetchQueries({
                    queryKey: ['fights', FightStatus.SCHEDULED]
                });
                break;

            case 3:
                queryClient.refetchQueries({
                    queryKey: ['fights', FightStatus.CANCELLED]
                });
                break;

            case 4:
                queryClient.refetchQueries({
                    queryKey: ['group', authState.student?.group_id]
                });
                queryClient.refetchQueries({
                    queryKey: ['groups', 'minStats']
                });
                queryClient.refetchQueries({
                    queryKey: ['agentVsAgentStats', authState.student?.group_id]
                });
                break;

            default:
                break;
        }
    };

    const handleBannerSelect = (banner) => {
        localStorage.setItem('banner', banner);
        setSelectedBanner(`/banners/${banner}`);
        onClose();
    };

    const isLoading = groupLoading || agentsLoading || groupsLoading;
    const error = groupsError || groupError || agentsError;

    if (isLoading) return <Loading />;

    if (error || !groupData) return (
        <ErrorMessage
            message={
                groupError?.message ||
                agentsError?.message ||
                groupsError?.message ||
                t('loadError')} />
    );

    const statValues = StatsInfos.map((stat) => ({
        ...stat,
        title: localize(stat.title),
        value: stat.custom_stat
            ? groupData.custom_stats?.[stat.value_key] ?? 0
            : groupData[stat.value_key] ?? 0,
    }));

    return (
        <Container maxW={'7xl'} bg={colors.panelBg} padding={10} borderRadius="lg" boxShadow="xl" mt={10}>
            <Box mb={8} position="relative" display="flex" alignItems="center">
                <Box
                    ml={4}
                    flex="1"
                    backgroundImage={`url(${selectedBanner})`}
                    backgroundSize="cover"
                    backgroundPosition="center"
                    borderRadius="lg"
                    padding={{ base: 2, md: 6, lg: 8 }}
                    position="relative"
                    onClick={onOpen}
                    cursor="pointer"
                >
                    <Box
                        bg="rgba(100, 100, 100, 0.6)"
                        borderRadius="lg"
                        position="absolute"
                        top={0}
                        left={0}
                        right={0}
                        bottom={0}
                        padding={{ base: 2, md: 3, lg: 4 }}
                        zIndex={1}
                    />
                    <Flex direction="row" align="center" justify="space-between" zIndex={2} position="relative">
                        <Heading
                            as="h1"
                            size={{ base: "md", md: "xl", lg: "2xl" }}
                            color="white"
                            textShadow="0 0 10px rgba(0, 0, 0, 0.7)"
                            lineHeight={{ base: "1.2", md: "1.3", lg: "1.4" }}
                            sx={{
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                hyphens: "auto"
                            }}
                        >
                            {authState.student?.username || t('defaultUser')}
                        </Heading>
                        <Flex direction="column" align="flex-end">
                            <Heading
                                as="h2"
                                size={{ base: "sm", md: "md", lg: "lg" }}
                                color="white"
                                textShadow="0 0 10px rgba(0, 0, 0, 0.7)"
                                mb={2}
                                lineHeight={{ base: "1.2", md: "1.3", lg: "1.4" }}
                                textAlign="right"
                                sx={{
                                    wordWrap: "break-word",
                                    overflowWrap: "break-word",
                                    hyphens: "auto"
                                }}
                            >
                                {groupData.name}
                            </Heading>
                            <Badge colorScheme="green" fontSize={{ base: "sm", md: "md", lg: "lg" }}>
                                {groupData.elo} ELO
                            </Badge>
                        </Flex>
                    </Flex>
                </Box>
            </Box>

            <Grid
                templateColumns={{ base: '1fr', md: '1fr', lg: '3fr 1fr' }}
                templateRows={{ base: 'auto auto', md: 'auto auto', lg: '1fr' }}
                gap={10}
            >
                {/* League panel - positioned according to screen size */}
                <Box
                    textAlign="center"
                    bg={boxBgColor}
                    borderRadius="lg"
                    padding={{ base: 4, md: 6, lg: 6 }}
                    boxShadow="lg"
                    order={{ base: 1, md: 1, lg: 2 }}
                    gridColumn={{ base: '1', md: '1', lg: '2' }}
                    gridRow={{ base: '1', md: '1', lg: '1' }}
                >
                    <Image
                        src={LeagueLogos[groupData.league_history.current_league]}
                        alt={t('leagueIconAlt')}
                        boxSize={{ base: "100px", md: "120px", lg: "150px" }}
                        margin="0 auto"
                    />
                    <Heading size={{ base: "md", md: "md", lg: "lg" }} mt={4} mb={6} color={headingColor}>
                        {groupData.league_history?.current_league
                            ? t('leagueTitle', { league: localize(LeagueDisplayNames[groupData.league_history.current_league]) })
                            : t('noLeague')}
                    </Heading>
                    <Divider />

                    {/* Mobile and desktop layout - vertical */}
                    <VStack
                        spacing={4}
                        align="stretch"
                        display={{ base: "flex", md: "none", lg: "flex" }}
                    >
                        {statValues.map((stat, index) => (
                            <React.Fragment key={stat.key}>
                                <Stat mt={4}>
                                    <StatLabel color={statLabelColor}>{stat.title}</StatLabel>
                                    <StatNumber color={statNumberColor}>{stat.value}</StatNumber>
                                </Stat>
                                <Divider key={`divider-${index}`} />
                            </React.Fragment>
                        ))}
                    </VStack>

                    {/* Tablet layout - horizontal */}
                    <Grid
                        templateColumns="repeat(5, 1fr)"
                        gap={3}
                        mt={4}
                        display={{ base: "none", md: "grid", lg: "none" }}
                    >
                        {statValues.map((stat) => (
                            <Stat key={stat.key} textAlign="center">
                                <StatLabel color={statLabelColor} fontSize="sm" noOfLines={2}>
                                    {stat.title}
                                </StatLabel>
                                <StatNumber color={statNumberColor} fontSize="sm">
                                    {stat.value}
                                </StatNumber>
                            </Stat>
                        ))}
                    </Grid>
                </Box>

                {/* Main panel with tabs */}
                <Box
                    bg={colors.bgColor}
                    borderRadius="lg"
                    padding={{ base: 3, md: 4, lg: 6 }}
                    boxShadow="lg"
                    order={{ base: 2, md: 2, lg: 1 }}
                    gridColumn={{ base: '1', md: '1', lg: '1' }}
                    gridRow={{ base: '2', md: '2', lg: '1' }}
                    minH={{ base: "calc(100vh - 400px)", md: "calc(100vh - 350px)", lg: "auto" }}
                    maxH={{ base: "calc(100vh - 200px)", md: "calc(100vh - 200px)", lg: "none" }}
                    overflow={{ base: "hidden", md: "hidden", lg: "visible" }}
                >
                    <Tabs
                        variant="soft-rounded"
                        onChange={(index) => handleTabChange(index)}
                        index={activeTab}
                        isLazy
                    >
                        <TabList
                            flexWrap={{ base: "wrap", md: "wrap", lg: "nowrap" }}
                            gap={{ base: 2, md: 2, lg: 0 }}
                            justifyContent={{ base: "center", md: "center", lg: "space-between" }}
                            alignItems="flex"
                        >
                            <Tab
                                fontWeight="bold"
                                bg={colors.tabBg}
                                color={colors.tabColor}
                                _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                                mr={{ base: 0, lg: 2 }}
                                mb={{ base: 2, md: 2, lg: 0 }}
                                fontSize={{ base: "sm", md: "sm", lg: "md" }}
                                minW={{ base: "fit-content", md: "fit-content", lg: "auto" }}
                                flex={{ base: "0 0 auto", md: "0 0 auto", lg: "1" }}
                                px={{ base: 3, md: 3, lg: 4 }}
                                py={{ base: 2, md: 2, lg: 3 }}
                                whiteSpace="nowrap"
                                textAlign="center"
                            >
                                {t('tabAgents')}
                            </Tab>
                            <Tab
                                fontWeight="bold"
                                bg={colors.tabBg}
                                color={colors.tabColor}
                                _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                                mr={{ base: 0, lg: 2 }}
                                mb={{ base: 2, md: 2, lg: 0 }}
                                fontSize={{ base: "sm", md: "sm", lg: "md" }}
                                minW={{ base: "fit-content", md: "fit-content", lg: "auto" }}
                                flex={{ base: "0 0 auto", md: "0 0 auto", lg: "1" }}
                                px={{ base: 3, md: 3, lg: 4 }}
                                py={{ base: 2, md: 2, lg: 3 }}
                                whiteSpace="nowrap"
                                textAlign="center"
                            >
                                {t('tabPastFights')}
                            </Tab>
                            <Tab
                                fontWeight="bold"
                                bg={colors.tabBg}
                                color={colors.tabColor}
                                _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                                mr={{ base: 0, lg: 2 }}
                                mb={{ base: 2, md: 2, lg: 0 }}
                                fontSize={{ base: "sm", md: "sm", lg: "md" }}
                                minW={{ base: "fit-content", md: "fit-content", lg: "auto" }}
                                flex={{ base: "0 0 auto", md: "0 0 auto", lg: "1" }}
                                px={{ base: 3, md: 3, lg: 4 }}
                                py={{ base: 2, md: 2, lg: 3 }}
                                whiteSpace="nowrap"
                                textAlign="center"
                            >
                                {t('tabUpcomingFights')}
                            </Tab>
                            <Tab
                                fontWeight="bold"
                                bg={colors.tabBg}
                                color={colors.tabColor}
                                _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                                mr={{ base: 0, lg: 2 }}
                                mb={{ base: 2, md: 2, lg: 0 }}
                                fontSize={{ base: "sm", md: "sm", lg: "md" }}
                                minW={{ base: "fit-content", md: "fit-content", lg: "auto" }}
                                flex={{ base: "0 0 auto", md: "0 0 auto", lg: "1" }}
                                px={{ base: 3, md: 3, lg: 4 }}
                                py={{ base: 2, md: 2, lg: 3 }}
                                whiteSpace="nowrap"
                                textAlign="center"
                            >
                                {t('tabCancelledFights')}
                            </Tab>
                            <Tab
                                fontWeight="bold"
                                bg={colors.tabBg}
                                color={colors.tabColor}
                                _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                                mr={{ base: 0, lg: 2 }}
                                mb={{ base: 2, md: 2, lg: 0 }}
                                fontSize={{ base: "sm", md: "sm", lg: "md" }}
                                minW={{ base: "fit-content", md: "fit-content", lg: "auto" }}
                                flex={{ base: "0 0 auto", md: "0 0 auto", lg: "1" }}
                                px={{ base: 3, md: 3, lg: 4 }}
                                py={{ base: 2, md: 2, lg: 3 }}
                                whiteSpace="nowrap"
                                textAlign="center"
                            >
                                {t('tabFightStats')}
                            </Tab>
                        </TabList>

                        <TabPanels
                            h={{
                                base: "calc(100vh - 400px)",
                                md: "calc(100vh - 300px)",
                                lg: "auto"
                            }}
                            overflow={{
                                base: "auto",
                                md: "visible",
                                lg: "visible"
                            }}
                        >
                            <TabPanel p={{ base: 2, md: 4, lg: 4 }} h="100%" overflow="visible">
                                <AgentList
                                    agents={agents}
                                    onAgentDeleted={() => {
                                        queryClient.refetchQueries({
                                            queryKey: ['agents', authState.student?.group_id]
                                        });
                                    }}
                                />
                            </TabPanel>
                            <TabPanel p={{ base: 2, md: 4, lg: 4 }} h="100%" overflow={{ base: "auto", md: "auto", lg: "visible" }}>
                                <FightList
                                    myAgents={myAgents}
                                    status={FightStatus.DONE}
                                    groups={groupsMap}
                                    selected={activeTab === 1}
                                />
                            </TabPanel>
                            <TabPanel p={{ base: 2, md: 4, lg: 4 }} h="100%" overflow={{ base: "auto", md: "auto", lg: "visible" }}>
                                <FightList
                                    myAgents={myAgents}
                                    status={FightStatus.SCHEDULED}
                                    groups={groupsMap}
                                    selected={activeTab === 2}
                                />
                            </TabPanel>
                            <TabPanel p={{ base: 2, md: 4, lg: 4 }} h="100%" overflow={{ base: "auto", md: "auto", lg: "visible" }}>
                                <FightList
                                    myAgents={myAgents}
                                    status={FightStatus.CANCELLED}
                                    groups={groupsMap}
                                    selected={activeTab === 3}
                                />
                            </TabPanel>
                            <TabPanel p={{ base: 2, md: 4, lg: 4 }} h="100%" overflow={{ base: "auto", md: "auto", lg: "visible" }}>
                                <AgentVsAgentStats
                                    myAgents={myAgents}
                                    groupId={authState.student?.group_id}
                                    selected={activeTab === 4}
                                />
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </Box>
            </Grid>

            <BannerSelectionModal
                isOpen={isOpen}
                onClose={onClose}
                onSelect={handleBannerSelect}
            />
        </Container>
    );
};

export default Profile;
