import React, { memo } from 'react';
import PropTypes from 'prop-types';

import { Box, Text, useColorModeValue } from '@chakra-ui/react';

const ErrorMessage = memo(({ message }) => {
    const bgColor = useColorModeValue('red.100', 'red.900');
    const textColor = useColorModeValue('red.800', 'red.200');
    const borderColor = useColorModeValue('red.400', 'red.600');

    return (
        <Box
            bg={bgColor}
            color={textColor}
            border="1px"
            borderColor={borderColor}
            p={3}
            borderRadius="md"
            mb={4}
            mt={4}
            width="fit-content"
            mx="auto"
            textAlign="center"
        >
            <Text fontSize="lg">{message}</Text>
        </Box>
    );
});


ErrorMessage.propTypes = {
    message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired
}


export default ErrorMessage;
