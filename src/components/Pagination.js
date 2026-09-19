import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button, Flex, useBreakpointValue } from '@chakra-ui/react';
import { useColorModeValue } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';


const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    const { t } = useTranslation('pagination');
    const bgColor = useColorModeValue('gray.200', 'gray.600');
    const hoverBgColor = useColorModeValue('gray.300', 'gray.800');
    const activeBgColor = useColorModeValue('teal.500', 'teal.300');
    const textColor = useColorModeValue('black', 'white');
    const isMobile = useBreakpointValue({ base: true, md: false }, { ssr: false });

    const maxVisible = useMemo(() => (isMobile ? 3 : 7), [isMobile]);

    const pageButtons = useMemo(() => {
        if (totalPages <= 1) return [];

        const pages = [];
        const half = Math.floor(maxVisible / 2);
        let start = Math.max(0, currentPage - half);
        let end = Math.min(totalPages - 1, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(0, end - maxVisible + 1);
        }

        // start pages
        if (start > 0) {
            pages.push({
                type: 'page',
                label: '1',
                value: 0,
            });
            if (start > 1) {
                pages.push({
                    type: 'ellipsis',
                    key: 'ellipsis-start',
                });
            }
        }

        // middle pages
        for (let i = start; i <= end; i++) {
            pages.push({
                type: 'page',
                label: `${i + 1}`,
                value: i,
                isActive: i === currentPage,
            });
        }

        // last pages
        if (end < totalPages - 1) {
            if (end < totalPages - 2) {
                pages.push({
                    type: 'ellipsis',
                    key: 'ellipsis-end',
                });
            }
            pages.push({
                type: 'page',
                label: `${totalPages}`,
                value: totalPages - 1,
            });
        }

        return pages;
    }, [currentPage, totalPages, maxVisible]);

    const handleClick = (page) => {
        if (page >= 0 && page < totalPages) {
            onPageChange(page);
        }
    };

    // return no pages
    if (totalPages <= 1) {
        return null;
    }

    return (
        <Flex
            justifyContent="center"
            p={4}
            flexWrap="wrap"
            gap={{ base: 1, md: 2 }}
            align="center"
            maxW="100%"
            overflow="hidden"
        >
            {/* Previous button */}
            <Button
                onClick={() => handleClick(currentPage - 1)}
                disabled={currentPage === 0}
                bg={bgColor}
                color={textColor}
                _hover={{ bg: hoverBgColor }}
                size={{ base: 'sm', md: 'sm', lg: 'md' }}
                minW="fit-content"
            >
                {t('previous')}
            </Button>

            {/* Page buttons */}
            {pageButtons.map((item, index) => {
                if (item.type === 'ellipsis') {
                    return (
                        <Button
                            key={item.key || `ellipsis-${index}`}
                            disabled
                            bg={bgColor}
                            color={textColor}
                            size={{ base: 'sm', md: 'sm', lg: 'md' }}
                            minW="fit-content"
                            cursor="default"
                            _hover={{}}
                        >
                            …
                        </Button>
                    );
                }
                return (
                    <Button
                        key={`page-${item.value}`}
                        onClick={() => handleClick(item.value)}
                        bg={item.isActive ? activeBgColor : bgColor}
                        color={item.isActive ? 'white' : textColor}
                        _hover={{ bg: item.isActive ? activeBgColor : hoverBgColor }}
                        size={{ base: 'sm', md: 'sm', lg: 'md' }}
                        minW="fit-content"
                    >
                        {item.label}
                    </Button>
                );
            })}

            {/* Next button */}
            <Button
                onClick={() => handleClick(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                bg={bgColor}
                color={textColor}
                _hover={{ bg: hoverBgColor }}
                size={{ base: 'sm', md: 'sm', lg: 'md' }}
                minW="fit-content"
            >
                {t('next')}
            </Button>
        </Flex>
    );

};


Pagination.propTypes = {
    currentPage: PropTypes.number.isRequired,
    totalPages: PropTypes.number.isRequired,
    onPageChange: PropTypes.func.isRequired
};

export default Pagination;
