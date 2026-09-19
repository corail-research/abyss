import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { Box, Tooltip, Icon } from '@chakra-ui/react';
import { TimeIcon, NotAllowedIcon, CheckCircleIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';

import { AgentStatus } from '../constants/constants.js';

const getStatusIcon = (status) => {
    switch (status) {
        case AgentStatus.INACTIVE:
        case AgentStatus.ACTIVE:
            return <CheckCircleIcon />;
        case AgentStatus.INVALID:
            return <NotAllowedIcon boxSize={"20px"} />;
        case AgentStatus.QUARANTINE:
            return <NotAllowedIcon boxSize={"20px"} />;
        case AgentStatus.PENDING:
            return <TimeIcon />;
        default:
            return <Icon color="red.500" as={NotAllowedIcon} />;
    }
};

const getTooltipLabel = (t, status, errorInfo) => {
    switch (status) {
        case AgentStatus.ACTIVE:
        case AgentStatus.INACTIVE:
            return t('valid');
        case AgentStatus.INVALID:
            return t('rejected', { errorInfo: errorInfo ?? '' });
        case AgentStatus.QUARANTINE:
            return t('quarantine', { errorInfo: errorInfo ?? '' });
        case AgentStatus.PENDING:
            return t('pending');
        default:
            return t('unknown');
    }
};

const StatusIconWithMessage = memo(({ status, errorInfo }) => {
    const { t } = useTranslation('agentStatus');
    const tooltipLabel = getTooltipLabel(t, status, errorInfo);
    const iconElement = getStatusIcon(status);

    return (
        <Tooltip label={tooltipLabel} hasArrow placement="top" bg={'gray.800'} color={'white'}>
            <Box>
                {iconElement}
            </Box>
        </Tooltip>
    );
});

StatusIconWithMessage.displayName = 'StatusIconWithMessage';

StatusIconWithMessage.propTypes = {
    status: PropTypes.oneOf([
        AgentStatus.INVALID,
        AgentStatus.DELETED,
        AgentStatus.ACTIVE,
        AgentStatus.INACTIVE,
        AgentStatus.PENDING,
        AgentStatus.QUARANTINE
    ]).isRequired,
    errorInfo: PropTypes.string
}

export default StatusIconWithMessage;
