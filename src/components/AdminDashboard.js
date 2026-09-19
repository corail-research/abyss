import React, { useMemo, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabList, TabPanels, Tab, TabPanel, Box, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import StudentPanel from './StudentPanel';
import GroupPanel from './GroupPanel';
import AgentPanel from './AgentPanel';
import FightPanel from './FightPanel';
import QuarantinePanel from './QuarantinePanel';
import AdminPanel from './AdminPanel';

import { useColors } from '../constants/constants.js';

const TAB_CONFIG = [
    { key: 'admin', labelKey: 'tabAdmin', component: AdminPanel },
    { key: 'students', labelKey: 'tabStudents', component: StudentPanel },
    { key: 'groups', labelKey: 'tabGroups', component: GroupPanel },
    { key: 'agents', labelKey: 'tabAgents', component: AgentPanel },
    { key: 'fights', labelKey: 'tabFights', component: FightPanel },
    { key: 'quarantine', labelKey: 'tabQuarantine', component: QuarantinePanel },
];

const AdminDashboard = memo(() => {
    const colors = useColors();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation('adminDashboard');

    const tabParam = searchParams.get('tab');
    const activeTab = tabParam !== null
        ? Math.min(parseInt(tabParam, 10), TAB_CONFIG.length - 1)
        : 0;

    const handleTabsChange = (index) => {
        setSearchParams({ tab: String(index) });
    };

    const tabList = useMemo(() =>
        TAB_CONFIG.map(({ key, labelKey }) => (
            <Tab
                key={key}
                fontWeight="bold"
                bg={colors.tabBg}
                color={colors.tabColor}
                _selected={{ bg: colors.tabSelectedBg, color: colors.tabSelectedColor }}
                minW={{ base: 'calc(50% - 4px)', md: 'auto' }}
                mb={{ base: 2, mb: 0 }}
            >
                {t(labelKey)}
            </Tab>
        )), [colors, t]
    );

    const tabPanels = useMemo(() =>
        TAB_CONFIG.map(({ key, component: Component }, index) => (
            <TabPanel key={key}>
                <Component selected={activeTab === index} />
            </TabPanel>
        )),
        [activeTab]
    );


    return (
        <Box
            p={5}
            borderRadius="md"
            mx="auto"
            w={{ base: "100%", md: "100%", lg: "90%" }}
            boxShadow="lg"
        >
            <VStack spacing={5}>
                <Box
                    fontSize="2xl"
                    fontWeight="bold"
                    mb={4}
                    mt={10}
                    color={colors.cyanTextColor}
                >
                    {t('pageTitle')}
                </Box>
                <Tabs
                    variant="soft-rounded"
                    w="100%" index={activeTab}
                    onChange={handleTabsChange}
                    isLazy
                >
                    <TabList
                        justifyContent={'center'}
                        mb={10}
                        flexWrap="wrap"
                        gap={2}
                    >
                        {tabList}
                    </TabList>
                    <TabPanels>
                        {tabPanels}
                    </TabPanels>
                </Tabs>
            </VStack>
        </Box>
    );
});

export default AdminDashboard;
