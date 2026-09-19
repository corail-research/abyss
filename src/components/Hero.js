import React from 'react';
import {
    Container,
    Heading,
    Stack,
    Text,
    Button,
    Box,
    //IconProps,
} from '@chakra-ui/react';
import { useTranslation, Trans } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import UploadAgentModal from './UploadAgentModal';

const IS_FREEZE = import.meta.env.VITE_FREEZE === '1';

export default function CallToActionWithIllustration() {
    const { authState, } = useAuth();
    const { openLoginModal } = useModal();
    const { t } = useTranslation('hero');

    const AsComponent = authState.student ? 'a' : 'button';

    return (
        <Box pt={{ base: 100, sm: 10, md: 100, lg: 100 }} minH={'60vh'} overflow="hidden">
            <Container
                maxW={'5xl'}
                backgroundImage={{ base: 'none', md: 'none', lg: 'url(abyss_logo.png)' }}
                backgroundSize={{ lg: '30%' }}
                backgroundPosition={{ lg: '0% 70%' }}
                backgroundRepeat={'no-repeat'}
                px={{ base: 4, md: 8 }}
            >
                {/* Mobile logo - only visible on mobile */}
                <Box
                    display={{ base: 'flex', md: 'none' }}
                    justifyContent="center"
                    mb={6}
                >
                    <img
                        src="/abyss_logo.png"
                        alt="Abyss Logo"
                        style={{
                            maxWidth: '150px',
                            height: 'auto',
                            width: '100%'
                        }}
                    />
                </Box>

                {/* Tablet logo - only visible on tablet */}
                <Box
                    display={{ base: 'none', md: 'flex', lg: 'none' }}
                    justifyContent="center"
                    mb={8}
                >
                    <img
                        src="/abyss_logo.png"
                        alt="Abyss Logo"
                        style={{
                            maxWidth: '200px',
                            height: 'auto',
                            width: 'auto',
                            objectFit: 'contain'
                        }}
                    />
                </Box>

                <Stack
                    textAlign={'center'}
                    align={'center'}
                    spacing={{ base: 6, md: 10 }}
                    py={{ base: 8, sm: 4, md: 20, lg: 28 }}
                >
                    <Heading
                        fontWeight={600}
                        fontSize={{ base: '2xl', sm: '3xl', md: '5xl', lg: '6xl' }}
                        lineHeight={'110%'}
                        textAlign="center"
                    >
                        <Trans
                            t={t}
                            i18nKey="heading"
                        >
                            Que le meilleur
                            <Text as={'span'} color={'pink.400'}>
                                gagne !
                            </Text>
                        </Trans>
                    </Heading>
                    <Text
                        color={'cyan.500'}
                        maxW={'3xl'}
                        fontSize={{ base: 'sm', md: 'md', lg: 'md' }}
                        textAlign="center"
                        px={{ base: 2, md: 0 }}
                    >
                        {t('subtitle')}
                    </Text>
                    <Stack
                        spacing={4}
                        direction={{ base: 'column', md: 'row' }}
                        width={{ base: '100%', md: 'auto' }}
                        align="center"
                    >
                        <UploadAgentModal />
                        <Button
                            as={AsComponent}
                            rounded={'full'}
                            px={6}
                            href={authState.student ? '/profile' : undefined}
                            onClick={authState.student || IS_FREEZE ? undefined : openLoginModal}
                            colorScheme={'pink'}
                            bg={'pink.400'}
                            disabled={IS_FREEZE}
                            width={{ base: '100%', md: 'auto' }}
                            maxWidth={{ base: '300px', md: 'none' }}
                        >
                            {t('resultsButton')}
                        </Button>
                    </Stack>
                </Stack>
            </Container>
        </Box>
    );
}
