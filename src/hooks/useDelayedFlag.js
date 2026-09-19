import { useState, useEffect } from 'react';

/**
 * Returns a boolean that only becomes `true` after `delay` ms of `flag` being true.
 * Useful for delaying skeletons to avoid flashing on fast responses.
 */
export const useDelayedFlag = (flag, delay = 150) => {
    const [delayed, setDelayed] = useState(false);

    useEffect(() => {
        if (flag) {
            const timer = setTimeout(() => setDelayed(true), delay);
            return () => clearTimeout(timer);
        }
        setDelayed(false);
    }, [flag, delay]);

    return delayed;
};
