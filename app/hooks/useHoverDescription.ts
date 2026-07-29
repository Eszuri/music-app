import { useCallback } from 'react';
import { useHoverInfo } from '../contexts/HoverInfoContext';

export function useHoverDescription(description: string | null | undefined) {
    const { setHoverInfo } = useHoverInfo();

    const onMouseEnter = useCallback(() => {
        if (description) {
            setHoverInfo(description);
        }
    }, [description, setHoverInfo]);

    const onMouseLeave = useCallback(() => {
        setHoverInfo(null);
    }, [setHoverInfo]);

    return {
        onMouseEnter,
        onMouseLeave,
    };
}
