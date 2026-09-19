import React, { memo } from 'react';
import {
    Box, Image, useColorModeValue,
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, SimpleGrid
} from '@chakra-ui/react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { banners } from '../constants/constants.js';

const BannerSelectionModal = memo(({ isOpen, onClose, onSelect }) => {
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const hoverBorderColor = useColorModeValue('teal.400', 'teal.300');

    const { t } = useTranslation('bannerSelectionModal');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size={{ base: 'md', md: 'xl', lg: '5xl' }}
            isCentered
        >
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>
                    {t('title')}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <SimpleGrid
                        columns={{ base: 1, sm: 2, md: 2, lg: 3 }}
                        spacing={4}
                    >
                        {banners.map((banner) => (
                            <Box
                                key={banner}
                                as="button"
                                onClick={() => onSelect(banner)}
                                border="2px"
                                borderColor={borderColor}
                                borderRadius="md"
                                overflow="hidden"
                                transition="all 0.2s"
                                _hover={{
                                    borderColor: hoverBorderColor,
                                    transform: 'scale(1.02)',
                                    boxShadow: 'lg',
                                }}
                                _focus={{
                                    outline: 'none',
                                    borderColor: hoverBorderColor,
                                    boxShadow: 'outline',
                                }}
                                aria-label={t('selectBannerAria', {
                                    name: banner.replace('.png', '').replace('.jpg', '')
                                })}
                            >
                                <Image
                                    src={`/banners/${banner}`}
                                    alt={banner.replace('.png', '').replace('.jpg', '')}
                                    loading="lazy"
                                />
                            </Box>
                        ))}
                    </SimpleGrid>
                </ModalBody>
                <ModalFooter>
                    <Button colorScheme="pink" onClick={onClose}>
                        {t('closeButton')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});

BannerSelectionModal.displayName = 'BannerSelectionModal';

BannerSelectionModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSelect: PropTypes.func.isRequired
}

export default BannerSelectionModal;
