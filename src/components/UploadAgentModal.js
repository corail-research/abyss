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
    useDisclosure,
    Text
} from '@chakra-ui/react';
import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { postAgentUpload } from '../api/agents/agents.ts';
import { getStudentItem } from '../api/students/students.ts';
import ErrorPopup from './ErrorPopup';
import SuccessPopup from './SuccessPopup';
import { useAuth } from '../context/AuthContext.jsx';
import { useModal } from '../context/ModalContext.js';
import { useColors } from '../constants/constants.js';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_FILE_SIZE_STR = '100MB';
const MAX_NAME_LENGTH = import.meta.env.VITE_AGENT_NAME_MAX_LENGTH;
const IS_FREEZE = import.meta.env.VITE_FREEZE === '1';

export default function UploadAgentModal() {
    const { authState } = useAuth();
    const { openLoginModal } = useModal();
    const colors = useColors();
    const queryClient = useQueryClient();
    const { t } = useTranslation('uploadAgentModal');

    const [agentName, setAgentName] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);

    const { isOpen, onOpen, onClose } = useDisclosure();
    const fileInputRef = useRef(null);

    const uploadMutation = useMutation({
        mutationFn: async (formData) => {
            return await postAgentUpload(formData, authState.options);
        },
        onSuccess: () => {
            setSuccessMessage(t('uploadSuccess'));
            setShowSuccess(true);
            onClose();
            queryClient.invalidateQueries({ queryKey: ['agents'] });
            queryClient.invalidateQueries({ queryKey: ['agents', authState.student?.group_id] });
        },
        onError: (error) => {
            const errorMsg = error.response?.data || t('uploadErrorGeneric');
            setErrorMessage(`${t('uploadErrorPrefix')} ${errorMsg}`);
            setShowError(true);
            onClose();
        },
    });

    const handleOpen = () => {
        if (!authState.student) {
            openLoginModal();
        } else {
            setAgentName('');
            onOpen();
        }
    };

    const handleUploadAgent = async () => {
        const file = fileInputRef.current?.files[0];

        if (!agentName || !file) {
            setErrorMessage(t('errorMissingFields'));
            setShowError(true);
            return;
        }

        if (agentName.length > MAX_NAME_LENGTH) {
            setErrorMessage(t('errorNameTooLong', { maxLength: MAX_NAME_LENGTH }));
            setShowError(true);
            return;
        }

        if (!authState.student) {
            setErrorMessage(t('errorNotLoggedIn'));
            setShowError(true);
            onClose();
            return;
        }

        if (!file.name.endsWith('.zip')) {
            setErrorMessage(t('errorFileMustBeZip'));
            setShowError(true);
            document.querySelector('#fileSelector').value = null;
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setErrorMessage(t('errorFileTooLarge', { maxSize: MAX_FILE_SIZE_STR }));
            setShowError(true);
            document.querySelector('#fileSelector').value = null;
            return;
        }

        try {
            const responseStudent = await getStudentItem(authState.student.id);
            const group_id = responseStudent.group_id;

            const formData = new FormData();
            formData.append('group_id', group_id);
            formData.append('file', file);
            formData.append('name', agentName);

            uploadMutation.mutate(formData);
        } catch (e) {
            setErrorMessage(`${t('uploadErrorPrefix')} ${e.response.data}`);
            setShowError(true);
        }
    };

    return (
        <>
            <SuccessPopup message={successMessage} onClose={() => setShowSuccess(false)} isOpen={showSuccess} />
            <ErrorPopup message={errorMessage} onClose={() => setShowError(false)} isOpen={showError} />
            <Button
                as={'a'}
                rounded={'full'}
                px={6}
                bg={colors.blueButton}
                color={'white'}
                onClick={IS_FREEZE ? undefined : handleOpen}
                _hover={{ bg: colors.blueButtonHover }}
                cursor={'pointer'}
                disabled={IS_FREEZE}
                width={{ base: '100%', md: 'auto' }}
                maxWidth={{ base: '300px', md: 'none' }}
            >
                {t('uploadButton')}
            </Button>
            <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'sm', md: 'md' }}>
                <ModalOverlay />
                <ModalContent mx={{ base: 4, md: 0 }} my={{ base: 4, md: 'auto' }}>
                    <ModalHeader>{t('modalTitle')}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <FormControl>
                            <FormLabel>{t('agentNameLabel')}</FormLabel>
                            <Input
                                id="AgentName"
                                type='text'
                                placeholder="NoNameAgent"
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value.slice(0, MAX_NAME_LENGTH))}
                                maxLength={MAX_NAME_LENGTH}
                            />
                            <Text fontSize="sm" color="gray.500" mt={1}>
                                {agentName.length}/{MAX_NAME_LENGTH} {t('characters')}
                            </Text>
                        </FormControl>

                        <FormControl mt={4}>
                            <FormLabel>{t('fileLabel')}</FormLabel>
                            <Input
                                id="fileSelector"
                                ref={fileInputRef}
                                type="file"
                                accept='.zip'
                                border={'0px'}
                            />
                        </FormControl>
                    </ModalBody>

                    <ModalFooter flexDirection={{ base: 'column', md: 'row' }} gap={2}>
                        <Button
                            bg={'pink.500'}
                            color='white'
                            onClick={onClose}
                            width={{ base: '100%', md: 'auto' }}
                            order={{ base: 2, md: 1 }}
                        >
                            {t('closeButton')}
                        </Button>
                        <Button
                            bg={'cyan.500'}
                            color='white'
                            onClick={handleUploadAgent}
                            isLoading={uploadMutation.isPending}
                            loadingText={t('uploadLoading')}
                            isDisabled={uploadMutation.isPending || IS_FREEZE}
                            width={{ base: '100%', md: 'auto' }}
                            order={{ base: 1, md: 2 }}
                        >
                            {t('uploadSubmitButton')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
