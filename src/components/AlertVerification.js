import React, { memo, useRef } from 'react';
import PropTypes from 'prop-types';
import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogContent,
    AlertDialogOverlay,
    Button
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

const AlertVerification = memo(({
    isDialogOpen,
    setIsDialogOpen,
    handleDelete,
    name,
    isLoading = false
}) => {
    const cancelRef = useRef();
    const { t } = useTranslation('alertVerification');

    return (
        <AlertDialog
            isOpen={isDialogOpen}
            leastDestructiveRef={cancelRef}
            onClose={() => setIsDialogOpen(false)}
            isCentered
        >
            <AlertDialogOverlay>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        {t('title')}
                    </AlertDialogHeader>
                    <AlertDialogBody>
                        {t('body', { name: name || t('thisAgent') })}
                    </AlertDialogBody>
                    <AlertDialogFooter>
                        <Button ref={cancelRef} onClick={() => setIsDialogOpen(false)}>
                            {t('cancelButton')}
                        </Button>
                        <Button
                            colorScheme="pink"
                            onClick={handleDelete}
                            ml={3}
                            isLoading={isLoading}
                            loadingText={t('loadingText')}
                        >
                            {t('deleteButton')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialogOverlay>
        </AlertDialog>
    );
});

AlertVerification.displayName = 'AlertVerification';

AlertVerification.propTypes = {
    isDialogOpen: PropTypes.bool.isRequired,
    setIsDialogOpen: PropTypes.func.isRequired,
    handleDelete: PropTypes.func.isRequired,
    name: PropTypes.string,
    isLoading: PropTypes.bool,
}

export default AlertVerification;
