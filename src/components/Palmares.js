import React, { useState } from 'react';
import {
    Box,
    Heading,
    Text,
    Grid,
    GridItem,
    Center,
    Image,
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    Divider,
    Flex,
    useColorModeValue
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { GiTrophyCup, GiSnail } from "react-icons/gi";
import { useTranslation } from 'react-i18next';

import ErrorMessage from './ErrorMessage.js';
import Loading from './Loading.js';

import { getGroupPalmares } from '../api/groups/groups.ts';
import { PalmaresInfo, useColors } from '../constants/constants.js';
import { useLocalized } from '../constants/languages.js';

const IS_FREEZE = import.meta.env.VITE_FREEZE === '1';
const MAX_STALE_TIME = 5 * 60 * 1000;
const rankColors = ['gold', 'silver', '#cd7f32'];

const fetchPalmares = async () => {
    const response = IS_FREEZE
        ? await (await fetch("/api/groups/palmares.json")).json()
        : await getGroupPalmares();

    const groups = response.map((group) => {
        const groupData = { name: group.name };
        PalmaresInfo.forEach((info) => {
            groupData[info.dbKeyBest] = info.custom_stats
                ? group.custom_stats?.[info.dbKeyBest] ?? 0
                : group[info.dbKeyBest] ?? 0;
            groupData[info.dbKeyWorst] = info.custom_stats
                ? group.custom_stats?.[info.dbKeyWorst] ?? 0
                : group[info.dbKeyWorst] ?? 0;
        });
        return groupData;
    });

    const palmares = PalmaresInfo.map((info) => {
        const bestGroups = [...groups].sort((a, b) => {
            const aVal = a[info.dbKeyBest] ?? 0;
            const bVal = b[info.dbKeyBest] ?? 0;
            return info.orderBest === 'desc'
                ? bVal - aVal
                : aVal - bVal
        }).slice(0, 3);

        const worstGroups = [...groups].sort((a, b) => {
            const aVal = a[info.dbKeyWorst] ?? 0;
            const bVal = b[info.dbKeyWorst] ?? 0;
            return info.orderBest === 'desc'
                ? bVal - aVal
                : aVal - bVal
        }).slice(0, 3);

        return {
            ...info,
            bestGroups,
            worstGroups
        };
    });

    return palmares;
};

const Palmares = () => {
    const [showWorstTab, setShowWorstTab] = useState(false);
    const [bestTabClickCount, setBestTabClickCount] = useState(0);

    const bgColor = useColorModeValue('white', 'gray.700');
    const textColor = useColorModeValue('black', 'white');
    const panelBgColor = useColorModeValue('gray.50', 'gray.800');
    const headingColor = useColorModeValue('teal.500', 'teal.300');
    const colors = useColors();
    const { t } = useTranslation('palmares');
    const localize = useLocalized();

    const renderCategory = (
        { icon, title, groups, dbKey, iconComponent, type },
        index,
        array,
        bgColor,
        textColor
    ) => (
        <GridItem
            bg={bgColor}
            p={6}
            borderRadius="lg"
            boxShadow="md"
            key={`${title}`}
            colSpan={{
                base: 1, // always on column on mobile
                md: (array.length % 2 !== 0 && index === array.length - 1) ? 2 : 1
            }}
        >
            <Center flexDirection="column" textAlign="center">
                <Image
                    src={`/${type === "best" ? 'succeed' : 'fail'}/${icon}`}
                    width={20}
                    mb={4}
                    alt={t('iconAlt', { title })}
                    objectFit="contain"
                />
                <Heading as="h2" size="md" mb={4} color={textColor}>
                    {title}
                </Heading>
                <Divider mb={3} />
                <Flex justifyContent="space-around" width="100%">
                    {groups.map((group, idx) => (
                        <Box key={idx} textAlign="center">
                            <Center flexDirection="column">
                                {React.createElement(iconComponent, { size: 30, color: rankColors[idx] })}
                                <Text mb={1} mt={1} as="b" color={textColor}>
                                    {group[dbKey]}
                                </Text>
                                <Text fontSize="lg" p={1} color={textColor}>
                                    {group.name}
                                </Text>
                            </Center>
                        </Box>
                    ))}
                </Flex>
            </Center>
        </GridItem>
    );

    const {
        data: palmaresData = [],
        isLoading,
        error
    } = useQuery({
        queryKey: ['palmares'],
        queryFn: fetchPalmares,
        staleTime: MAX_STALE_TIME,
        refetchOnWindowFocus: true,
        retry: 2,
    });

    // easter egg
    const handleBestTabClick = () => {
        setBestTabClickCount(prev => prev + 1);
        if (bestTabClickCount + 1 >= 20) {
            setShowWorstTab(true);
        }
    };

    if (isLoading) return <Loading />;
    if (error) return <ErrorMessage message={t('loadError')} />;
    if (!palmaresData.length) return <ErrorMessage message={t('noData')} />;

    const bestCategories = palmaresData.map((info) => ({
        ...info,
        title: localize(info.titleBest),
        groups: info.bestGroups,
        dbKey: info.dbKeyBest,
        iconComponent: GiTrophyCup,
        type: 'best'
    }));

    const worstCategories = palmaresData.map((info) => ({
        ...info,
        title: localize(info.titleWorst),
        groups: info.worstGroups,
        dbKey: info.dbKeyWorst,
        iconComponent: GiSnail,
        type: 'worst'
    }));

    return (
        <Box p={5} bg={panelBgColor} minH="100vh" maxW="7xl" mx="auto" borderRadius="lg">
            <Heading as="h1" mb={10} color={headingColor} textAlign="center">
                {t('title')}
            </Heading>
            <Tabs variant="soft-rounded">
                <TabList justifyContent="center" mb={4}>
                    <Tab
                        onClick={handleBestTabClick}
                        cursor="pointer"
                        fontWeight="bold"
                        bg={colors.tabBg}
                        color={colors.tabColor}
                        _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                        mr={2}
                    >
                        {t('tabBest')}
                    </Tab>
                    {showWorstTab && (
                        <Tab
                            fontWeight="bold"
                            bg={colors.tabBg}
                            color={colors.tabColor}
                            _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                            mr={2}
                        >
                            {t('tabWorst')}
                        </Tab>
                    )}
                </TabList>
                <TabPanels>
                    <TabPanel>
                        <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={8}>
                            {bestCategories.map((cat, index, array) =>
                                renderCategory(cat, index, array, bgColor, textColor)
                            )}
                        </Grid>
                    </TabPanel>
                    {showWorstTab && (
                        <TabPanel>
                            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={8}>
                                {worstCategories.map((cat, index, array) =>
                                    renderCategory(cat, index, array, bgColor, textColor)
                                )}
                            </Grid>
                        </TabPanel>
                    )}
                </TabPanels>
            </Tabs>
        </Box>
    );
};

export default Palmares;
