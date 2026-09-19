import React from 'react';
import PropTypes from 'prop-types';
import { Input, Box } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

const SearchBar = ({ searchTerm, setSearchTerm }) => {
    const { t } = useTranslation('fightPage');

    const handleChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
    };

    return (
        <Box>
            <Input
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={handleChange}
                mb={4}
            />
        </Box>
    );
};

SearchBar.propTypes = {
    searchTerm: PropTypes.string,
    setSearchTerm: PropTypes.func
}

export default SearchBar;
