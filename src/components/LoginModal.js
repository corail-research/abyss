import React, { useState, useEffect } from 'react';
import {
    FormControl,
    FormLabel,
    Input,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    Button,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';

const IS_FREEZE = import.meta.env.VITE_FREEZE === '1';

export default function LoginModal() {
    const { isLoginModalOpen, closeLoginModal, openLoginModal } = useModal();
    const { login, isLoginPending, loginSuccess } = useAuth();
    const [studentId, setStudentId] = useState('');
    const [password, setPassword] = useState('');
    const { t } = useTranslation('loginModal');

    const handleLogin = () => {
        login(studentId, password);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    };

    useEffect(() => {
        if (loginSuccess) {
            closeLoginModal();
        }
    }, [loginSuccess, closeLoginModal]);

    return (
        <>
            <Button
                as={'a'}
                display={{ base: 'none', md: 'inline-flex' }}
                fontSize={'sm'}
                fontWeight={600}
                color={'white'}
                bg={'pink.400'}
                href={'#'}
                _hover={{ bg: 'pink.300' }}
                onClick={IS_FREEZE ? undefined : openLoginModal}
                disabled={IS_FREEZE}
            >
                {t('triggerButton')}
            </Button>
            <Modal isOpen={isLoginModalOpen} onClose={closeLoginModal}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>{t('modalTitle')}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <FormControl>
                            <FormLabel>{t('studentIdLabel')}</FormLabel>
                            <Input
                                type="text"
                                placeholder={t('studentIdPlaceholder')}
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ''))}
                                pattern="[0-9]*"
                                onKeyUp={handleKeyPress}
                                isDisabled={isLoginPending}
                            />
                        </FormControl>

                        <FormControl mt={4}>
                            <FormLabel>{t('passwordLabel')}</FormLabel>
                            <Input
                                type="password"
                                placeholder={t('passwordPlaceholder')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyUp={handleKeyPress}
                                isDisabled={isLoginPending}
                            />
                        </FormControl>
                    </ModalBody>

                    <ModalFooter>
                        <Button bg={'pink.500'} color="white" mr={3} onClick={closeLoginModal} isDisabled={isLoginPending}>
                            {t('closeButton')}
                        </Button>
                        <Button
                            bg={'cyan.500'}
                            color="white"
                            onClick={handleLogin}
                            isLoading={isLoginPending}
                            loadingText={t('loadingText')}
                            isDisabled={isLoginPending}
                        >
                            {t('submitButton')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
