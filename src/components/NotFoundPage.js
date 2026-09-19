import React, { memo } from 'react';
import { Heading, Text, Button, VStack, Container } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFoundPage = memo(() => {
    const { t } = useTranslation('notFoundPage');

    return (
        <Container maxW="container.md" centerContent minH="70vh" display="flex" alignItems="center">
            <VStack spacing={6} textAlign="center" py={8}>
                <Heading as="h1" size="2xl" color="pink.500">
                    404
                </Heading>
                <Heading as="h2" size="2xl" mb="2">
                    {t('title')}
                </Heading>
                <Text fontSize="lg" color="gray.500">
                    {t('message')}
                </Text>
                <Button
                    as={RouterLink}
                    to="/"
                    colorScheme="pink"
                    size="lg"
                    mt={4}
                    _hover={{ transform: 'scale(1.05)', boxShadow: 'lg' }}
                    transition="all 0.2s"
                >
                    {t('backHome')}
                </Button>
            </VStack>
        </Container >
    );
});

NotFoundPage.displayName = 'NotFoundPage';

export default NotFoundPage;
