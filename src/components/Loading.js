import { useState, useEffect } from 'react';
import { Spinner, Center } from '@chakra-ui/react'

export default function Loading({
    size = 'md',           // 'sm' | 'md' | 'lg' | 'xl'
    minHeight = '120px',   // small default — not 100vh
    fullPage = false,
    delay = 200,
    inline = false,        // if true, don't stretch width
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    const resolvedMinHeight = fullPage ? '100vh' : minHeight;
    const resolvedSize = fullPage ? 'xl' : size;

    return (
        <Center
            minH={resolvedMinHeight}
            w={inline ? 'auto' : '100%'}
            py={fullPage ? 0 : 4}
        >
            {visible && (
                <Spinner
                    thickness='4px'
                    speed='0.65s'
                    emptyColor='cyan.200'
                    color='cyan.500'
                    size={resolvedSize}
                />
            )}
        </Center>
    )
}
