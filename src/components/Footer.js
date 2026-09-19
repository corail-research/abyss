//import { ReactNode } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Container,
    Link,
    SimpleGrid,
    Stack,
    Text,
    Image,
    useColorModeValue,
} from '@chakra-ui/react';
import { useTranslation, Trans } from 'react-i18next';

const Logo = () => {
    return (
        <Image src="/corail-logo.png" alt="CORAIL Research Group logo" />
    );
};

const ListHeader = ({ children }) => {
    return (
        <Text fontWeight={'500'} fontSize={'lg'} mb={2}>
            {children}
        </Text>
    );
};

ListHeader.propTypes = { children: PropTypes.node };

export default function LargeWithLogoLeft() {
    const { t } = useTranslation('footer');

    return (
        <Box
            marginTop={20}
            boxShadow='inner'
            bg={useColorModeValue('gray.50', 'gray.900')}
            color={useColorModeValue('gray.700', 'gray.200')}>
            <Container as={Stack} maxW={'7xl'} py={10}>
                <SimpleGrid
                    templateColumns={{ sm: '1fr 1fr', md: '2fr 1fr 1fr 1fr 1fr' }}
                    spacing={8}>
                    <Stack spacing={6}>
                        <Box>
                            <Logo color={useColorModeValue('gray.700', 'white')} />
                        </Box>
                        <Text fontSize={'sm'}>
                            {t('copyright', { year: new Date().getFullYear(), group: 'CORAIL Research Group' })}
                        </Text>
                    </Stack>
                    <Stack align={'flex-start'}>
                        <ListHeader>{t('aboutUsHeader')}</ListHeader>
                        <Link target='_blank' href={'https://corail-research.github.io/'} rel="noopener noreferrer">{t('labLink')}</Link>
                        <Link target='_blank' href={'https://www.polymtl.ca/'} rel="noopener noreferrer">{t('polyLink')}</Link>
                    </Stack>
                    <Stack align={'flex-start'}>
                        <Trans t={t} i18nKey="aboutSeahorseHeader">
                            <ListHeader>À propos de <span style={{ color: 'cyan.500' }}>Seahorse</span></ListHeader>
                        </ Trans>
                        <Link target='_blank' href={'https://pypi.org/project/seahorse/'} rel="noopener noreferrer">{t('pypiLink')}</Link>
                        <Link target='_blank' href={'https://corail-research.github.io/seahorse/'} rel="noopener noreferrer">{t('docsLink')}</Link>
                        <Link target='_blank' href={'https://github.com/corail-research/seahorse'} rel="noopener noreferrer">{t('githubLink')}</Link>
                        <Link target='_blank' href={'https://opensource.org/license/bsd-3-clause'} rel="noopener noreferrer">{t('licenseLink')}</Link>
                    </Stack>
                    <Stack align={'flex-start'}>
                        <ListHeader>{t('aboutCourseHeader')}</ListHeader>
                        <Link target='_blank' href={'https://www.polymtl.ca/programmes/cours/intelligence-artif-methodes-et-algorithmes-0'} rel="noopener noreferrer">{t('courseDescLink')}</Link>
                        <Link target='_blank' href={'https://moodle.polymtl.ca/enrol/index.php?id=32'} rel="noopener noreferrer">{t('courseSiteLink')}</Link>
                    </Stack>
                    <Stack align={'flex-start'}>
                        <ListHeader>{t('productsHeader')}</ListHeader>
                        <Link target='_blank' href={'https://www.youtube.com/watch?v=dQw4w9WgXcQ'} rel="noopener noreferrer">{t('goodiesLink')}</Link>
                    </Stack>
                </SimpleGrid>
            </Container>
        </Box>
    );
}

