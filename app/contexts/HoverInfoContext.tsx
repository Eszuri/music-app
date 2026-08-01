import React, {createContext, useContext, useMemo, useState} from 'react';

interface HoverInfoContextProps {
    hoverInfo: string | null;
    setHoverInfo: (info: string | null) => void;
}

const HoverInfoContext = createContext<HoverInfoContextProps | undefined>(undefined);

export function HoverInfoProvider({children}: {children: React.ReactNode}) {
    const [hoverInfo, setHoverInfo] = useState<string | null>(null);

    const value = useMemo(() => ({hoverInfo, setHoverInfo}), [hoverInfo]);

    return (
        <HoverInfoContext.Provider value={value}>
            {children}
        </HoverInfoContext.Provider>
    );
}

export function useHoverInfo() {
    const context = useContext(HoverInfoContext);
    if (!context) {
        throw new Error('useHoverInfo must be used within a HoverInfoProvider');
    }
    return context;
}
