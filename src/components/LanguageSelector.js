import React from 'react';
import {
    Button,
    Menu,
    MenuButton,
    MenuList,
    MenuOptionGroup,
    MenuItemOption,
    HStack,
    Text,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { MdLanguage } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { LANGUAGES, DEFAULT_LANGUAGE, getLanguage } from '../constants/languages.js';
import { useColors } from '../constants/constants.js';

const LanguageSelector = () => {
    const { t, i18n } = useTranslation('languageSelector');
    const colors = useColors();

    const currentCode = i18n.resolvedLanguage ?? DEFAULT_LANGUAGE;
    const currentLanguage = getLanguage(currentCode);

    return (
        <Menu autoSelect={false}>
            <MenuButton
                as={Button}
                variant={'ghost'}
                aria-label={t('label')}
                leftIcon={<MdLanguage />}
                rightIcon={<ChevronDownIcon />}
                color={colors.linkColor}
                _hover={{ color: colors.linkHoverColor }}
                fontSize={'sm'}
                fontWeight={600}
                px={2}
            >
                {currentLanguage.code.toUpperCase()}
            </MenuButton>
            <MenuList minW={'180px'} zIndex={'popover'}>
                <MenuOptionGroup
                    type={'radio'}
                    value={currentCode}
                    onChange={(code) => i18n.changeLanguage(code)}
                >
                    {LANGUAGES.map((language) => (
                        <MenuItemOption key={language.code} value={language.code}>
                            <HStack spacing={2}>
                                {language.flag && <Text as={'span'}>{language.flag}</Text>}
                                <Text as={'span'}>{language.nativeName}</Text>
                            </HStack>
                        </MenuItemOption>
                    ))}
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

export default LanguageSelector;
