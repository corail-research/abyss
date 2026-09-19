import React, { useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import { Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton, ModalHeader, Text, Flex, Box, useColorModeValue } from '@chakra-ui/react';

const ErrorPopup = memo(({ isOpen, onClose, message, duration = 3000 }) => {
    const headerColor = useColorModeValue('red.500', 'red.300');
    const iconColor = useColorModeValue('red', '#FF7F7F');
    const textColor = useColorModeValue('black', 'white');
    const { t } = useTranslation('popups');

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose(); // Automatically close the modal after 2 seconds
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose, duration]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader textAlign="center" color={headerColor}>
                    {t('errorTitle')}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <Flex direction="column" alignItems="center" justifyContent="center" textAlign="center">
                        <Box mb="4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke={iconColor} width="64px" height="64px">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Box>
                        <Text mb="4" color={textColor}>{message}</Text>
                    </Flex>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
});

ErrorPopup.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    message: PropTypes.string.isRequired,
    duration: PropTypes.number,
};

ErrorPopup.defaultProps = {
    duration: 3000,
};

export default ErrorPopup;
