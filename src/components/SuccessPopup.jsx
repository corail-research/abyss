// SuccessModal.js
import React, { useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton, ModalHeader, Text, Flex, Box } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

const SuccessPopup = memo(({ isOpen, onClose, message, duration = 3000 }) => {
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
                <ModalHeader textAlign="center">
                    {t('successTitle')}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <Flex direction="column" alignItems="center" justifyContent="center" textAlign="center">
                        <Box mb="4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="green" width="64px" height="64px">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </Box>
                        <Text mb="4">{message}</Text>
                    </Flex>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
});

SuccessPopup.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    message: PropTypes.string.isRequired,
    duration: PropTypes.number,
}

SuccessPopup.defaultProps = {
    duration: 2000,
};

SuccessPopup.displayName = 'SuccessPopup';

export default SuccessPopup;
