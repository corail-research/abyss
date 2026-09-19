import React from 'react';
import {
    Box,
    Flex,
    Text,
    IconButton,
    Image,
    Stack,
    Link,
    useDisclosure,
    Button,
    Divider,
    useColorMode,
    Collapse,
    VStack,
} from '@chakra-ui/react';
import {
    HamburgerIcon,
    CloseIcon,
    SunIcon,
    MoonIcon,
} from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';

import LoginModal from './LoginModal';
import LanguageSelector from './LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import SuccessPopup from './SuccessPopup';
import { useState } from 'react';
import { useColors } from '../constants/constants.js';
import { Game } from '../config.js';

const IS_FREEZE = import.meta.env.VITE_FREEZE === '1';

const NAV_ITEMS = [
    {
        label: 'navLeaderboard',
        options: {},
        href: '/leaderboard',
    },
    {
        label: 'navFights',
        options: {},
        href: '/fights'
    },
    {
        label: 'navPalmares',
        options: {},
        href: '/palmares'
    },
];

if (Game.rulesfile) {
    NAV_ITEMS.unshift({
        label: 'navRules',
        options: { gameName: Game.name ?? 'Game' },
        href: '/rules'
    });
}

export default function WithSubnavigation() {
    const { t } = useTranslation('navbar');

    const { isOpen, onToggle } = useDisclosure();
    const { authState, logout, isAdmin } = useAuth();
    const [successLogout, setSuccessLogout] = useState(false);
    const { colorMode, toggleColorMode } = useColorMode();
    const colors = useColors();  // Use the custom hook here

    const handleLogout = async () => {
        await logout();
        setSuccessLogout(true);
    };

    return (
        <>
            <SuccessPopup isOpen={successLogout} onClose={() => setSuccessLogout(false)} message={t('logoutSuccess')} />
            <Box>
                <Flex
                    bg={colors.bgColor}
                    color={colors.textColor}
                    minH={'60px'}
                    py={{ base: 2 }}
                    px={{ base: 4 }}
                    borderBottom={1}
                    borderStyle={'solid'}
                    borderColor={colors.borderColor}
                    align={'center'}
                    position="relative"
                >
                    <Flex flex={{ base: 1, md: 'auto', lg: 'auto' }} ml={{ base: '-2' }} display={{ base: 'flex', md: 'flex', lg: 'none' }}>
                        <IconButton
                            onClick={onToggle}
                            icon={isOpen ? <CloseIcon w={3} h={3} /> : <HamburgerIcon w={5} h={5} />}
                            variant={'ghost'}
                            aria-label={'Toggle Navigation'} />
                    </Flex>
                    <Flex flex={{ base: 1, md: 'auto' }} justify={{ base: 'center', md: 'start', lg: 'start' }} width="auto">
                        <a href="/">
                            <Image src="/abyss_writing.png" alt="logo" height={'4em'} />
                        </a>

                        <Flex ml={10} mt={3} display={{ base: 'none', md: 'none', lg: 'flex' }}>
                            <DesktopNav />
                        </Flex>
                    </Flex>

                    <Stack flex={{ base: 1, md: 0 }} justify={'flex-end'} direction={'row'} spacing={{ base: 1, md: 6 }} align={'center'}>
                        <LanguageSelector />
                        <IconButton
                            aria-label="Toggle Dark Mode"
                            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                            onClick={toggleColorMode}
                            variant="ghost"
                        />
                        {authState.student ? (
                            <>
                                <Text
                                    fontSize={{ base: 'sm', md: 'md', lg: 'md' }}
                                    fontWeight={600}
                                    color={colors.textColor}
                                    whiteSpace={'nowrap'}
                                    mt={2}
                                    mr={2}
                                    display={{ base: 'none', md: 'block', lg: 'block' }}
                                >
                                    {t('greeting', { username: authState.student.username })}
                                </Text>
                                <Button
                                    as={'a'}
                                    display={{ base: 'none', md: 'inline-flex', lg: 'inline-flex' }}
                                    fontSize={'sm'}
                                    fontWeight={600}
                                    color={'white'}
                                    bg={colors.blueButton}
                                    href={'/profile'}
                                    _hover={{
                                        bg: colors.blueButtonHover,
                                    }}
                                >
                                    {t('profileButton')}
                                </Button>
                                {isAdmin && (
                                    <Button
                                        as={'a'}
                                        display={{ base: 'none', md: 'inline-flex', lg: 'inline-flex' }}
                                        fontSize={'sm'}
                                        fontWeight={600}
                                        color={'white'}
                                        bg={colors.pinkButton}
                                        href={'/admin'}
                                        _hover={{
                                            bg: colors.pinkButtonHover,
                                        }}
                                    >
                                        {t('adminButton')}
                                    </Button>
                                )}
                                <Button
                                    as={'a'}
                                    display={{ base: 'none', md: 'inline-flex', lg: 'inline-flex' }}
                                    fontSize={'sm'}
                                    fontWeight={600}
                                    color={'white'}
                                    bg={colors.pinkButton}
                                    onClick={handleLogout}
                                    _hover={{
                                        bg: colors.pinkButtonHover,
                                    }}
                                    cursor={'pointer'}
                                >
                                    {t('logoutButton')}
                                </Button>
                            </>
                        ) : (
                            <Box display={{ base: 'none', md: 'block', lg: 'block' }}>
                                <LoginModal />
                            </Box>
                        )}
                    </Stack>
                </Flex>

                <Collapse in={isOpen} animateOpacity>
                    <Box
                        bg={colors.bgColor}
                        borderBottom={1}
                        borderStyle={'solid'}
                        borderColor={colors.borderColor}
                        display={{ md: 'block', lg: 'none' }}
                        boxShadow="md"
                        width="100%"
                    >
                        <MobileNav onLogout={handleLogout} />
                    </Box>
                </Collapse>

                {/* Welcome message below navbar on mobile only */}
                {authState.student && (
                    <Box
                        bg={colors.bgColor}
                        borderBottom={1}
                        borderStyle={'solid'}
                        borderColor={colors.borderColor}
                        display={{ base: 'block', md: 'none' }}
                        py={2}
                        px={4}
                        textAlign="center"
                    >
                        <Text
                            fontSize={'sm'}
                            fontWeight={600}
                            color={colors.textColor}
                        >
                            {t('greeting', { username: authState.student.username })}
                        </Text>
                    </Box>
                )}
            </Box>
        </>
    );
}

const DesktopNav = () => {
    const colors = useColors(); // Use the custom hook here
    const { t } = useTranslation('navbar');

    return (
        <Stack direction={'row'} spacing={3}>
            {NAV_ITEMS.map((navItem, index) => (
                <React.Fragment key={navItem.label}>
                    <Link
                        p={2}
                        mt={3}
                        href={navItem.href ?? '#'}
                        fontSize={'sm'}
                        fontWeight={600}
                        color={colors.linkColor}
                        _hover={{
                            textDecoration: 'none',
                            color: colors.linkHoverColor,
                        }}
                        _active={{
                            color: colors.linkActiveColor,
                        }}
                    >
                        {t(navItem.label, navItem.options)}
                    </Link>
                    {index < NAV_ITEMS.length - 1 &&
                        <Divider
                            orientation="vertical"
                            h='30px'
                            mt='15px'
                            borderColor={colors.textColor}
                        />
                    }
                </React.Fragment>
            ))}
        </Stack>
    );
};

const MobileNav = ({ onLogout }) => {
    const colors = useColors();
    const { authState, isAdmin } = useAuth();
    const { openLoginModal } = useModal();
    const { t } = useTranslation('navbar');

    return (
        <VStack spacing={4} p={4} align="stretch">
            {/* Navigation Items */}
            {NAV_ITEMS.map((navItem) => (
                <Link
                    key={navItem.label}
                    href={navItem.href ?? '#'}
                    fontSize={'md'}
                    fontWeight={600}
                    color={colors.linkColor}
                    py={2}
                    px={4}
                    borderRadius="md"
                    _hover={{
                        textDecoration: 'none',
                        color: colors.linkHoverColor,
                        bg: colors.borderColor,
                    }}
                >
                    {t(navItem.label, navItem.options)}
                </Link>
            ))}

            {/* User Actions - Only show on mobile (base), not on tablet (md) */}
            <Stack display={{ base: 'flex', md: 'none' }} direction="column" spacing={2} mt={4}>
                <Divider borderColor={colors.borderColor} />

                {authState.student ? (
                    <>
                        <Button
                            as={'a'}
                            fontSize={'sm'}
                            fontWeight={600}
                            color={'white'}
                            bg={colors.blueButton}
                            href={'/profile'}
                            mt={4}
                            _hover={{
                                bg: colors.blueButtonHover,
                            }}
                        >
                            {t('profileButton')}
                        </Button>
                        {isAdmin && (
                            <Button
                                as={'a'}
                                fontSize={'sm'}
                                fontWeight={600}
                                color={'white'}
                                bg={colors.pinkButton}
                                href={'/admin'}
                                mt={2}
                                _hover={{
                                    bg: colors.pinkButtonHover,
                                }}
                            >
                                {t('adminButton')}
                            </Button>
                        )}
                        <Button
                            fontSize={'sm'}
                            fontWeight={600}
                            color={'white'}
                            bg={colors.pinkButton}
                            onClick={onLogout}
                            mt={2}
                            _hover={{
                                bg: colors.pinkButtonHover,
                            }}
                            cursor={'pointer'}
                        >
                            {t('logoutButton')}
                        </Button>
                    </>
                ) : (
                    <Button
                        fontSize={'sm'}
                        fontWeight={600}
                        color={'white'}
                        bg={'pink.400'}
                        onClick={IS_FREEZE ? undefined : openLoginModal}
                        mt={4}
                        _hover={{ bg: 'pink.300' }}
                        disabled={IS_FREEZE}
                        cursor={'pointer'}
                    >
                        {t('loginButton')}
                    </Button>
                )}
            </Stack>
        </VStack>
    );
};
