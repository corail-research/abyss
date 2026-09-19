import React from 'react';
import { Heading, Box, Image, Flex, Text, Button, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import { Game } from '../config';
import { useColors } from '../constants/constants.js';
import { useLocalized } from '../constants/languages.js';

const RulesDisplay = () => {
    const colors = useColors();
    const { t } = useTranslation('rulesDisplay');
    const localize = useLocalized();

    const description = localize(Game.description) || '';
    const rulesfile = localize(Game.rulesfile) || '';
    const rulesPages = localize(Game.rulesPages) || [];

    if (Object.keys(Game).length === 0) {
        return (
            <Heading
                as="h1"
                size="xl"
                textAlign="center"
                mt={5}
                mb={5}
                color={colors.cyanTextColor}
            >
                {t('noGameConfigured')}
            </Heading>
        );
    }

    return (
        <>
            <Heading as="h1" size="xl" textAlign="center" mt={5} mb={5} color={colors.cyanTextColor}>
                {t('gameRulesTitle', { gameName: Game.name })}
            </Heading>
            <Heading as="h2" size="lg" textAlign="center" mt={5} mb={5} color={colors.pinkTextColor}>
                {description}
            </Heading>

            <VStack spacing={5}>
                <Flex justifyContent="center" alignItems="center" flexWrap="wrap" gap={5}>
                    {rulesPages.map((page, index) => (
                        <Box
                            key={index}
                            maxW="900px"
                            p="4"
                            borderWidth="1px"
                            borderRadius="lg"
                            boxShadow="2xl"
                            borderColor="gray.400"
                            bg="white"
                            overflow="hidden"
                            flex="1 1 auto"
                            minW="250px"
                        >
                            <Image
                                src={page}
                                alt={t('pageAltText', { pageNumber: index + 1 })}
                                borderRadius="md"
                                objectFit="cover"
                                loading="lazy"
                            />
                        </Box>
                    ))}
                </Flex>
                <Button
                    as={'a'}
                    rounded={'full'}
                    px={6}
                    bg={colors.blueButton}
                    color={'white'}
                    _hover={{ bg: colors.blueButtonHover }}
                    cursor={'pointer'}
                    width={{ base: '100%', md: 'auto' }}
                    maxWidth={{ base: '300px', md: 'none' }}
                    href={rulesfile}
                    target="_blank"
                >
                    {t('downloadButton')}
                </Button>
                <Text textAlign="center" mt={5} mb={5} color='gray.500'>
                    {t('sourceLabel')}{' '}
                    <Text as="a" href={localize(Game.copyright)} color='teal.500' target="_blank" rel="noreferrer">
                        {localize(Game.copyright)}
                    </Text>
                </Text>
            </VStack>
        </>
    );
};

export default RulesDisplay;
